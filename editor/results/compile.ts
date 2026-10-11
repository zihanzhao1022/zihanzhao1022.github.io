import { t } from '../../lib/phrases/results';
import { BlockKind, buildBlockDocument } from '../tex/document';
import { TexEngine } from '../tex/engine';
import { locateLine, parseAuxCitations, parseAuxLabels, parseCounters, parseErrors, parseWarnings } from '../tex/log';
import { referencedLabels } from './numbering';

export interface BlockIssue {
  message: string;
  /** Where the error is: the block's own code, the paper's preamble, an attachment, or the site's wrapper. */
  area: 'source' | 'preamble' | 'file' | 'wrapper';
  line?: number;
  /** For area 'file': the file's name. */
  file?: string;
}

export interface BlockCompileInput {
  preamble: string;
  source: string;
  kind: BlockKind;
  counters: Record<string, number>;
  labels: Record<string, string>;
  /** The paper's bibliography entries the block's \cite can show (see buildBlockDocument). */
  citations?: Record<string, string>;
  /** The page's appendix started in an earlier block. */
  appendix?: boolean;
  /** Attachments by file name, placed next to main.tex. */
  files: Record<string, Uint8Array>;
}

export interface BlockCompileResult {
  /** A PDF without TeX errors: the only kind of result that may be saved. */
  ok: boolean;
  pdf?: Uint8Array;
  width: number;
  height: number;
  counters: Record<string, number>;
  labels: Record<string, string>;
  issues: BlockIssue[];
  warnings: string[];
  log: string;
  /** Current draft bibliography, shown beneath a block's live preview for citation navigation. */
  references?: { pdf: Uint8Array; width: number; height: number };
}

export type Measure = (pdf: Uint8Array) => Promise<{ width: number; height: number }>;

// LaTeX asks for a rerun whenever labels change; the results pages rerun by themselves.
const QUIET = /Label\(s\) may have changed|There were undefined references/;

async function runOnce(engine: TexEngine, input: BlockCompileInput, labels: Record<string, string>) {
  const doc = buildBlockDocument({ ...input, labels });
  const out = await engine.compile({ main: doc.main, files: { ...input.files, 'main.aux': doc.aux } });
  const issues = parseErrors(out.log).map((issue): BlockIssue => {
    if (issue.file) return { message: issue.message, area: 'file', file: issue.file, line: issue.line };
    if (issue.line === undefined) return { message: issue.message, area: 'wrapper' };
    const where = locateLine(issue.line, doc);
    return { message: issue.message, area: where.area, line: where.line };
  });
  if (!out.ok && issues.length === 0) issues.push({ message: out.reason ?? t('TeX 没有生成 PDF，详情见日志'), area: 'wrapper' });
  return { out, issues, labels: parseAuxLabels(out.aux ?? '') };
}

/**
 * Compiles one block in its place on the page. A block that refers to its own new labels is compiled a
 * second time with them, so references inside one block resolve like they would in the paper.
 */
export async function compileBlock(engine: TexEngine, input: BlockCompileInput, measure: Measure): Promise<BlockCompileResult> {
  let run = await runOnce(engine, input, input.labels);
  const references = referencedLabels(input.source);
  if (run.issues.length === 0 && references.some((name) => run.labels[name] !== undefined && run.labels[name] !== input.labels[name])) {
    run = await runOnce(engine, input, { ...input.labels, ...run.labels });
  }
  const { out, issues, labels } = run;
  const ok = out.ok && out.pdf !== undefined && issues.length === 0;
  const size = ok && out.pdf ? await measure(out.pdf) : { width: 0, height: 0 };
  return {
    ok,
    pdf: ok ? out.pdf : undefined,
    ...size,
    counters: parseCounters(out.log),
    labels,
    issues,
    warnings: parseWarnings(out.log).filter((warning) => !QUIET.test(warning)),
    log: out.log,
  };
}

/** One line for a list of problems, e.g. "代码第 8 行：Undefined control sequence." */
export function describeIssue(issue: BlockIssue): string {
  if (issue.line === undefined) return issue.message;
  if (issue.area === 'file') return t('{file} 第 {line} 行：{message}', { file: issue.file ?? '', line: issue.line, message: issue.message });
  const where = { source: t('代码'), preamble: t('导言区'), wrapper: t('包装文档') }[issue.area];
  return t('{where}第 {line} 行：{message}', { where, line: issue.line, message: issue.message });
}

/** The bibliography file a paper's blocks cite from, an attachment like the others. */
export const REFERENCES_FILE = 'references.bib';

export interface ReferencesCompileResult {
  ok: boolean;
  pdf?: Uint8Array;
  width: number;
  height: number;
  /** \bibcite entries by key, for the blocks. */
  citations: Record<string, string>;
  issues: BlockIssue[];
  log: string;
}

/** BibTeX's own complaints, e.g. a .bst it could not find or a broken entry. */
const bibtexProblem = (log = ''): string | null => {
  const lines = log.split('\n').map((line) => line.trim()).filter((line) => /^I couldn't|^I found no|\b(?:fatal error|error messages?)\b|---line \d+/.test(line));
  return lines.length > 0 ? t('BibTeX：{lines}', { lines: lines.slice(0, 3).join(' ') }) : null;
};

/**
 * The paper's "References": the given keys (in the order the page first cites them) typeset from
 * references.bib with the paper's preamble and bibliography style, like a text block. pdfTeX, BibTeX and
 * pdfTeX again, as LaTeX does it.
 */
export async function compileReferences(
  engine: TexEngine,
  input: { preamble: string; keys: string[]; style: string; files: Record<string, Uint8Array> },
  measure: Measure,
): Promise<ReferencesCompileResult> {
  const source = [`\\nocite{${input.keys.join(',')}}`, `\\bibliographystyle{${input.style}}`, `\\bibliography{${REFERENCES_FILE.replace(/\.bib$/, '')}}`].join('\n');
  const doc = buildBlockDocument({ preamble: input.preamble, source, kind: 'text' });
  const out = await engine.compile({ main: doc.main, files: { ...input.files, 'main.aux': doc.aux }, bibtex: true });
  const issues = parseErrors(out.log).map((issue): BlockIssue => (issue.file ? { message: issue.message, area: 'file', file: issue.file, line: issue.line } : { message: issue.message, area: 'wrapper' }));
  // The final TeX pass can produce a PDF even if BibTeX failed or skipped an entry.
  const bibtexIssue = bibtexProblem(out.bibtexLog);
  if (bibtexIssue) issues.push({ message: bibtexIssue, area: 'wrapper' });
  if (!out.ok && issues.length === 0) {
    issues.push({ message: out.reason ?? t('TeX 没有生成参考文献，详情见日志'), area: 'wrapper' });
  }
  const citations = parseAuxCitations(out.aux ?? '');
  const missing = [...new Set(input.keys)].filter((key) => !Object.prototype.hasOwnProperty.call(citations, key));
  if (out.ok && missing.length > 0) {
    issues.push({
      message: t('未生成以下引用：{keys}。请检查 {file} 中的引用键、条目格式和 BibTeX 日志。', { keys: missing.join(t('、')), file: REFERENCES_FILE }),
      area: 'wrapper',
    });
  }
  const ok = out.ok && out.pdf !== undefined && issues.length === 0;
  const size = ok && out.pdf ? await measure(out.pdf) : { width: 0, height: 0 };
  const log = out.bibtexLog ? `${out.log}\n\nBibTeX log:\n${out.bibtexLog}` : out.log;
  return { ok, pdf: ok ? out.pdf : undefined, ...size, citations, issues, log };
}

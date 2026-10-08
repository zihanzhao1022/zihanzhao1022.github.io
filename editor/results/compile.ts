import { ResultBlockKind } from '../../types';
import { buildBlockDocument } from '../tex/document';
import { TexEngine } from '../tex/engine';
import { locateLine, parseAuxLabels, parseCounters, parseErrors, parseWarnings } from '../tex/log';
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
  kind: ResultBlockKind;
  counters: Record<string, number>;
  labels: Record<string, string>;
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
}

type Measure = (pdf: Uint8Array) => Promise<{ width: number; height: number }>;

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
  if (!out.ok && issues.length === 0) issues.push({ message: 'TeX 没有生成 PDF，详情见日志', area: 'wrapper' });
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
  if (issue.area === 'file') return `${issue.file} 第 ${issue.line} 行：${issue.message}`;
  const where = { source: '代码', preamble: '导言区', wrapper: '包装文档' }[issue.area];
  return `${where}第 ${issue.line} 行：${issue.message}`;
}

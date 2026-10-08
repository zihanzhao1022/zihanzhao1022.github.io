import { pdfPageSize } from '../../components/results/pdfjs';
import { ResultBlockKind, ResultPaper } from '../../types';
import { DEFAULT_PREAMBLE } from '../tex/document';
import { TexEngine, getTexEngine } from '../tex/engine';
import { bibKeysOf, bibliographyStyle } from './bibtex';
import { REFERENCES_FILE, compileBlock, compileReferences, describeIssue } from './compile';
import { CompileFn, RebuildResult, ReferencesBuilder, rebuild } from './numbering';
import { ResultsOp } from './ops';

export type ReadFile = (path: string) => Promise<Uint8Array>;

export const attachmentPath = (paperId: string, name: string): string => `results/${paperId}/files/${name}`;

export const preambleOf = (paper: ResultPaper): string => paper.preamble ?? DEFAULT_PREAMBLE;

/** The paper's attachments by file name, as compiles need them next to main.tex. */
export async function loadAttachments(paper: ResultPaper, readFile: ReadFile): Promise<Record<string, Uint8Array>> {
  const entries = await Promise.all(
    (paper.files ?? []).map(async (name) => [name, await readFile(attachmentPath(paper.id, name))] as const),
  );
  return Object.fromEntries(entries);
}

export function makeCompileFn(engine: TexEngine, preamble: string, files: Record<string, Uint8Array>): CompileFn {
  return async (block, context) => {
    const result = await compileBlock(
      engine,
      {
        preamble,
        source: block.source ?? '',
        kind: block.kind,
        counters: context.counters,
        labels: context.labels,
        citations: context.citations,
        files,
      },
      pdfPageSize,
    );
    if (result.ok && result.pdf) {
      return { ok: true, pdf: result.pdf, width: result.width, height: result.height, counters: result.counters, labels: result.labels };
    }
    return { ok: false, message: result.issues.map(describeIssue).join('；') || '编译失败' };
  };
}

/** How a paper's bibliography is typeset from its references.bib (null without one). */
export function makeReferencesBuilder(engine: TexEngine, paper: ResultPaper, files: Record<string, Uint8Array>): ReferencesBuilder {
  const bib = files[REFERENCES_FILE];
  const style = bibliographyStyle(paper);
  return {
    bibKeys: bib ? bibKeysOf(new TextDecoder().decode(bib)) : null,
    style,
    compile: async (keys) => {
      const result = await compileReferences(engine, { preamble: preambleOf(paper), keys, style, files }, pdfPageSize);
      if (result.ok && result.pdf) return { ok: true, pdf: result.pdf, width: result.width, height: result.height, citations: result.citations };
      return { ok: false, message: result.issues.map(describeIssue).join('；') || '编译失败' };
    },
  };
}

/** Recompiles what the paper's changes made out of date (bibliography first), with these attachments. */
export async function rebuildWith(paper: ResultPaper, files: Record<string, Uint8Array>): Promise<RebuildResult> {
  const engine = await getTexEngine();
  return rebuild(paper, makeCompileFn(engine, preambleOf(paper), files), { references: makeReferencesBuilder(engine, paper, files) });
}

/** Recompiles the paper's out-of-date blocks with its preamble and attachments. */
export async function rebuildPaper(paper: ResultPaper, readFile: ReadFile, files?: Record<string, Uint8Array>): Promise<RebuildResult> {
  return rebuildWith(paper, files ?? (await loadAttachments(paper, readFile)));
}

/** The edits followed by the rebuilt outputs, as one save. */
export function withOutputs(paperId: string, ops: ResultsOp[], rebuilt: RebuildResult): ResultsOp {
  const all = [...ops];
  if (rebuilt.references !== undefined) all.push({ kind: 'setReferences', paperId, references: rebuilt.references });
  if (Object.keys(rebuilt.outputs).length > 0) {
    all.push({ kind: 'setOutputs', paperId, outputs: rebuilt.outputs, sources: rebuilt.sources });
  }
  return all.length === 1 ? all[0] : { kind: 'batch', ops: all };
}

export const newBlockId = (): string => `blk-${Date.now().toString(36)}`;

export const BLOCK_TEMPLATES: Record<ResultBlockKind, string> = {
  text: String.raw`Write the text here; math works as usual: $E = mc^2$.`,
  figure: String.raw`\begin{figure}[t]
\centering
% Upload an image above, then use "插入" to add \includegraphics here.
\caption{Caption.}
\label{fig:}
\end{figure}`,
  table: String.raw`\begin{table}[t]
\centering
\begin{tabular}{lcc}
\toprule
Method & A & B \\
\midrule
Baseline & 0.0 & 0.0 \\
Ours & 0.0 & 0.0 \\
\bottomrule
\end{tabular}
\caption{Caption.}
\label{tab:}
\end{table}`,
};

/** Attachments the compile can use: style files, bibliography files and figures. */
export const ATTACHMENT_TYPES = ['.sty', '.cls', '.tex', '.bib', '.bst', '.cfg', '.def', '.clo', '.pdf', '.png', '.jpg', '.jpeg'];
export const ATTACHMENT_LIMIT = 20 * 1024 * 1024;
export const IMAGE_TYPES = ['.pdf', '.png', '.jpg', '.jpeg'];

/** Short content hash of an attachment (first 16 hex digits of SHA-256). */
export async function hashBytes(data: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data.slice()));
  return [...digest.slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The name an uploaded file is stored under: letters, digits, dot, dash and underscore, which TeX and URLs
 * both handle. A name that has to change (e.g. "实验结果.png") also gets a short hash of the content, so two
 * such files never replace each other, while the same file uploaded again keeps its name.
 */
export async function attachmentName(name: string, data: Uint8Array): Promise<string> {
  const base = name.split(/[\\/]/).pop()!.trim();
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot) : '';
  const cleanStem = stem.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|-+$/g, '');
  const cleanExtension = extension.replace(/[^A-Za-z0-9.]/g, '');
  if (cleanStem === stem && cleanExtension === extension) return base;
  return `${cleanStem || 'file'}-${(await hashBytes(data)).slice(0, 8)}${cleanExtension}`;
}

/** putFile operations for newly added attachments, with their content hashes. */
export async function putFiles(paperId: string, added: Record<string, Uint8Array>): Promise<{ ops: ResultsOp[]; hashes: Record<string, string> }> {
  const hashes: Record<string, string> = {};
  for (const [name, data] of Object.entries(added)) hashes[name] = await hashBytes(data);
  return { ops: Object.entries(hashes).map(([name, hash]): ResultsOp => ({ kind: 'putFile', paperId, name, hash })), hashes };
}

export const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
};

/** Why an attachment cannot be used, or null when it can. */
export function attachmentProblem(file: { name: string; size: number }): string | null {
  if (!ATTACHMENT_TYPES.includes(extensionOf(file.name))) return `不支持 ${extensionOf(file.name) || '没有扩展名的'} 文件，可以上传 ${ATTACHMENT_TYPES.join(' ')}`;
  if (file.size > ATTACHMENT_LIMIT) return '文件超过 20 MB';
  return null;
}

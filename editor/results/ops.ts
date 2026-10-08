import { ResultBlock, ResultBlockOutput, ResultPaper } from '../../types';
import { ContentOp, applyListOp } from '../ops';

/** What the paper form edits. Blocks, preamble, attachments and visibility change through their own operations. */
const INFO_FIELDS = ['slug', 'title', 'authors', 'venue', 'year', 'summary'] as const;

export type ResultsOp =
  /** A new paper goes first; an existing one gets the form's information fields. */
  | { kind: 'putPaper'; paper: ResultPaper }
  | { kind: 'deletePaper'; id: string }
  | { kind: 'reorderPapers'; ids: string[] }
  | { kind: 'setPaperHidden'; id: string; hidden: boolean }
  | { kind: 'patchPaper'; id: string; fields: Partial<Pick<ResultPaper, 'preamble'>> }
  /** Adds an attachment, or records the new content hash of a replaced one. */
  | { kind: 'putFile'; paperId: string; name: string; hash: string }
  | { kind: 'removeFile'; paperId: string; name: string }
  /**
   * Inserts a new block at `at` (default: the end). For an existing block only its kind and source change:
   * whether it is hidden and its compiled output always come from the latest version.
   */
  | { kind: 'putBlock'; paperId: string; block: ResultBlock; at?: number }
  | { kind: 'deleteBlock'; paperId: string; blockId: string }
  | { kind: 'reorderBlocks'; paperId: string; ids: string[] }
  | { kind: 'setBlockHidden'; paperId: string; blockId: string; hidden: boolean }
  /** Compiled outputs, each kept only if the block's source is still the one it was compiled from. */
  | { kind: 'setOutputs'; paperId: string; outputs: Record<string, ResultBlockOutput>; sources: Record<string, string> }
  | { kind: 'batch'; ops: ResultsOp[] };

function updatePaper(papers: ResultPaper[], id: string, change: (paper: ResultPaper) => ResultPaper): ResultPaper[] {
  return papers.map((paper) => (paper.id === id ? change(paper) : paper));
}

function putInfo(existing: ResultPaper, form: ResultPaper): ResultPaper {
  const next: Record<string, unknown> = { ...existing };
  for (const key of INFO_FIELDS) {
    if (form[key] === undefined) delete next[key];
    else next[key] = form[key];
  }
  return next as unknown as ResultPaper;
}

/** Applies one edit to the list of papers. Like the site's other content operations, it is pure and idempotent. */
export function applyResultsOp(papers: ResultPaper[], op: ResultsOp): ResultPaper[] {
  switch (op.kind) {
    case 'putPaper': {
      const existing = papers.find((paper) => paper.id === op.paper.id);
      if (!existing) return [op.paper, ...papers];
      return updatePaper(papers, op.paper.id, (paper) => putInfo(paper, op.paper));
    }
    case 'deletePaper':
      return applyListOp(papers, { kind: 'delete', collection: 'results', id: op.id });
    case 'reorderPapers':
      return applyListOp(papers, { kind: 'reorder', collection: 'results', ids: op.ids });
    case 'setPaperHidden':
      return applyListOp(papers, { kind: 'setHidden', collection: 'results', id: op.id, hidden: op.hidden });
    case 'patchPaper':
      return updatePaper(papers, op.id, (paper) => ({ ...paper, ...op.fields }));
    case 'putFile':
      return updatePaper(papers, op.paperId, (paper) => ({
        ...paper,
        files: (paper.files ?? []).includes(op.name) ? paper.files : [...(paper.files ?? []), op.name],
        fileHashes: { ...paper.fileHashes, [op.name]: op.hash },
      }));
    case 'removeFile':
      return updatePaper(papers, op.paperId, (paper) => {
        const fileHashes = { ...paper.fileHashes };
        delete fileHashes[op.name];
        return { ...paper, files: (paper.files ?? []).filter((name) => name !== op.name), fileHashes };
      });
    case 'putBlock':
      return updatePaper(papers, op.paperId, (paper) => {
        if (paper.blocks.some((block) => block.id === op.block.id)) {
          return {
            ...paper,
            blocks: paper.blocks.map((block) =>
              block.id === op.block.id ? { ...block, kind: op.block.kind, source: op.block.source } : block,
            ),
          };
        }
        const at = op.at === undefined ? paper.blocks.length : Math.max(0, Math.min(op.at, paper.blocks.length));
        return { ...paper, blocks: [...paper.blocks.slice(0, at), op.block, ...paper.blocks.slice(at)] };
      });
    case 'deleteBlock':
      return updatePaper(papers, op.paperId, (paper) => ({
        ...paper,
        blocks: applyListOp(paper.blocks, { kind: 'delete', collection: 'results', id: op.blockId }),
      }));
    case 'reorderBlocks':
      return updatePaper(papers, op.paperId, (paper) => ({
        ...paper,
        blocks: applyListOp(paper.blocks, { kind: 'reorder', collection: 'results', ids: op.ids }),
      }));
    case 'setBlockHidden':
      return updatePaper(papers, op.paperId, (paper) => ({
        ...paper,
        blocks: applyListOp(paper.blocks, { kind: 'setHidden', collection: 'results', id: op.blockId, hidden: op.hidden }),
      }));
    case 'setOutputs':
      return updatePaper(papers, op.paperId, (paper) => ({
        ...paper,
        blocks: paper.blocks.map((block) =>
          op.outputs[block.id] && block.source === op.sources[block.id] ? { ...block, output: op.outputs[block.id] } : block,
        ),
      }));
    case 'batch':
      return op.ops.reduce(applyResultsOp, papers);
  }
}

/** Papers an operation changes. */
export function touchedPapers(op: ResultsOp): string[] {
  switch (op.kind) {
    case 'putPaper':
      return [op.paper.id];
    case 'deletePaper':
    case 'setPaperHidden':
    case 'patchPaper':
      return [op.id];
    case 'reorderPapers':
      return [];
    case 'batch':
      return [...new Set(op.ops.flatMap(touchedPapers))];
    default:
      return [op.paperId];
  }
}

/** Every private file the papers still refer to: compiled PDFs and attachments. */
export function referencedPaths(papers: ResultPaper[]): Set<string> {
  const paths = new Set<string>();
  for (const paper of papers) {
    for (const block of paper.blocks) if (block.output) paths.add(block.output.pdf);
    for (const name of paper.files ?? []) paths.add(`results/${paper.id}/files/${name}`);
  }
  return paths;
}

/** The results operation for an edit made through the site's generic dialogs and drag-and-drop. */
export function fromContentOp(op: ContentOp): ResultsOp | null {
  switch (op.kind) {
    case 'upsert':
      return { kind: 'putPaper', paper: op.item as unknown as ResultPaper };
    case 'delete':
      return { kind: 'deletePaper', id: op.id };
    case 'reorder':
      return { kind: 'reorderPapers', ids: op.ids };
    case 'setHidden':
      return { kind: 'setPaperHidden', id: op.id, hidden: op.hidden };
    default:
      return null;
  }
}

/** e.g. results: update block in "Self-evolving agents" */
export function resultsCommitMessage(action: string, title?: string): string {
  const text = title?.replace(/\s+/g, ' ').trim();
  const short = text && text.length > 60 ? `${text.slice(0, 57)}...` : text;
  return `results: ${action}${short ? ` "${short}"` : ''}`;
}

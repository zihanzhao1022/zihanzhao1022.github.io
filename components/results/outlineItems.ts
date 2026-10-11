import { blockNumber, headingText } from '../../lib/headings';
import { t } from '../../lib/phrases/site';
import { HeadingLevel, ResultBlock } from '../../types';

export interface OutlineItem {
  /** The block it jumps to; "references" for the bibliography. */
  blockId: string;
  kind: 'heading' | 'figure' | 'table' | 'references';
  /** Indentation: sections at 0, figures and tables one deeper than the heading above them. */
  depth: number;
  text: string;
}

const DEPTH: Record<HeadingLevel, number> = { section: 0, subsection: 1, subsubsection: 2, paragraph: 3 };

/** "图 3", "表 2", or just "图" / "表" without a number, in the interface's language. */
function caption(kind: 'figure' | 'table', number: string | undefined): string {
  if (kind === 'figure') return number ? t('图 {n}', { n: number }) : t('图');
  return number ? t('表 {n}', { n: number }) : t('表');
}

/**
 * The outline of a page: its headings, the figures and tables under them, and the bibliography last.
 * `blocks` are all the paper's blocks, since hidden ones count too; `shown` says which the page shows.
 */
export function outlineItems(blocks: ResultBlock[], shown: (block: ResultBlock) => boolean, references: boolean): OutlineItem[] {
  const items: OutlineItem[] = [];
  let depth = -1;
  blocks.forEach((block, index) => {
    if (!shown(block)) return;
    if (block.kind === 'heading' && block.heading) {
      depth = DEPTH[block.heading.level];
      const number = block.numbering?.number;
      const title = headingText(block.heading.title);
      items.push({ blockId: block.id, kind: 'heading', depth, text: number ? `${number} ${title}` : title });
    } else if (block.kind === 'figure' || block.kind === 'table') {
      items.push({ blockId: block.id, kind: block.kind, depth: depth + 1, text: caption(block.kind, blockNumber(blocks, index)) });
    }
  });
  if (references) items.push({ blockId: 'references', kind: 'references', depth: 0, text: 'References' });
  return items;
}

/**
 * The outline item for a place on the page (`order` lists the shown blocks top to bottom): the figure or table
 * itself, else the heading above it, else none.
 */
export function itemAt(items: OutlineItem[], order: string[], blockId: string | null | undefined): string | null {
  if (!blockId) return null;
  if (items.some((item) => item.blockId === blockId)) return blockId;
  const headings = new Set(items.filter((item) => item.kind === 'heading').map((item) => item.blockId));
  for (let index = order.indexOf(blockId) - 1; index >= 0; index -= 1) {
    if (headings.has(order[index])) return order[index];
  }
  return null;
}

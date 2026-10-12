import { blockNumber } from '../../lib/headings';
import { t } from '../../lib/phrases/site';
import { sectionsOf } from '../../lib/sections';
import { ResultBlock, SectionLevel } from '../../types';

export interface OutlineItem {
  /** Identifies the item: "<block id>#<n>" for a block's heading, the block's ID for a figure or table. */
  key: string;
  /** The block it jumps to; "references" for the bibliography. */
  blockId: string;
  /**
   * A heading's place among its block's headings, and how many there are: each is one destination in the
   * block's PDF, in order from the top (see goToHeading). The appendix has none.
   */
  heading?: { index: number; of: number };
  kind: 'section' | 'paragraph' | 'appendix' | 'figure' | 'table' | 'references';
  /** Indentation: sections at 0; paragraphs, figures and tables one deeper than the heading above them. */
  depth: number;
  text: string;
}

const DEPTH: Record<Exclude<SectionLevel, 'paragraph'>, number> = { section: 0, subsection: 1, subsubsection: 2 };

/** "图 3", "表 2", or just "图" / "表" without a number, in the interface's language. */
function caption(kind: 'figure' | 'table', number: string | undefined): string {
  if (kind === 'figure') return number ? t('图 {n}', { n: number }) : t('图');
  return number ? t('表 {n}', { n: number }) : t('表');
}

/**
 * The outline of a page: the headings its text blocks typeset (\section down to \paragraph, and where
 * \appendix starts the appendix), the figures and tables under them, and the bibliography last. `blocks`
 * are all the paper's blocks, since hidden ones count too; `shown` says which the page shows. Visitors'
 * blocks carry their headings (publicView); otherwise they are read from the sources.
 */
export function outlineItems(blocks: ResultBlock[], shown: (block: ResultBlock) => boolean, references: boolean, preamble?: string): OutlineItem[] {
  const fromSources = sectionsOf(blocks, preamble);
  const items: OutlineItem[] = [];
  // The depth of the last section, subsection or subsubsection.
  let depth = -1;
  blocks.forEach((block, index) => {
    if (!shown(block)) return;
    if (block.kind === 'figure' || block.kind === 'table') {
      items.push({ key: block.id, blockId: block.id, kind: block.kind, depth: depth + 1, text: caption(block.kind, blockNumber(blocks, index)) });
      return;
    }
    const sections = block.output?.sections ?? fromSources[block.id] ?? [];
    const of = sections.filter((section) => section.level !== 'appendix').length;
    let at = 0;
    sections.forEach((section, position) => {
      if (section.level === 'appendix') {
        depth = 0;
        items.push({ key: `${block.id}#appendix${position}`, blockId: block.id, kind: 'appendix', depth: 0, text: section.title });
        return;
      }
      const heading = { index: at, of };
      at += 1;
      // \paragraph{} only adds space; it still counts among the PDF's destinations.
      if (!section.title) return;
      const text = section.number ? `${section.number} ${section.title}` : section.title;
      if (section.level === 'paragraph') {
        items.push({ key: `${block.id}#${heading.index}`, blockId: block.id, heading, kind: 'paragraph', depth: depth + 1, text });
        return;
      }
      depth = DEPTH[section.level];
      items.push({ key: `${block.id}#${heading.index}`, blockId: block.id, heading, kind: 'section', depth, text });
    });
  });
  if (references) items.push({ key: 'references', blockId: 'references', kind: 'references', depth: 0, text: 'References' });
  return items;
}

const marksSection = (item: OutlineItem): boolean => item.kind === 'section' || item.kind === 'appendix';

/**
 * The outline item for a place on the page (`order` lists the shown blocks top to bottom): the block's own
 * first item, else the last section above it, else none.
 */
export function itemAt(items: OutlineItem[], order: string[], blockId: string | null | undefined): string | null {
  if (!blockId) return null;
  const own = items.find((item) => item.blockId === blockId);
  if (own) return own.key;
  for (let index = order.indexOf(blockId) - 1; index >= 0; index -= 1) {
    const above = items.filter((item) => item.blockId === order[index] && marksSection(item));
    if (above.length > 0) return above[above.length - 1].key;
  }
  return null;
}

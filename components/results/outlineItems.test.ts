import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../../lib/i18n';
import { ResultBlock } from '../../types';
import { itemAt, outlineItems } from './outlineItems';

const pdf = { pdf: 'results/p/x-00000000.pdf', width: 1, height: 1 };

// Made-up page: a table before any section, a section with paragraphs and a figure, a block without headings,
// a hidden block with a subsection, and the appendix in a block of its own.
const blocks: ResultBlock[] = [
  { id: 't1', kind: 'table', output: { ...pdf, counters: { table: 1 } } },
  { id: 'x1', kind: 'text', source: '\\section{Results \\& more}\nText.\n\\paragraph{Note} x\n\\paragraph{} y', output: { ...pdf, counters: { table: 1, section: 1 } } },
  { id: 'f1', kind: 'figure', output: { ...pdf, counters: { table: 1, section: 1, figure: 1 }, labels: { 'fig:a': '{1}{1}{}{figure.1}{}' } } },
  { id: 'x0', kind: 'text', source: 'Plain text.', output: { ...pdf, counters: { table: 1, section: 1, figure: 1 } } },
  { id: 'x2', kind: 'text', source: '\\subsection{Hidden}', hidden: true, output: { ...pdf, counters: { table: 1, section: 1, figure: 1, subsection: 1 } } },
  { id: 't2', kind: 'table', output: { ...pdf, counters: { table: 2, section: 1, figure: 1, subsection: 1 } } },
  { id: 'x3', kind: 'text', source: '\\appendix\n\\subsection*{Extra}', output: { ...pdf, counters: { table: 2, section: 0, figure: 1, subsection: 0 } } },
  { id: 'f2', kind: 'figure' },
];
const visible = (block: ResultBlock) => !block.hidden;

describe('outlineItems', () => {
  it('lists the headings text blocks typeset, the figures and tables under them, and the bibliography last', () => {
    expect(outlineItems(blocks, visible, true)).toEqual([
      { key: 't1', blockId: 't1', kind: 'table', depth: 0, text: '表 1' },
      { key: 'x1#0', blockId: 'x1', heading: { index: 0, of: 3 }, kind: 'section', depth: 0, text: '1 Results & more' },
      { key: 'x1#1', blockId: 'x1', heading: { index: 1, of: 3 }, kind: 'paragraph', depth: 1, text: 'Note' },
      // \paragraph{} is only space: not listed, but counted among the block's headings.
      { key: 'f1', blockId: 'f1', kind: 'figure', depth: 1, text: '图 1' },
      // The hidden block's subsection is not listed; its table still counts.
      { key: 't2', blockId: 't2', kind: 'table', depth: 1, text: '表 2' },
      { key: 'x3#appendix0', blockId: 'x3', kind: 'appendix', depth: 0, text: 'Appendix' },
      { key: 'x3#0', blockId: 'x3', heading: { index: 0, of: 1 }, kind: 'section', depth: 1, text: 'Extra' },
      { key: 'f2', blockId: 'f2', kind: 'figure', depth: 2, text: '图' },
      { key: 'references', blockId: 'references', kind: 'references', depth: 0, text: 'References' },
    ]);
  });

  it('numbers headings over every block, and takes those publicView worked out for visitors', () => {
    const items = outlineItems(blocks, () => true, false);
    expect(items.find((item) => item.key === 'x2#0')).toMatchObject({ kind: 'section', depth: 1, text: '1.1 Hidden' });
    const visitors: ResultBlock[] = [{ id: 'v', kind: 'text', output: { ...pdf, sections: [{ level: 'subsection', title: 'Given', number: '2.3' }] } }];
    expect(outlineItems(visitors, visible, false)).toEqual([
      { key: 'v#0', blockId: 'v', heading: { index: 0, of: 1 }, kind: 'section', depth: 1, text: '2.3 Given' },
    ]);
  });

  describe('in English', () => {
    afterEach(() => setLang('zh'));

    it('names figures and tables in the interface language, and keeps the paper its own words', () => {
      setLang('en');
      expect(outlineItems(blocks, visible, true).map((item) => item.text)).toEqual([
        'Table 1',
        '1 Results & more',
        'Note',
        'Figure 1',
        'Table 2',
        'Appendix',
        'Extra',
        'Figure',
        'References',
      ]);
    });
  });
});

describe('itemAt', () => {
  const items = outlineItems(blocks, visible, true);
  const order = blocks.filter(visible).map((block) => block.id).concat('references');

  it("is the block's own first item, else the last section above it", () => {
    expect(itemAt(items, order, 'f1')).toBe('f1');
    expect(itemAt(items, order, 'x1')).toBe('x1#0');
    expect(itemAt(items, order, 'x0')).toBe('x1#0');
    expect(itemAt(items, order, 'x3')).toBe('x3#appendix0');
    expect(itemAt(items, order, 'references')).toBe('references');
  });

  it('is nothing above the first section or without a place', () => {
    expect(itemAt(items, ['x9', ...order], 'x9')).toBeNull();
    expect(itemAt(items, order, null)).toBeNull();
    expect(itemAt(items, order, 'unknown')).toBeNull();
  });
});

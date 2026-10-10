import { describe, expect, it } from 'vitest';
import { ResultBlock } from '../../types';
import { itemAt, outlineItems } from './outlineItems';

const pdf = { pdf: 'results/p/x.pdf', width: 1, height: 1 };

// Made-up page: a table before any heading, a section with a figure, a hidden subsection, the appendix.
const blocks: ResultBlock[] = [
  { id: 't1', kind: 'table', output: { ...pdf, counters: { table: 1 } } },
  { id: 'h1', kind: 'heading', heading: { level: 'section', title: 'Results \\& more' }, numbering: { number: '1', counters: { table: 1, section: 1 } } },
  { id: 'x1', kind: 'text', output: { ...pdf, counters: { table: 1, section: 1 } } },
  { id: 'f1', kind: 'figure', output: { ...pdf, counters: { table: 1, section: 1, figure: 1 }, labels: { 'fig:a': '{1}{1}{}{figure.1}{}' } } },
  { id: 'h2', kind: 'heading', heading: { level: 'subsection', title: 'Hidden' }, hidden: true, numbering: { number: '1.1', counters: { table: 1, section: 1, figure: 1, subsection: 1 } } },
  { id: 't2', kind: 'table', output: { ...pdf, counters: { table: 2, section: 1, figure: 1, subsection: 1 } } },
  { id: 'h3', kind: 'heading', heading: { level: 'section', starred: true, title: 'Appendix' }, numbering: {} },
  { id: 'f2', kind: 'figure' },
];
const visible = (block: ResultBlock) => !block.hidden;

describe('outlineItems', () => {
  it('lists the headings, the figures and tables under them, and the bibliography last', () => {
    expect(outlineItems(blocks, visible, true)).toEqual([
      { blockId: 't1', kind: 'table', depth: 0, text: '表 1' },
      { blockId: 'h1', kind: 'heading', depth: 0, text: '1 Results & more' },
      { blockId: 'f1', kind: 'figure', depth: 1, text: '图 1' },
      // Under the section: its hidden subsection is not shown, but still counted.
      { blockId: 't2', kind: 'table', depth: 1, text: '表 2' },
      { blockId: 'h3', kind: 'heading', depth: 0, text: 'Appendix' },
      { blockId: 'f2', kind: 'figure', depth: 1, text: '图' },
      { blockId: 'references', kind: 'references', depth: 0, text: 'References' },
    ]);
  });

  it('indents a figure under the deepest heading above it', () => {
    const shownAll = outlineItems(blocks, () => true, false);
    expect(shownAll.find((item) => item.blockId === 'h2')).toEqual({ blockId: 'h2', kind: 'heading', depth: 1, text: '1.1 Hidden' });
    expect(shownAll.find((item) => item.blockId === 't2')?.depth).toBe(2);
  });
});

describe('itemAt', () => {
  const items = outlineItems(blocks, visible, true);
  const order = blocks.filter(visible).map((block) => block.id).concat('references');

  it('is the figure or table itself, else the heading above', () => {
    expect(itemAt(items, order, 'f1')).toBe('f1');
    expect(itemAt(items, order, 'x1')).toBe('h1');
    expect(itemAt(items, order, 'h3')).toBe('h3');
    expect(itemAt(items, order, 'references')).toBe('references');
  });

  it('is nothing above the first heading or without a place', () => {
    expect(itemAt(items, ['x0', ...order], 'x0')).toBeNull();
    expect(itemAt(items, order, null)).toBeNull();
    expect(itemAt(items, order, 'unknown')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { ResultBlock } from '../types';
import { blockNumber, countersBefore, labelGroups } from './headings';

const pdf = { pdf: 'results/p/x.pdf', width: 1, height: 1 };

describe('labelGroups', () => {
  it('splits a \\newlabel value into its top-level groups', () => {
    expect(labelGroups('{2.1}{3}{Method {and} \\{more}{subsection.2.1}{}')).toEqual(['2.1', '3', 'Method {and} \\{more', 'subsection.2.1', '']);
    expect(labelGroups('{1}{1}')).toEqual(['1', '1']);
    expect(labelGroups('')).toEqual([]);
  });
});

describe('countersBefore', () => {
  it('continues from the nearest earlier block that has counters', () => {
    const blocks: ResultBlock[] = [
      { id: 'a', kind: 'table', output: { ...pdf, counters: { table: 1 } } },
      { id: 'h', kind: 'text', output: { ...pdf, counters: { table: 1, section: 1 } } },
      { id: 'b', kind: 'text' },
      { id: 'c', kind: 'text' },
    ];
    expect(countersBefore(blocks, 0)).toEqual({});
    expect(countersBefore(blocks, 3)).toEqual({ table: 1, section: 1 });
  });
});

describe('blockNumber', () => {
  it('reads figure and table numbers from their own labels first', () => {
    const blocks: ResultBlock[] = [
      {
        id: 'f',
        kind: 'figure',
        output: { ...pdf, counters: { figure: 3 }, labels: { 'fig:a': '{2.3}{1}{Cap}{figure.caption.5}{}', 'eq:x': '{4}{1}{}{equation.4}{}' } },
      },
    ];
    expect(blockNumber(blocks, 0)).toBe('2.3');
  });

  it('falls back to how far the counter moved', () => {
    const blocks: ResultBlock[] = [
      { id: 't1', kind: 'table', output: { ...pdf, counters: { table: 1 } } },
      { id: 'h', kind: 'text', output: { ...pdf, counters: { table: 1, section: 1 } } },
      { id: 't2', kind: 'table', output: { ...pdf, counters: { table: 3 } } },
      { id: 'x', kind: 'text', output: { ...pdf, counters: { table: 3 } } },
      { id: 'f', kind: 'figure', output: { ...pdf, counters: { table: 3 } } },
      { id: 'n', kind: 'table' },
    ];
    expect(blockNumber(blocks, 0)).toBe('1');
    expect(blockNumber(blocks, 2)).toBe('2–3');
    expect(blockNumber(blocks, 3)).toBeUndefined();
    // A figure without a caption, and a block not compiled yet.
    expect(blockNumber(blocks, 4)).toBeUndefined();
    expect(blockNumber(blocks, 5)).toBeUndefined();
  });

  it('uses the number publicView gave', () => {
    expect(blockNumber([{ id: 'f', kind: 'figure', output: { ...pdf, number: '7' } }], 0)).toBe('7');
  });
});

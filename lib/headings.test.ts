import { describe, expect, it } from 'vitest';
import { ResultBlock } from '../types';
import { HEADING_LABEL, blockNumber, countersBefore, headingKey, headingTex, headingText, labelGroups, readHeadingNumber } from './headings';

const pdf = { pdf: 'results/p/x.pdf', width: 1, height: 1 };

describe('labelGroups', () => {
  it('splits a \\newlabel value into its top-level groups', () => {
    expect(labelGroups('{2.1}{3}{Method {and} \\{more}{subsection.2.1}{}')).toEqual(['2.1', '3', 'Method {and} \\{more', 'subsection.2.1', '']);
    expect(labelGroups('{1}{1}')).toEqual(['1', '1']);
    expect(labelGroups('')).toEqual([]);
  });
});

describe('headingTex', () => {
  it('writes the sectioning command, labelled only when numbered', () => {
    expect(headingTex({ level: 'subsection', title: 'Method', label: 'sec:method' })).toBe('\\subsection{Method}\\label{sec:method}');
    expect(headingTex({ level: 'section', starred: true, title: 'Notes', label: 'sec:notes' })).toBe('\\section*{Notes}');
  });

  it('starts the appendix before a section only', () => {
    expect(headingTex({ level: 'section', title: 'Proofs', appendix: true })).toBe('\\appendix\n\\section{Proofs}');
    expect(headingTex({ level: 'section', starred: true, title: 'Appendix', appendix: true })).toBe('\\appendix\n\\section*{Appendix}');
    expect(headingTex({ level: 'paragraph', title: 'P', appendix: true })).toBe('\\paragraph{P}');
  });

  it('adds the label the page reads the number from when compiling', () => {
    expect(headingTex({ level: 'section', title: 'Intro' }, { numbering: true })).toBe(`\\section{Intro}\\label{${HEADING_LABEL}}`);
    expect(headingTex({ level: 'section', starred: true, title: 'Intro' }, { numbering: true })).toBe('\\section*{Intro}');
  });
});

describe('readHeadingNumber', () => {
  it('takes the number and anchor from the internal label and keeps the others', () => {
    const value = '{A.1}{1}{Proofs}{appendix.A.1}{}';
    expect(readHeadingNumber({ [HEADING_LABEL]: value, 'sec:proofs': value })).toEqual({
      number: 'A.1',
      anchor: 'appendix.A.1',
      labels: { 'sec:proofs': value },
    });
  });

  it('gives no number when LaTeX did not number the heading', () => {
    // \paragraph in article does not step its counter, so the label records the empty start of the document.
    expect(readHeadingNumber({ [HEADING_LABEL]: '{}{1}{}{Doc-Start}{}' })).toEqual({ labels: {} });
    expect(readHeadingNumber({})).toEqual({ labels: {} });
  });

  it('drops formatting commands from the number', () => {
    expect(readHeadingNumber({ [HEADING_LABEL]: '{\\textbf {2}}{1}{}{section.2}{}' }).number).toBe('2');
  });
});

describe('headingText', () => {
  it('undoes the usual escapes and leaves other LaTeX as typed', () => {
    expect(headingText('Results \\& Discussion: 50\\% on A\\_B~C, $x$')).toBe('Results & Discussion: 50% on A_B C, $x$');
  });
});

describe('headingKey', () => {
  it('changes with every field', () => {
    const base = headingKey({ level: 'section', title: 'A' });
    expect(headingKey({ level: 'section', title: 'A', starred: false })).toBe(base);
    for (const changed of [
      { level: 'subsection' as const, title: 'A' },
      { level: 'section' as const, title: 'B' },
      { level: 'section' as const, title: 'A', starred: true },
      { level: 'section' as const, title: 'A', label: 'sec:a' },
      { level: 'section' as const, title: 'A', appendix: true },
    ]) {
      expect(headingKey(changed)).not.toBe(base);
    }
  });
});

describe('countersBefore', () => {
  it('continues from the nearest earlier block or heading that has counters', () => {
    const blocks: ResultBlock[] = [
      { id: 'a', kind: 'table', output: { ...pdf, counters: { table: 1 } } },
      { id: 'h', kind: 'heading', heading: { level: 'section', title: 'S' }, numbering: { counters: { table: 1, section: 1 } } },
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
      { id: 'h', kind: 'heading', heading: { level: 'section', title: 'S' }, numbering: { counters: { table: 1, section: 1 } } },
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

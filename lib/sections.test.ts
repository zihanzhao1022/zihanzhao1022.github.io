import { describe, expect, it } from 'vitest';
import { ResultBlock } from '../types';
import { hasAppendix, plainTitle, sectionsOf } from './sections';

const text = (id: string, source: string, counters?: Record<string, number>): ResultBlock => ({
  id,
  kind: 'text',
  source,
  ...(counters ? { output: { pdf: `results/p/${id}-00000000.pdf`, width: 1, height: 1, counters } } : {}),
});

describe('plainTitle', () => {
  it('keeps the text of a title and drops its markup', () => {
    expect(plainTitle('Results on \\textsc{Bench}\\label{sec:r}')).toBe('Results on Bench');
    expect(plainTitle('Q\\&A~with $k$-means --- a {\\em made-up} study\\cite{x}')).toBe('Q&A with k-means — a made-up study');
    expect(plainTitle('100\\% \\LaTeX{} tips')).toBe('100% LaTeX tips');
  });
});

describe('sectionsOf', () => {
  it('numbers headings as LaTeX does, continuing from the counters earlier blocks ended with', () => {
    const blocks: ResultBlock[] = [
      text('a', '\\section{Intro}\nText.\n\\paragraph{Note} more.', { section: 1 }),
      { id: 'f', kind: 'figure', source: '\\begin{figure}\\end{figure}', output: { pdf: 'x', width: 1, height: 1, counters: { section: 1, figure: 1 } } },
      text('b', '% \\section{Not this}\n\\section{Method}\n\\subsection{Setup}\n\\subsection*{Aside}\n\\subsubsection{Detail}', { section: 2, subsection: 1, subsubsection: 1 }),
      text('c', '\\subsection[Short]{Long {title}}'),
    ];
    expect(sectionsOf(blocks)).toEqual({
      a: [
        { level: 'section', title: 'Intro', number: '1' },
        { level: 'paragraph', title: 'Note' },
      ],
      b: [
        { level: 'section', title: 'Method', number: '2' },
        { level: 'subsection', title: 'Setup', number: '2.1' },
        { level: 'subsection', title: 'Aside' },
        { level: 'subsubsection', title: 'Detail', number: '2.1.1' },
      ],
      c: [{ level: 'subsection', title: 'Long title', number: '2.2' }],
    });
  });

  it('letters sections after \\appendix, in its block and the ones after it', () => {
    const blocks = [
      text('a', '\\section{Last}', { section: 1 }),
      text('b', 'Before.\n\\appendix\n\\subsection*{Extra}\n\\section{Proofs}', { section: 1, subsection: 0 }),
      text('c', '\\section{More}\n\\subsection{Lemma}'),
    ];
    expect(sectionsOf(blocks)).toEqual({
      a: [{ level: 'section', title: 'Last', number: '1' }],
      b: [
        { level: 'appendix', title: 'Appendix' },
        { level: 'subsection', title: 'Extra' },
        { level: 'section', title: 'Proofs', number: 'A' },
      ],
      c: [
        { level: 'section', title: 'More', number: 'B' },
        { level: 'subsection', title: 'Lemma', number: 'B.1' },
      ],
    });
    expect(blocks.map(hasAppendix)).toEqual([false, true, false]);
  });

  it('numbers paragraphs when the preamble asks for that depth', () => {
    const blocks = [text('a', '\\section{A}\n\\paragraph{P}')];
    expect(sectionsOf(blocks, '\\setcounter{secnumdepth}{4}').a[1]).toEqual({ level: 'paragraph', title: 'P', number: '1.0.0.1' });
  });
});

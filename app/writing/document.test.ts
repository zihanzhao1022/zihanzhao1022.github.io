import { describe, expect, it } from 'vitest';
import { ResultBlock } from '../../types';
import { Mark, blockChanges, blocksOf, bodyOf, findWord, fullDocument, headingsOf, locate, markerLine, parseMarks, placeOf, withMarks } from './document';

const blocks: ResultBlock[] = [
  { id: 'blk-a', kind: 'text', source: '\\section{Results}\nOurs keeps the made-up accuracy.' },
  { id: 'blk-b', kind: 'figure', source: '\\begin{figure}[t]\n\\centering\n\\caption{A made-up figure.}\n\\end{figure}' },
  { id: 'blk-c', kind: 'table', source: '\\begin{table}[t]\n\\begin{tabular}{lc}\nA & 1 \\\\\n\\end{tabular}\n\\end{table}\n% portfolio-table:v1 %7B%7D' },
];

describe('main.tex and the blocks', () => {
  it('goes back to the same blocks, without the table editor cache line', () => {
    const body = bodyOf(blocks);
    expect(body).not.toContain('portfolio-table');
    expect(blocksOf(body)).toEqual([
      { id: 'blk-a', kind: 'text', source: blocks[0].source },
      { id: 'blk-b', kind: 'figure', source: blocks[1].source },
      { id: 'blk-c', kind: 'table', source: '\\begin{table}[t]\n\\begin{tabular}{lc}\nA & 1 \\\\\n\\end{tabular}\n\\end{table}' },
    ]);
    expect(blockChanges(blocks, blocksOf(body), () => 'new')).toEqual({ put: [], deleted: [] });
  });

  it('sees edited, emptied, new and moved blocks', () => {
    const body = [
      markerLine('blk-b', 'figure'),
      '\\begin{figure}[t]\n\\caption{Changed.}\n\\end{figure}',
      markerLine('blk-a', 'text'),
      blocks[0].source,
      markerLine('blk-new', 'text'),
      '\\begin{table}\nnew\n\\end{table}',
      markerLine('blk-c', 'table'),
      '',
    ].join('\n');
    const changes = blockChanges(blocks, blocksOf(body), () => 'generated');
    expect(changes.put.map((change) => [change.block.id, change.block.kind, change.at])).toEqual([
      ['blk-b', 'figure', undefined],
      ['blk-new', 'table', 2],
    ]);
    expect(changes.deleted.map((block) => block.id)).toEqual(['blk-c']);
    expect(changes.order).toEqual(['blk-b', 'blk-a', 'blk-new']);
  });

  it('keeps text typed above the first marker, and makes a repeated marker a new block', () => {
    const body = `Lead line\n${bodyOf(blocks.slice(0, 1))}${markerLine('blk-a', 'text')}\nCopy\n`;
    const read = blocksOf(body);
    expect(read[0].source.startsWith('Lead line\n\\section{Results}')).toBe(true);
    expect(read[1]).toEqual({ id: '', kind: 'text', source: 'Copy' });
  });
});

describe('position marks', () => {
  it('marks lines of running text and floats, and nothing in braces, math, tables or after a glued comment', () => {
    const body = [
      'A paragraph starts here', // 1: text
      'and goes on.', // 2: text
      '\\textbf{bold', // 3: command
      'still inside braces}', // 4: depth 1
      '$x +', // 5: math starts
      'y$ and more', // 6: inside math
      '\\begin{figure*}[t]', // 7: float begin
      '\\centering', // 8
      '\\end{figure*}', // 9: float end
      '\\begin{tabular}{lc}', // 10
      'Cell & 1 \\\\', // 11: inside tabular
      '\\end{tabular}', // 12
      'word%', // 13: glued comment
      'joined', // 14: not marked
      '(In parentheses) text', // 15: text
    ].join('\n');
    const marked = withMarks(body).split('\n');
    expect(marked[0]).toBe('\\leavevmode\\galleytext{1}A paragraph starts here');
    expect(marked[1]).toBe('\\leavevmode\\galleytext{2}and goes on.');
    expect(marked[3]).toBe('still inside braces}');
    expect(marked[5]).toBe('y$ and more');
    expect(marked[6]).toBe('\\begin{figure*}[t]\\galleyfloat{7}');
    expect(marked[8]).toBe('\\galleyend{9}\\end{figure*}');
    expect(marked[10]).toBe('Cell & 1 \\\\');
    expect(marked[13]).toBe('joined');
    expect(marked[14]).toBe('\\leavevmode\\galleytext{15}(In parentheses) text');
    expect(marked.length).toBe(15);
  });

  it('puts the body where the document says, with the bibliography when asked', () => {
    const doc = fullDocument('\\documentclass{article}\n\\usepackage[T1]{fontenc}', 'Text.', { style: 'plainnat', file: 'references.bib' });
    const lines = doc.main.split('\n');
    expect(lines[doc.bodyStart - 1]).toBe('\\leavevmode\\galleytext{1}Text.');
    expect(lines[doc.preambleStart - 1]).toBe('\\documentclass{article}');
    expect(doc.main).toContain('\\bibliographystyle{plainnat}\n\\bibliography{references}\n\\end{document}');
  });

  it('reads main.gpos in PDF points', () => {
    const [mark] = parseMarks('L 3 1 4736286 38427457 229.5pt\n');
    expect(mark.kind).toBe('L');
    expect(mark.line).toBe(3);
    expect(mark.x).toBeCloseTo(72, 0);
    expect(mark.y).toBeCloseTo(584.17, 1);
  });
});

describe('from the PDF to the source', () => {
  // Two columns on a 612 pt wide page; a figure across the top of the left column.
  const marks: Mark[] = [
    { kind: 'B', line: 20, page: 1, x: 72, y: 700, width: 220 },
    { kind: 'E', line: 24, page: 1, x: 72, y: 560, width: 220 },
    { kind: 'L', line: 3, page: 1, x: 72, y: 540, width: 220 },
    { kind: 'L', line: 4, page: 1, x: 150, y: 528, width: 220 },
    { kind: 'L', line: 6, page: 1, x: 320, y: 700, width: 220 },
    { kind: 'L', line: 7, page: 1, x: 400, y: 688, width: 220 },
    { kind: 'L', line: 9, page: 2, x: 72, y: 700, width: 220 },
  ];
  const at = (x: number, baseline: number, page = 1) => locate(marks, { page, x, y: baseline + 3, baseline, pageWidth: 612 })?.line;

  it('finds the mark before a click in reading order, column by column', () => {
    expect(at(200, 540)).toBe(3);
    expect(at(100, 528)).toBe(3);
    expect(at(200, 528)).toBe(4);
    expect(at(200, 400)).toBe(4);
    // The top of the right column goes on from the end of the left one until its own first mark.
    expect(at(500, 700)).toBe(6);
    expect(at(330, 712)).toBe(4);
    expect(at(100, 700, 2)).toBe(9);
  });

  it('sends a click on a float to its first line', () => {
    expect(locate(marks, { page: 1, x: 150, y: 620, pageWidth: 612 })).toEqual({ line: 20, until: 24 });
  });

  it('finds the clicked word near the line, not in command names, across hyphens and ligatures', () => {
    const lines = ['\\section{Results}', 'See \\ref{fig:a} for the ref values.', 'Made-up words: refined, results.'];
    expect(findWord(lines, 2, 3, 'ref', 'See Figure 1 for the ref values.')).toEqual({ line: 2, start: 24, end: 27 });
    expect(findWord(lines, 1, 3, 'Results')).toEqual({ line: 1, start: 9, end: 16 });
    // A word split at the end of a PDF line, and ligatures, still find the word in the source.
    expect(findWord(lines, 3, 3, 'fine-')).toEqual({ line: 3, start: 17, end: 21 });
    expect(findWord(lines, 3, 3, 'reﬁned')).toEqual({ line: 3, start: 15, end: 22 });
  });

  it('goes the other way, from a line to its place in the PDF', () => {
    expect(placeOf(marks, 5)?.line).toBe(4);
    expect(placeOf(marks, 21)?.line).toBe(20);
  });

  it('lists the headings for the outline', () => {
    expect(headingsOf('\\section{Results}\n% \\section{Not this}\n\\subsection*{The $x$ ablation}')).toEqual([
      { line: 1, level: 0, title: 'Results' },
      { line: 3, level: 1, title: 'The x ablation' },
    ]);
  });
});

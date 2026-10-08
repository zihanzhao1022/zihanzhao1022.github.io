import { describe, expect, it } from 'vitest';
import { parseTable, serializeTable } from './latex';
import { createTable, mergeCells } from './model';
import type { TableModel } from './types';

function parse(source: string, preamble?: string): TableModel {
  const result = parseTable(source, preamble);
  if (!result.ok) throw new Error(result.reason);
  return result.table;
}
function withoutCache(source: string): string { return source.slice(0, source.lastIndexOf('\n% portfolio-table:v1 ')); }

describe('safe LaTeX table conversion', () => {
  it('imports booktabs, caption, labels and column alignments', () => {
    const table = parse(String.raw`\begin{table}[t]
\centering
\caption{A {nested} caption}\label{tab:one}
\begin{tabular}{lcr}
\toprule
Method & Score & Value \\
\midrule
A & $1 \pm 2$ & 3 \\
\bottomrule
\end{tabular}
\end{table}`);
    expect(table.cells.map(r => r.map(c => c?.text))).toEqual([['Method', 'Score', 'Value'], ['A', '$1 \\pm 2$', '3']]);
    expect(table.cells[0].map(c => c?.align)).toEqual(['l', 'c', 'r']);
    expect(table.caption).toBe('A {nested} caption');
    expect(table.label).toBe('tab:one');
    expect(table.cells[0][0]?.borders.top).toBe(true);
    expect(table.cells[1][0]?.borders.bottom).toBe(true);
    const generated = serializeTable(table);
    expect(generated.match(/\\caption\{/g)).toHaveLength(1);
    expect(generated.match(/\\label\{/g)).toHaveLength(1);
    expect(parse(generated)).toEqual(table);
  });

  it('preserves escaped delimiters, braces, math, nested linebreaks and comments', () => {
    const table = parse(String.raw`\begin{tabular}{cc}
\makecell{one \\ two \& three} & $\frac{a}{b}$ \\
% fake & \\ \end{tabular}
text \& more & value % a comment with & and \\
\\
\end{tabular}`);
    expect(table.cells).toHaveLength(2);
    expect(table.cells[0][0]?.text).toBe(String.raw`\makecell{one \\ two \& three}`);
    expect(table.cells[1][1]?.text).toContain('% a comment with & and \\\\');
    expect(parse(serializeTable(table))).toEqual(table);
    const reparsed = parse(withoutCache(serializeTable(table)));
    expect(reparsed.cells[1][1]?.text).toBe(table.cells[1][1]?.text);
  });

  it('recognizes RGB/HTML colors and the ICLR orange-blue mix', () => {
    const table = parse(String.raw`\begin{tabular}{ccc}
\cellcolor{heatredmid!50!white}A & \cellcolor[HTML]{5c8ede}B & \cellcolor[RGB]{78,66,186}C \\
\end{tabular}`);
    expect(table.cells[0].map(c => c?.background)).toEqual(['#F9CB9E', '#5C8EDE', '#4E42BA']);
    const custom = parse(String.raw`\begin{tabular}{c}\cellcolor{custom!25!white}x\end{tabular}`, String.raw`\definecolor{custom}{RGB}{0,0,0}`);
    expect(custom.cells[0][0]?.background).toBe('#BFBFBF');
    expect(parseTable(String.raw`\begin{tabular}{c}\cellcolor{unknown}x\end{tabular}`).ok).toBe(false);
  });

  it('imports common positive multirow placeholders and multicolumn', () => {
    const table = parse(String.raw`\begin{tabular}{|l|c|c|}
\hline
\multirow{2}{*}{Shared} & \multicolumn{2}{c|}{Heading} \\
\cline{2-3}
 & a & b \\
\hline
\end{tabular}`);
    expect(table.cells[0][0]?.rowSpan).toBe(2);
    expect(table.cells[0][1]?.colSpan).toBe(2);
    expect(table.cells[1][0]).toBeNull();
    expect(table.cells[0][2]).toBeNull();
    expect(parse(serializeTable(table))).toEqual(table);
    const edited = parse(withoutCache(serializeTable(table)).replace('{Shared\n}', '{Updated\n}'));
    expect(edited.cells[0][0]?.text).toBe('Updated');
    expect(edited.cells[0][0]?.rowSpan).toBe(2);
  });

  it('generates colored multirow content in the final row so subsequent fills cannot cover text', () => {
    let table = createTable(3, 3);
    table.cells[0][0]!.text = 'Merged';
    table.cells[0][0]!.background = '#4E42BA';
    table = mergeCells(table, { start: { row: 0, col: 0 }, end: { row: 2, col: 1 } });
    const source = serializeTable(table);
    expect(source).toContain('\\multirow{-3}{*}{\\textcolor[HTML]{FFFFFF}{Merged');
    expect(source.match(/\\cellcolor\[HTML\]\{4E42BA\}/g)).toHaveLength(3);
    const reparsed = parse(withoutCache(source));
    expect(reparsed.cells[0][0]?.text).toBe('Merged');
    expect(reparsed.cells[0][0]?.rowSpan).toBe(3);
    expect(reparsed.cells[0][0]?.colSpan).toBe(2);
    expect(reparsed.cells[2][1]).toBeNull();
    expect(source).toContain('>{\\arrayrulecolor[HTML]{4E42BA}\\relax}->');
    expect(reparsed.cells[0][0]?.borders.bottom).toBe(true);
    const changedFill = withoutCache(source).replace('{4E42BA}\\relax', '{000000}\\relax');
    expect(parseTable(changedFill).ok).toBe(false);
  });

  it('distinguishes a merged-cell fill from a border even when their colors match', () => {
    let table = createTable(2, 2);
    table.cells[0][0]!.text = 'Merged';
    table.cells[0][0]!.background = table.borderColor;
    table = mergeCells(table, { start: { row: 0, col: 0 }, end: { row: 1, col: 0 } });
    const reparsed = parse(withoutCache(serializeTable(table)));
    expect(reparsed.cells[0][0]?.rowSpan).toBe(2);
    expect(reparsed.cells[1][0]).toBeNull();
  });

  it('validates metadata against all generated source and honors hand edits', () => {
    const table = createTable(2, 2);
    table.cells[0][0]!.text = 'Original';
    const source = serializeTable(table);
    expect(parse(source)).toEqual(table);
    const edited = source.replace('{Original\n}', '{Hand edited\n}');
    expect(parse(edited).cells[0][0]?.text).toBe('Hand edited');
    const broken = source.replace('{Original\n}', '{\\multicolumn{bad}{c}{x}\n}');
    expect(parseTable(broken).ok).toBe(false);
    const appended = source + '\n% manually appended\nExtra content';
    expect(serializeTable(parse(appended))).toContain('Extra content');
  });

  it('renders visual line breaks and recovers them without cached metadata', () => {
    const table = createTable(1, 1);
    table.cells[0][0]!.text = 'First line\n$1 \\pm 2$\nThird line';
    const source = serializeTable(table);
    expect(source).toContain('\\shortstack[c]{First line \\\\ $1 \\pm 2$ \\\\ Third line');
    expect(parse(withoutCache(source)).cells[0][0]?.text).toBe(table.cells[0][0]?.text);
  });

  it('roundtrips individual borders, global line style, bold, captions and short captions', () => {
    const table = parse(String.raw`\begin{table}\caption[Short]{Long}\label{old}\begin{tabular}{cc}a&b\end{tabular}\end{table}`);
    table.cells[0][0]!.borders = { top: true, right: false, bottom: false, left: true };
    table.cells[0][1]!.bold = true;
    table.borderWidth = 1.7; table.borderColor = '#663399';
    table.caption = 'New caption'; table.label = 'tab:new';
    const source = serializeTable(table);
    expect(source).toContain('\\setlength{\\arrayrulewidth}{1.7pt}');
    expect(source).toContain('\\arrayrulecolor[HTML]{663399}');
    expect(source).toContain('\\caption[Short]{New caption');
    expect(parse(source)).toEqual(table);
    expect(parse(withoutCache(source)).caption.trim()).toBe('New caption');
    expect(serializeTable(parse(withoutCache(source))).match(/portfolio-table-style/g)).toHaveLength(1);
  });

  it('retains p column widths when converting and resizing later', () => {
    const table = parse(String.raw`\begin{tabular}{p{3cm}r}Text & 12\end{tabular}`);
    expect(table.columnSpecs).toEqual(['p{3cm}', 'r']);
    expect(serializeTable(table)).toContain('\\multicolumn{1}{p{3cm}}');
  });

  it.each([
    String.raw`\begin{tabularx}{\linewidth}{XX}a&b\end{tabularx}`,
    String.raw`\begin{tabular}{>{\foo}cc}a&b\end{tabular}`,
    String.raw`\begin{tabular}{cc}a&b\\[3pt]c&d\end{tabular}`,
    String.raw`\begin{tabular}{cc}a&b\\\addlinespace c&d\end{tabular}`,
    String.raw`\begin{tabular}{cc}a&b&c\end{tabular}`,
    String.raw`\begin{tabular}{c}\begin{tabular}{c}x\end{tabular}\end{tabular}`,
    String.raw`\begin{tabular}{cc}\multirow{2}{*}{x}&a\\\hline &b\end{tabular}`,
    String.raw`\begin{tabular}{cc}\multicolumn{2}{c}{x}\\\cline{1-1}a&b\end{tabular}`,
    String.raw`\begin{tabular}{||c|}a\end{tabular}`,
  ])('rejects unsupported or destructive conversions (%s)', source => {
    const result = parseTable(source);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(5);
  });
});

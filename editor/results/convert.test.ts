import { describe, expect, it } from 'vitest';
import { ResultBlock, ResultPaper } from '../../types';
import { captionAndLabel, convertedBlock, convertedSource, filesKeptVersionsUse, switchedOp } from './convert';
import { applyResultsOp } from './ops';
import { parseTable } from './table/latex';

const figure = String.raw`\begin{figure}[t]
\centering
\includegraphics[width=\linewidth]{made-up-plot}
% \caption{An old caption}
\caption{Accuracy of the made-up methods, $k=3$.}
\label{fig:made-up}
\end{figure}`;

describe('captionAndLabel', () => {
  it("reads the float's caption and label, not commented ones", () => {
    expect(captionAndLabel(figure)).toEqual({ caption: 'Accuracy of the made-up methods, $k=3$.', label: 'fig:made-up' });
  });

  it("takes the whole figure's caption after subfigures, with the label that follows it", () => {
    const sub = String.raw`\begin{figure}
\begin{subfigure}{.5\linewidth}\includegraphics{a}\caption{Left}\label{fig:a}\end{subfigure}
\caption[Short]{Both {\em sides}}\label{fig:both}
\end{figure}`;
    expect(captionAndLabel(sub)).toEqual({ caption: 'Both {\\em sides}', label: 'fig:both' });
    expect(captionAndLabel('\\begin{table}\\label{tab:x}\\caption{Above}\\end{table}')).toEqual({ caption: 'Above', label: 'tab:x' });
    expect(captionAndLabel('no float here')).toEqual({});
  });
});

describe('convertedSource', () => {
  it('starts a table the visual editor opens, keeping the caption and label', () => {
    const table = convertedSource(figure, 'table');
    expect(table).toContain('\\begin{tabular}');
    expect(table).toContain('\\label{fig:made-up}');
    const parsed = parseTable(table);
    expect(parsed.ok && parsed.table.caption).toBe('Accuracy of the made-up methods, $k=3$.');
  });

  it('starts a figure waiting for its image, keeping the caption and label', () => {
    const tex = convertedSource('\\begin{table}\\caption{Made-up scores}\\label{tab:scores}\\begin{tabular}{l}x\\end{tabular}\\end{table}', 'figure');
    expect(tex).toMatch(/^\\begin\{figure\}/);
    expect(tex).toContain('\\caption{Made-up scores}');
    expect(tex).toContain('\\label{tab:scores}');
    expect(tex).not.toContain('tabular');
    expect(convertedSource('', 'figure')).toContain('\\caption{Caption.}');
  });
});

describe('convertedBlock', () => {
  const output = { pdf: 'results/p/f-00000000.pdf', width: 1, height: 1 };
  const block: ResultBlock = { id: 'f', kind: 'figure', source: figure, hidden: true, output };
  const myTable = String.raw`\begin{table}\begin{tabular}{l}made-up\end{tabular}\caption{Mine}\label{tab:mine}\end{table}`;
  const tableOutput = { pdf: 'results/p/f-11111111.pdf', width: 1, height: 1 };

  it('starts the other kind the first time and keeps the figure with its PDF', () => {
    expect(convertedBlock(block, 'table')).toEqual({
      id: 'f',
      kind: 'table',
      hidden: true,
      source: convertedSource(figure, 'table'),
      alternate: { kind: 'figure', source: figure, output },
    });
  });

  it('goes back and forth between the kept versions and their PDFs without losing either', () => {
    // The owner wrote their own table in place of the starting one, and saving compiled it.
    const saved: ResultBlock = { ...convertedBlock(block, 'table'), source: myTable, output: tableOutput };
    const back = convertedBlock(saved, 'figure');
    expect(back).toEqual({ id: 'f', kind: 'figure', hidden: true, source: figure, output, alternate: { kind: 'table', source: myTable, output: tableOutput } });
    expect(convertedBlock(back, 'table')).toEqual(saved);
  });

  it('leaves a block that already is that kind, or a text block, as it is', () => {
    expect(convertedBlock(block, 'figure')).toBe(block);
    const text: ResultBlock = { id: 't', kind: 'text', source: 'Plain.' };
    expect(convertedBlock(text, 'table')).toBe(text);
  });

  describe('switchedOp', () => {
    it('shows the kept version with its PDF at once, keeping the one it replaces', () => {
      const saved: ResultBlock = { ...convertedBlock(block, 'table'), source: myTable, output: tableOutput };
      const paper: ResultPaper = { id: 'p', slug: 'p', title: 'Made-up', authors: [], blocks: [saved] };
      const [after] = applyResultsOp([paper], switchedOp('p', saved)!);
      expect(after.blocks).toEqual([{ id: 'f', kind: 'figure', hidden: true, source: figure, output, alternate: { kind: 'table', source: myTable, output: tableOutput } }]);
    });

    it('leaves the PDF to the rebuild when the kept version was never compiled, and needs a kept version', () => {
      const restored: ResultBlock = { id: 'f', kind: 'figure', source: figure, output, alternate: { kind: 'table', source: myTable } };
      expect(switchedOp('p', restored)).toEqual({
        kind: 'putBlock',
        paperId: 'p',
        block: { id: 'f', kind: 'table', source: myTable, alternate: { kind: 'figure', source: figure, output } },
      });
      expect(switchedOp('p', { id: 'g', kind: 'figure', source: figure })).toBeNull();
    });
  });
});

describe('filesKeptVersionsUse', () => {
  it("finds attachments only a block's kept version uses, by name with or without extension", () => {
    const blocks: ResultBlock[] = [
      { id: 'x', kind: 'text', source: '\\includegraphics{shown-plot}' },
      { id: 't', kind: 'table', source: '% made-up', alternate: { kind: 'figure', source: '\\includegraphics[width=\\linewidth]{made-up-plot}' } },
      { id: 'u', kind: 'table', source: '% made-up', alternate: { kind: 'figure', source: '% \\includegraphics{commented.png}' } },
    ];
    expect(filesKeptVersionsUse(blocks, ['made-up-plot.pdf', 'shown-plot.png', 'commented.png', 'style.sty'])).toEqual([{ name: 'made-up-plot.pdf', n: 2 }]);
  });
});

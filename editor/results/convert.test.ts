import { describe, expect, it } from 'vitest';
import { captionAndLabel, convertedSource } from './convert';
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

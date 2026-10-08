import { describe, expect, it } from 'vitest';
import { exportTex, preambleNames, requiredPackages } from './texNames';

describe('preambleNames', () => {
  it('collects defined commands and colors, ignoring comments', () => {
    const preamble = [
      '\\newcommand{\\sd}[1]{{\\tiny\\textcolor{gray}{$\\pm#1$}}}',
      '\\newcommand\\tbd{--}',
      '\\renewcommand*{\\best}[1]{\\textbf{#1}}',
      '\\DeclareMathOperator{\\Var}{Var}',
      '\\def\\ours{Ours}',
      '\\definecolor{safegreen}{RGB}{47,133,90}',
      '\\colorlet{safegreenbg}{safegreen!12!white}',
      '% \\newcommand{\\hidden}{x}',
    ].join('\n');
    expect(preambleNames(preamble)).toEqual({
      macros: ['Var', 'best', 'ours', 'sd', 'tbd'],
      colors: ['safegreen', 'safegreenbg'],
    });
  });
});

describe('requiredPackages', () => {
  it('names the packages a table needs', () => {
    const source = '\\begin{tabular}{lc}\\toprule \\multirow{2}{*}{A} & \\cellcolor{red!10}1 \\\\ \\bottomrule\\end{tabular}';
    expect(requiredPackages(source)).toEqual(['\\usepackage{booktabs}', '\\usepackage{multirow}', '\\usepackage[table]{xcolor}']);
  });

  it('uses plain xcolor for text colors and ignores comments', () => {
    expect(requiredPackages('\\textcolor{red}{x} % \\toprule')).toEqual(['\\usepackage{xcolor}']);
    expect(requiredPackages('plain text')).toEqual([]);
  });
});

describe('exportTex', () => {
  it('puts the packages first as comments', () => {
    expect(exportTex('\\toprule\n\n')).toBe('% Requires:\n% \\usepackage{booktabs}\n\\toprule\n');
    expect(exportTex('plain')).toBe('plain\n');
  });
});

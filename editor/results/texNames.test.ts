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
  it('includes packages for merged visual cells, partial rules and colored borders', () => {
    const source = String.raw`\arrayrulecolor[HTML]{663399}
\begin{tabular}{|c|c|}
\hhline{|--|}
\multirow{2}{*}{Merged} & 42 \\
\hhline{|~-|}
& 51 \\
\hhline{|--|}
\end{tabular}`;
    expect(requiredPackages(source)).toEqual([
      '\\usepackage{multirow}', '\\usepackage{hhline}', '\\usepackage[table]{xcolor}',
    ]);
    expect(exportTex(source)).toContain('% \\usepackage[table]{xcolor}');
    expect(exportTex(source)).toContain('% \\usepackage{hhline}');
  });

  it('exports array support for custom paragraph alignment and column types', () => {
    expect(requiredPackages(String.raw`\begin{tabular}{>{\raggedright\arraybackslash}p{3cm}}A\end{tabular}`)).toEqual(['\\usepackage{array}']);
    expect(requiredPackages(String.raw`\newcolumntype{L}{>{\raggedright\arraybackslash}p{3cm}}`)).toEqual(['\\usepackage{array}']);
  });

  it('exports xcolor for explicit definitions and upgrades it once when a table color is used', () => {
    const colors = String.raw`\definecolor{heatredmid}{RGB}{242,150,60}
\colorlet{heatshade}{heatredmid!30!white}`;
    expect(requiredPackages(colors)).toEqual(['\\usepackage{xcolor}']);
    expect(requiredPackages(`${colors}\n\\cellcolor{heatshade}42`)).toEqual(['\\usepackage[table]{xcolor}']);
    expect(requiredPackages(String.raw`50\% % \arrayrulecolor{red} \hhline{--} \definecolor{a}{RGB}{0,0,0}`)).toEqual([]);
  });

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
  it('omits the visual editor cache when exporting manuscript code', () => {
    expect(exportTex('\\toprule\n% portfolio-table:v1 %7Bcache%7D')).toBe('% Requires:\n% \\usepackage{booktabs}\n\\toprule\n');
  });
  it('puts the packages first as comments', () => {
    expect(exportTex('\\toprule\n\n')).toBe('% Requires:\n% \\usepackage{booktabs}\n\\toprule\n');
    expect(exportTex('plain')).toBe('plain\n');
  });
});

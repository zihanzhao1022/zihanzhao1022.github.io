import { stripComments } from '../tex/document';

/** Commands and colors a preamble defines, for completion in the code editor. */
export function preambleNames(preamble: string): { macros: string[]; colors: string[] } {
  const text = stripComments(preamble);
  const macros = new Set<string>();
  for (const match of text.matchAll(/\\(?:re)?newcommand\*?\s*\{?\\([A-Za-z]+)|\\(?:providecommand|DeclareRobustCommand|DeclareMathOperator)\*?\s*\{?\\([A-Za-z]+)|\\def\\([A-Za-z]+)/g)) {
    macros.add(match[1] ?? match[2] ?? match[3]);
  }
  const colors = new Set<string>();
  for (const match of text.matchAll(/\\(?:definecolor|colorlet)\s*\{([^}]+)\}/g)) colors.add(match[1].trim());
  return { macros: [...macros].sort(), colors: [...colors].sort() };
}

const PACKAGES: { name: string; test: RegExp }[] = [
  { name: 'booktabs', test: /\\(?:toprule|midrule|bottomrule|cmidrule|addlinespace|specialrule)\b/ },
  { name: 'multirow', test: /\\multirow\b/ },
  { name: 'makecell', test: /\\(?:makecell|thead)\b/ },
  { name: 'tabularx', test: /\\begin\{tabularx\}/ },
  { name: 'graphicx', test: /\\(?:includegraphics|resizebox|rotatebox|scalebox)\b/ },
  { name: 'amsmath', test: /\\(?:text|eqref|boldsymbol)\b|\\begin\{(?:align|gather|multline)\*?\}/ },
  { name: 'siunitx', test: /\\(?:SI|si|num|sisetup)\b/ },
];

/** \usepackage lines a piece of LaTeX needs, judged from the commands it uses. */
export function requiredPackages(source: string): string[] {
  const text = stripComments(source);
  const lines = PACKAGES.filter((item) => item.test.test(text)).map((item) => `\\usepackage{${item.name}}`);
  if (/\\(?:cellcolor|rowcolor|rowcolors)\b/.test(text)) lines.push('\\usepackage[table]{xcolor}');
  else if (/\\(?:textcolor|color|colorbox)\b/.test(text)) lines.push('\\usepackage{xcolor}');
  return lines;
}

/** The block's source for pasting into a paper, headed by the packages it needs as comments. */
export function exportTex(source: string): string {
  const packages = requiredPackages(source);
  const head = packages.length > 0 ? `% Requires:\n${packages.map((line) => `% ${line}`).join('\n')}\n` : '';
  return `${head}${source.replace(/\s+$/, '')}\n`;
}

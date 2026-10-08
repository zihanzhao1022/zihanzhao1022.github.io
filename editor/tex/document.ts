/** Wraps one block of LaTeX into a complete document that compiles to a single tightly cropped page. */

export type BlockKind = 'text' | 'figure' | 'table';

/** Preamble for new papers; the owner usually pastes the paper's own. */
export const DEFAULT_PREAMBLE = String.raw`\documentclass{article}
\usepackage{times}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage[table]{xcolor}
\usepackage{booktabs,multirow,makecell,array,tabularx}`;

/** Where the preamble and the block sit in main.tex (1-based lines), for mapping TeX's line numbers back. */
export interface DocLines {
  preambleStartLine: number;
  preambleLineCount: number;
  sourceStartLine: number;
  sourceLineCount: number;
}

export interface BlockDoc extends DocLines {
  main: string;
  aux: string;
}

export interface BlockDocInput {
  preamble: string;
  source: string;
  kind: BlockKind;
  /** Counter values at the end of the previous block. */
  counters?: Record<string, number>;
  /** Labels defined by the page's blocks: name → the second argument of \newlabel. */
  labels?: Record<string, string>;
}

// Reset by LaTeX itself or meaningless across blocks.
const SKIPPED_COUNTERS = new Set(['page', 'enumi', 'enumii', 'enumiii', 'enumiv', 'mpfootnote']);
const COUNTER_NAME = /^[A-Za-z@]+$/;

// Floats become minipages so they sit inside the cropped box; \caption still numbers them.
// At the end every counter (the list \include checkpoints) goes to the log for the next block.
const SUPPORT = String.raw`\makeatletter
\usepackage[active,tightpage]{preview}
\setlength\PreviewBorder{2pt}
\def\results@float#1{\def\@captype{#1}\par\noindent\begin{minipage}{\linewidth}}
\def\endresults@float{\end{minipage}\par}
\renewenvironment{table}[1][]{\results@float{table}}{\endresults@float}
\renewenvironment{table*}[1][]{\results@float{table}}{\endresults@float}
\renewenvironment{figure}[1][]{\results@float{figure}}{\endresults@float}
\renewenvironment{figure*}[1][]{\results@float{figure}}{\endresults@float}
\newlength\results@parindent
\newskip\results@parskip
\def\results@capture{\setlength\results@parindent{\parindent}\setlength\results@parskip{\parskip}}
\def\results@restorepar{\setlength\parindent{\results@parindent}\setlength\parskip{\results@parskip}}
\def\results@counter#1{\typeout{RESULTS-COUNTER:#1=\the\value{#1}}}
\AtEndDocument{\begingroup\let\@elt\results@counter\cl@@ckpt\endgroup}
\makeatother`;

/** Removes % comments, keeping escaped \%. */
export const stripComments = (tex: string): string => tex.replace(/(^|[^\\])%.*$/gm, '$1');

/**
 * \PassOptionsToPackage lines for every package the preamble loads with options. LaTeX 2020 reports an
 * option clash when a package is loaded again with new options (or was loaded earlier by a class or
 * style file); passing all options before \documentclass avoids that.
 */
export function passOptionsLines(preamble: string): string[] {
  const options = new Map<string, string[]>();
  for (const match of stripComments(preamble).matchAll(/\\usepackage\s*\[([^\]]*)\]\s*\{([^}]*)\}/g)) {
    const given = match[1].split(',').map((option) => option.trim()).filter(Boolean);
    for (const name of match[2].split(',').map((item) => item.trim()).filter(Boolean)) {
      const list = options.get(name) ?? [];
      for (const option of given) if (!list.includes(option)) list.push(option);
      options.set(name, list);
    }
  }
  return [...options].filter(([, list]) => list.length > 0).map(([name, list]) => `\\PassOptionsToPackage{${list.join(',')}}{${name}}`);
}

const auxFor = (labels: Record<string, string>): string =>
  [
    '\\relax',
    '\\providecommand\\hyper@newdestlabel[2]{}',
    ...Object.entries(labels).map(([name, value]) => `\\newlabel{${name}}{${value}}`),
    '',
  ].join('\n');

export function buildBlockDocument({ preamble, source, kind, counters = {}, labels = {} }: BlockDocInput): BlockDoc {
  const ownPreamble = preamble.replace(/\s+$/, '');
  const head = passOptionsLines(ownPreamble);
  if (!/\\documentclass/.test(stripComments(ownPreamble))) head.push('\\documentclass{article}');
  const preambleStartLine = head.length + 1;
  const preambleLineCount = ownPreamble.split('\n').length;

  const restore = Object.entries(counters)
    .filter(([name, value]) => COUNTER_NAME.test(name) && !SKIPPED_COUNTERS.has(name) && Number.isFinite(value))
    .map(([name, value]) => `\\@ifundefined{c@${name}}{}{\\setcounter{${name}}{${Math.trunc(value)}}}`);
  const width = /\\begin\{(?:table|figure)\*\}/.test(source) ? '\\textwidth' : '\\columnwidth';
  const body = source.replace(/\s+$/, '');

  const before = [
    ...head,
    ownPreamble,
    SUPPORT,
    '\\begin{document}',
    '\\makeatletter',
    ...restore,
    '\\results@capture',
    '\\makeatother',
    `\\begin{preview}\\begin{minipage}{${width}}${kind === 'text' ? '\\results@restorepar' : ''}`,
  ].join('\n');
  const main = `${before}\n${body}\n\\end{minipage}\\end{preview}\n\\end{document}\n`;
  return {
    main,
    aux: auxFor(labels),
    preambleStartLine,
    preambleLineCount,
    sourceStartLine: before.split('\n').length + 1,
    sourceLineCount: body.split('\n').length,
  };
}

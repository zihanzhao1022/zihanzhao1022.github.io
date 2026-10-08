/** Wraps one block of LaTeX into a complete document that compiles to a single tightly cropped page. */

export type BlockKind = 'text' | 'figure' | 'table';

/** Preamble for new papers; the owner usually pastes the paper's own. */
export const DEFAULT_PREAMBLE = String.raw`\documentclass{article}
\usepackage{times}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage[table]{xcolor}
\usepackage{booktabs,multirow,makecell,array,tabularx,hhline}`;

/**
 * Text blocks are set as wide as the site's column (about 920 px at the page's PDF scale), not at the paper's
 * column width: they are notes for the web page. Tables and figures keep the paper's widths.
 */
export const TEXT_WIDTH = '550pt';

/** Changes whenever the wrapper's output changes, so stored PDFs made by an older wrapper count as stale. */
export const WRAPPER_VERSION = 5;

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
  /**
   * Labels defined by the page's blocks: name → the contents of \newlabel's second argument, without its
   * outer braces. Parsing `\newlabel{name}{{1}{1}{}{table.1}{}}` from an .aux file gives `{1}{1}{}{table.1}{}`;
   * the aux file written here wraps the value back in one pair of braces.
   */
  labels?: Record<string, string>;
  /** The paper's bibliography: citation key → the contents of \bibcite's second argument, like labels. */
  citations?: Record<string, string>;
}

// Reset by LaTeX itself or meaningless across blocks.
const SKIPPED_COUNTERS = new Set(['page', 'enumi', 'enumii', 'enumiii', 'enumiv', 'mpfootnote']);
const COUNTER_NAME = /^[A-Za-z@0-9]+$/;

// Floats become minipages so they sit inside the cropped box; \caption still numbers them.
// At the end every counter (the list \include checkpoints) goes to the log for the next block.
const SUPPORT = String.raw`\makeatletter
% BibTeX styles such as plainnat otherwise fall back to texttt for URLs,
% which cannot typeset literal underscores in bibliography links.
\usepackage{url}
% Load after the paper's preamble so natbib and bibliography styles expose PDF links.
% A paper that already loads hyperref keeps its own link options and colors.
% Cropped blocks have no document outline, so disable bookmarks for this default.
\@ifpackageloaded{hyperref}{}{%
  \usepackage[bookmarks=false,colorlinks]{hyperref}%
  \hypersetup{allcolors={[rgb]{0.15,0.25,0.50}}}%
}
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

// Visual tables also work with a pasted paper preamble that does not load these packages.
// Loading colortbl explicitly avoids adding the `table` option to an already-loaded xcolor.
const TABLE_SUPPORT = String.raw`\makeatletter
\@ifpackageloaded{xcolor}{}{\usepackage{xcolor}}
\usepackage{colortbl,array,multirow,hhline}
\makeatother`;

/**
 * Removes % comments. A % after an odd number of backslashes is a literal percent sign and stays; after an
 * even number (`\\%`, a row end followed by a comment) it starts a comment.
 */
export const stripComments = (tex: string): string => tex.replace(/(^|[^\\])((?:\\\\)*)%.*$/gm, '$1$2');

/** Splits a comma list at the commas outside braces: `a={x,y},b` gives `a={x,y}` and `b`. */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const char = list[i];
    if (char === '{') depth++;
    else if (char === '}') depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) {
      parts.push(list.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(list.slice(start));
  return parts;
}

/**
 * \PassOptionsToPackage lines for every package the preamble loads with options. LaTeX 2020 reports an
 * option clash when a package is loaded again with new options (or was loaded earlier by a class or
 * style file); passing all options before \documentclass avoids that. Each result is a single line, so
 * the lines before \documentclass stay countable: whitespace inside an option (line breaks too) collapses.
 */
export function passOptionsLines(preamble: string): string[] {
  const options = new Map<string, string[]>();
  for (const match of stripComments(preamble).matchAll(/\\usepackage\s*\[([^\]]*)\]\s*\{([^}]*)\}/g)) {
    const given = splitTopLevel(match[1]).map((option) => option.replace(/\s+/g, ' ').trim()).filter(Boolean);
    for (const name of match[2].split(',').map((item) => item.trim()).filter(Boolean)) {
      const list = options.get(name) ?? [];
      for (const option of given) if (!list.includes(option)) list.push(option);
      options.set(name, list);
    }
  }
  return [...options].filter(([, list]) => list.length > 0).map(([name, list]) => `\\PassOptionsToPackage{${list.join(',')}}{${name}}`);
}

const auxFor = (labels: Record<string, string>, citations: Record<string, string>): string =>
  [
    '\\relax',
    '\\providecommand\\hyper@newdestlabel[2]{}',
    ...Object.entries(labels).map(([name, value]) => `\\newlabel{${name}}{${value}}`),
    // \cite reads these like a document whose bibliography was typeset in an earlier run.
    ...Object.entries(citations).map(([key, value]) => `\\bibcite{${key}}{${value}}`),
    '',
  ].join('\n');

export function buildBlockDocument({ preamble, source, kind, counters = {}, labels = {}, citations = {} }: BlockDocInput): BlockDoc {
  const ownPreamble = preamble.replace(/\s+$/, '');
  const head = passOptionsLines(ownPreamble);
  if (!/\\documentclass/.test(stripComments(ownPreamble))) head.push('\\documentclass{article}');
  const preambleStartLine = head.length + 1;
  const preambleLineCount = ownPreamble.split('\n').length;

  const restore = Object.entries(counters)
    .filter(([name, value]) => COUNTER_NAME.test(name) && !SKIPPED_COUNTERS.has(name) && Number.isFinite(value))
    .map(([name, value]) => `\\@ifundefined{c@${name}}{}{\\setcounter{${name}}{${Math.trunc(value)}}}`);
  const wide = /\\begin\{(?:table|figure)\*\}/.test(stripComments(source));
  const width = kind === 'text' ? TEXT_WIDTH : wide ? '\\textwidth' : '\\columnwidth';
  const body = source.replace(/\s+$/, '');
  // \makeatother comes first so the owner's block is read with normal catcodes. @ is then not a letter, so
  // `\results@restorepar` would read as `\results` followed by text; \csname builds the name from characters.
  const restorePar = kind === 'text' ? '\\csname results@restorepar\\endcsname' : '';

  const before = [
    ...head,
    ownPreamble,
    ...(kind === 'table' ? [TABLE_SUPPORT] : []),
    SUPPORT,
    '\\begin{document}',
    '\\makeatletter',
    ...restore,
    '\\results@capture',
    '\\makeatother',
    `\\begin{preview}\\begin{minipage}{${width}}${restorePar}`,
  ].join('\n');
  const main = `${before}\n${body}\n\\end{minipage}\\end{preview}\n\\end{document}\n`;
  return {
    main,
    aux: auxFor(labels, citations),
    preambleStartLine,
    preambleLineCount,
    sourceStartLine: before.split('\n').length + 1,
    sourceLineCount: body.split('\n').length,
  };
}

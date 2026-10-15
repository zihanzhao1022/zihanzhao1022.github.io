/**
 * The writing view: the paper as one LaTeX document, edited in place of the page's separate blocks.
 *
 * main.tex holds every block under a marker comment naming it, so edits go back to the blocks they belong to.
 * The whole document is compiled with marks at the start of its lines (pdfTeX's \pdfsavepos) that write where
 * those lines landed in the PDF; a double click in the PDF finds the nearest mark before it, then the clicked
 * word near that line. The engine has no SyncTeX, so this is its own, coarser version of it.
 */
import { passOptionsLines, stripComments } from '../../editor/tex/document';
import { ResultBlock, ResultBlockKind } from '../../types';

/* ------------------------------------------------------------------ main.tex and the blocks */

const MARKER = /^%% galley-block (\S+) (text|figure|table)\s*$/;

export const markerLine = (id: string, kind: ResultBlockKind): string => `%% galley-block ${id} ${kind}`;

export function readMarker(line: string): { id: string; kind: ResultBlockKind } | null {
  const match = MARKER.exec(line);
  return match ? { id: match[1], kind: match[2] as ResultBlockKind } : null;
}

// The visual table editor's cache line (editor/results/table/latex.ts) is not the owner's code.
const CACHE = /(^|\n)% portfolio-table:v1 [^\n]*/g;

/** A block's code as the writing view shows it. */
export const editableSource = (source: string): string => source.replace(CACHE, '$1').replace(/^\n+/, '').replace(/\s+$/, '');

/** main.tex for the writing view: each block under its marker line, in the page's order. */
export function bodyOf(blocks: ResultBlock[]): string {
  return `${blocks.map((block) => `${markerLine(block.id, block.kind)}\n${editableSource(block.source ?? '')}`).join('\n\n')}\n`;
}

export interface BodyBlock {
  id: string;
  kind: ResultBlockKind;
  source: string;
}

/** The blocks of an edited main.tex: what follows each marker line, up to the next. A repeated id is a new block. */
export function blocksOf(body: string): BodyBlock[] {
  const blocks: { id: string; kind: ResultBlockKind; lines: string[] }[] = [];
  const before: string[] = [];
  const seen = new Set<string>();
  for (const line of body.split('\n')) {
    const marker = readMarker(line);
    if (marker) {
      blocks.push({ id: seen.has(marker.id) ? '' : marker.id, kind: marker.kind, lines: [] });
      seen.add(marker.id);
    } else if (blocks.length > 0) blocks[blocks.length - 1].lines.push(line);
    else before.push(line);
  }
  const result = blocks.map((block) => ({ id: block.id, kind: block.kind, source: block.lines.join('\n').replace(/^\n+/, '').replace(/\s+$/, '') }));
  // Text typed above the first marker belongs to the first block.
  const lead = before.join('\n').trim();
  if (lead) {
    if (result.length > 0) result[0] = { ...result[0], source: `${lead}\n${result[0].source}`.replace(/\s+$/, '') };
    else result.push({ id: '', kind: 'text', source: lead });
  }
  return result;
}

/** The kind a new block gets from what it holds. */
export const kindOf = (source: string): ResultBlockKind =>
  /\\begin\{table\*?\}/.test(stripComments(source)) ? 'table' : /\\begin\{figure\*?\}/.test(stripComments(source)) ? 'figure' : 'text';

/** What changed between the page's blocks and an edited main.tex, block by block. */
export interface BlockChanges {
  /** Existing blocks whose code changed, and new blocks with where they go. */
  put: { block: ResultBlock; at?: number }[];
  deleted: ResultBlock[];
  /** The new order of the blocks, when it changed. */
  order?: string[];
}

export function blockChanges(stored: ResultBlock[], edited: BodyBlock[], newId: () => string): BlockChanges {
  const byId = new Map(stored.map((block) => [block.id, block]));
  const put: BlockChanges['put'] = [];
  const kept: string[] = [];
  edited.forEach((item, index) => {
    if (!item.source.trim()) return;
    const existing = item.id ? byId.get(item.id) : undefined;
    if (existing) {
      kept.push(existing.id);
      if (editableSource(existing.source ?? '') !== item.source) put.push({ block: { ...existing, source: item.source } });
      return;
    }
    // A block started in the writing view already has its id in its marker line.
    const block: ResultBlock = { id: item.id || newId(), kind: kindOf(item.source), source: item.source };
    kept.push(block.id);
    put.push({ block, at: index });
  });
  const deleted = stored.filter((block) => !kept.includes(block.id));
  const before = stored.map((block) => block.id).filter((id) => kept.includes(id));
  const after = kept.filter((id) => byId.has(id));
  const added = put.some((change) => change.at !== undefined);
  const order = added || before.join() !== after.join() ? kept : undefined;
  return { put, deleted, ...(order ? { order } : {}) };
}

/* ------------------------------------------------------------------ the whole document, with position marks */

const TEXT_ENVIRONMENTS = new Set([
  'document', 'abstract', 'itemize', 'enumerate', 'description', 'quote', 'quotation', 'verse', 'center', 'flushleft',
  'flushright', 'minipage', 'theorem', 'lemma', 'proposition', 'corollary', 'definition', 'remark', 'example', 'proof',
  'claim', 'conjecture', 'assumption', 'note',
]);
const FLOATS = new Set(['figure', 'figure*', 'table', 'table*']);
const VERBATIM = new Set(['verbatim', 'verbatim*', 'Verbatim', 'lstlisting', 'minted', 'comment']);
// A line that starts a word of running text: it would start a paragraph, or go on with one.
const TEXT_START = /^\s*[\p{L}\p{N}(`'"]/u;
const FLOAT_BEGIN = /^\s*\\begin\{(figure|table)(\*?)\}(\[[^\]]*\])?/;
const FLOAT_END = /^(\s*)\\end\{(figure|table)\*?\}/;

/**
 * main.tex with marks at the start of lines of running text (\galleytext) and inside floats at their beginning
 * and end (\galleyfloat, \galleyend), each naming its line. Marks go only where they cannot change the output:
 * in text environments, outside braces, math and verbatim, and never where a line goes on from a % comment.
 * Lines stay where they were, so TeX's line numbers still match main.tex.
 */
export function withMarks(body: string): string {
  const lines = body.split('\n');
  const environments: string[] = ['document'];
  let depth = 0;
  let math = false;
  let verbatim: string | null = null;
  let glued = false;
  return lines
    .map((line, index) => {
      const n = index + 1;
      if (verbatim) {
        if (line.includes(`\\end{${verbatim}}`)) {
          verbatim = null;
          environments.pop();
        }
        glued = false;
        return line;
      }
      const top = environments[environments.length - 1];
      const calm = depth === 0 && !math && !glued;
      let marked = line;
      if (calm && TEXT_ENVIRONMENTS.has(top) && TEXT_START.test(line)) {
        marked = line.replace(/^(\s*)/, `$1\\leavevmode\\galleytext{${n}}`);
      } else if (calm && TEXT_ENVIRONMENTS.has(top)) {
        const begin = FLOAT_BEGIN.exec(line);
        // `[t]` on a line of its own would read the mark as the float's contents.
        const nextLine = lines[index + 1] ?? '';
        if (begin && !(begin[3] === undefined && line.slice(begin[0].length).trim() === '' && /^\s*\[/.test(nextLine))) {
          marked = `${line.slice(0, begin[0].length)}\\galleyfloat{${n}}${line.slice(begin[0].length)}`;
        }
      } else if (calm && FLOATS.has(top)) {
        const end = FLOAT_END.exec(line);
        if (end) marked = `${end[1]}\\galleyend{${n}}${line.slice(end[1].length)}`;
      }
      ({ depth, math, verbatim, glued } = scan(line, environments, depth, math));
      return marked;
    })
    .join('\n');
}

/** Follows braces, math, environments and comments through one line of LaTeX. */
function scan(line: string, environments: string[], depth: number, math: boolean): { depth: number; math: boolean; verbatim: string | null; glued: boolean } {
  let verbatim: string | null = null;
  let glued = false;
  for (let i = 0; i < line.length; ) {
    const char = line[i];
    if (char === '\\') {
      const rest = line.slice(i);
      const begin = /^\\begin\s*\{([^}]*)\}/.exec(rest);
      if (begin) {
        const name = begin[1].trim();
        environments.push(name);
        i += begin[0].length;
        if (VERBATIM.has(name)) {
          if (rest.includes(`\\end{${name}}`)) environments.pop();
          else verbatim = name;
          break;
        }
        continue;
      }
      const end = /^\\end\s*\{([^}]*)\}/.exec(rest);
      if (end) {
        const at = environments.lastIndexOf(end[1].trim());
        if (at > 0) environments.length = at;
        i += end[0].length;
        continue;
      }
      const verb = /^\\verb\*?([^A-Za-z\s])/.exec(rest);
      if (verb) {
        const close = line.indexOf(verb[1], i + verb[0].length);
        i = close < 0 ? line.length : close + 1;
        continue;
      }
      if (rest.startsWith('\\(') || rest.startsWith('\\[')) math = true;
      else if (rest.startsWith('\\)') || rest.startsWith('\\]')) math = false;
      i += 2;
      continue;
    }
    if (char === '%') {
      // A comment glued to a word joins the next line to that word.
      glued = i > 0 && !/\s/.test(line[i - 1]);
      break;
    }
    if (char === '{') depth += 1;
    else if (char === '}') depth = Math.max(0, depth - 1);
    else if (char === '$') {
      if (line[i + 1] === '$') i += 1;
      math = !math;
    }
    i += 1;
  }
  return { depth, math, verbatim, glued };
}

// Each mark writes "kind line sheet x y width" to main.gpos when its page is shipped out: the page's number
// among those shipped, and where the mark is, in scaled points from the page's bottom left. The width (of a
// float, for its box) is taken where the mark is, the rest when the page is shipped.
const MARK_SUPPORT = String.raw`\makeatletter
\RequirePackage{atbegshi}
\newwrite\galley@marks
\immediate\openout\galley@marks=main.gpos
\newcount\galley@sheet
\AtBeginShipout{\global\advance\galley@sheet\@ne}
\def\galley@mark#1#2{\pdfsavepos\edef\galley@width{\the\linewidth}\expandafter\galley@write\expandafter{\galley@width}{#1}{#2}}
\def\galley@write#1#2#3{\write\galley@marks{#2 #3 \the\galley@sheet\space\the\pdflastxpos\space\the\pdflastypos\space#1}}
\protected\def\galleytext#1{\ifhmode\galley@mark{L}{#1}\fi}
\protected\def\galleyfloat#1{\galley@mark{B}{#1}}
\protected\def\galleyend#1{\galley@mark{E}{#1}}
\makeatother`;

export interface FullDocument {
  main: string;
  /** Lines of main.tex where the preamble and the writing view's main.tex begin (1-based). */
  preambleStart: number;
  preambleLines: number;
  bodyStart: number;
  bodyLines: number;
}

/** The paper as one document: its preamble, every block in order and, when it cites, its bibliography. */
export function fullDocument(preamble: string, body: string, bibliography: { style: string; file: string } | null): FullDocument {
  const own = preamble.replace(/\s+$/, '');
  const head = passOptionsLines(own);
  if (!/\\documentclass/.test(stripComments(own))) head.push('\\documentclass{article}');
  const before = [...head, own, MARK_SUPPORT, '\\begin{document}'];
  const text = body.replace(/\s+$/, '');
  const after = [...(bibliography ? [`\\bibliographystyle{${bibliography.style}}`, `\\bibliography{${bibliography.file.replace(/\.bib$/, '')}}`] : []), '\\end{document}', ''];
  const opening = before.join('\n');
  return {
    main: `${opening}\n${withMarks(text)}\n${after.join('\n')}`,
    preambleStart: head.length + 1,
    preambleLines: own.split('\n').length,
    bodyStart: opening.split('\n').length + 1,
    bodyLines: text.split('\n').length,
  };
}

/* ------------------------------------------------------------------ from the PDF back to the source */

export interface Mark {
  kind: 'L' | 'B' | 'E';
  line: number;
  /** 1-based page of the PDF. */
  page: number;
  /** In PDF points from the page's bottom left. */
  x: number;
  y: number;
  width: number;
}

// \pdflastxpos and \pdflastypos are scaled points; PDF points (big points) are 72 to TeX's 72.27 per inch.
const SP_TO_BP = 72 / 72.27 / 65536;

export function parseMarks(text: string): Mark[] {
  const marks: Mark[] = [];
  for (const row of text.split('\n')) {
    const match = /^([LBE]) (\d+) (\d+) (-?\d+) (-?\d+) (-?[\d.]+)pt/.exec(row.trim());
    if (!match) continue;
    marks.push({
      kind: match[1] as Mark['kind'],
      line: Number(match[2]),
      page: Number(match[3]),
      x: Number(match[4]) * SP_TO_BP,
      y: Number(match[5]) * SP_TO_BP,
      width: Number(match[6]) * (72 / 72.27),
    });
  }
  return marks;
}

export interface Hit {
  page: number;
  /** In PDF points from the page's bottom left; `baseline` is the clicked text's, when the click was on text. */
  x: number;
  y: number;
  baseline?: number;
  pageWidth: number;
}

export interface Located {
  line: number;
  /** Where to look for the clicked word: up to the next marked line, or across a float. */
  until: number;
}

/** The source line a click in the PDF came from: inside a float, its first line; else the nearest mark before it. */
export function locate(marks: Mark[], hit: Hit): Located | null {
  const onPage = marks.filter((mark) => mark.page === hit.page);
  // Floats: a begin mark, the end mark after it, and the box between them.
  for (const begin of onPage.filter((mark) => mark.kind === 'B')) {
    const end = onPage.filter((mark) => mark.kind === 'E' && mark.line > begin.line).sort((a, b) => a.line - b.line)[0];
    if (!end) continue;
    if (hit.x >= begin.x - 6 && hit.x <= begin.x + begin.width + 6 && hit.y <= begin.y + 6 && hit.y >= end.y - 6) return { line: begin.line, until: end.line };
  }
  const text = marks.filter((mark) => mark.kind === 'L');
  if (text.length === 0) return null;
  const half = hit.pageWidth / 2;
  const twoColumns = text.some((mark) => mark.page === hit.page && mark.x > half);
  const column = (x: number) => (twoColumns && x > half ? 1 : 0);
  const base = hit.baseline ?? hit.y - 3;
  // Reading order: page, then column, then down the page, then along the line.
  const before = (mark: Mark): boolean => {
    if (mark.page !== hit.page) return mark.page < hit.page;
    const a = column(mark.x);
    const b = column(hit.x);
    if (a !== b) return a < b;
    if (Math.abs(mark.y - base) <= 2) return mark.x <= hit.x + 1;
    return mark.y > base;
  };
  const order = (a: Mark, b: Mark): number => a.page - b.page || column(a.x) - column(b.x) || b.y - a.y || a.x - b.x;
  const sorted = [...text].sort(order);
  const earlier = sorted.filter(before);
  const found = earlier.length > 0 ? earlier[earlier.length - 1] : sorted[0];
  const next = text.filter((mark) => mark.line > found.line).sort((a, b) => a.line - b.line)[0];
  return { line: found.line, until: next ? next.line - 1 : found.line + 20 };
}

const words = (text: string): string[] => text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * Where the clicked word is in the source: the occurrence between `from` and `until` (1-based lines) whose
 * neighbourhood shares most words with the clicked line of the PDF, then a wider look around. Words inside
 * command names (the "ref" of \ref) do not count.
 */
export function findWord(lines: string[], from: number, until: number, word: string, context = ''): { line: number; start: number; end: number } | null {
  const target = word.normalize('NFKC').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (!target) return null;
  const nearby = new Set(words(context));
  const look = (first: number, last: number) => {
    let best: { line: number; start: number; end: number; score: number } | null = null;
    for (let n = Math.max(1, first); n <= Math.min(lines.length, last); n += 1) {
      const line = lines[n - 1];
      if (readMarker(line)) continue;
      const lower = line.toLowerCase();
      for (let at = lower.indexOf(target.toLowerCase()); at !== -1; at = lower.indexOf(target.toLowerCase(), at + 1)) {
        // Not part of a command's name.
        let back = at;
        while (back > 0 && /[A-Za-z]/.test(line[back - 1])) back -= 1;
        if (back > 0 && line[back - 1] === '\\') continue;
        const around = words(lines.slice(Math.max(0, n - 2), n + 1).join(' '));
        let score = around.filter((item) => nearby.has(item)).length;
        if (line.slice(at, at + target.length) === target) score += 0.5;
        // Closer to where the mark says the click came from wins a tie.
        score -= Math.abs(n - from) * 0.01;
        if (!best || score > best.score) best = { line: n, start: at, end: at + target.length, score };
      }
    }
    return best;
  };
  const found = look(from, until) ?? look(from - 8, until + 30);
  return found ? { line: found.line, start: found.start, end: found.end } : null;
}

/** Where a source line lands in the PDF: its own mark, or the nearest marked line before it. */
export function placeOf(marks: Mark[], line: number): Mark | null {
  const candidates = marks.filter((mark) => mark.kind !== 'E' && mark.line <= line).sort((a, b) => b.line - a.line);
  return candidates[0] ?? marks.filter((mark) => mark.kind !== 'E').sort((a, b) => a.line - b.line)[0] ?? null;
}

/** \section-level headings of main.tex, for the outline. */
export function headingsOf(body: string): { line: number; level: number; title: string }[] {
  const levels: Record<string, number> = { section: 0, subsection: 1, subsubsection: 2 };
  const found: { line: number; level: number; title: string }[] = [];
  body.split('\n').forEach((line, index) => {
    const match = /^\s*\\(section|subsection|subsubsection)\*?\s*(?:\[[^\]]*\])?\s*\{(.*)\}/.exec(stripComments(line));
    if (match) found.push({ line: index + 1, level: levels[match[1]], title: match[2].replace(/\\[A-Za-z]+\s*/g, '').replace(/[{}$~]/g, ' ').replace(/\s+/g, ' ').trim() });
  });
  return found;
}

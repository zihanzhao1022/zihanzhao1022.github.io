import type { DocLines } from './document';

export interface TexIssue {
  message: string;
  /** The line TeX printed for the error: a line of `file`, or of main.tex when `file` is not set. */
  line?: number;
  /** Base name of the file TeX was reading (an attachment, a package, main.aux), unless it was main.tex. */
  file?: string;
}

export interface LineLocation {
  area: 'source' | 'preamble' | 'wrapper';
  /** 1-based line within that area (main.tex line for 'wrapper'). */
  line: number;
}

const MAIN_FILE = 'main.tex';
/** TeX breaks the lines it writes to the log after this many characters (max_print_line). */
const LOG_WIDTH = 79;
/** Lines TeX always starts on a fresh line, even right after one that filled the whole width. */
const FRESH_LINE = /^(?:! |l\.\d+ |RESULTS-COUNTER:)/;
/** An error's "l.<n>" line is looked for in this many lines from its "! " line on, so in the 19 lines after it. */
const SOURCE_LINE_SEARCH = 20;
const SOURCE_LINE = /^l\.(\d+)/;

const FILE_EXTENSIONS = 'tex|sty|cls|clo|cfg|def|fd|aux|ldf|dict|mkii|ltx|bbl|toc|lof|lot|out|nav|snm|vrb|lbx|bbx|cbx|dbx|lua';
/**
 * The text right after a "(" that opens an input file: a path (`/tex/article.cls`, `./main.aux`, `acl.sty`) that
 * ends in a TeX file extension. The other parentheses in a log (`(264.0pt too wide)`, `(Font)`, `(size option)`)
 * are not followed by one.
 */
const OPENED_FILE = new RegExp(`^([^\\s(){}<>]+\\.(?:${FILE_EXTENSIONS}))(?=[\\s)]|$)`);

/**
 * Joins the lines TeX broke at 79 characters back together, so a message, a warning or a file name can be read
 * whole. A line of exactly 79 characters continues on the next one, except when that is empty or starts with
 * something TeX always puts on a fresh line: an error, a source line or a counter.
 */
export function unwrapLog(log: string): string {
  const joined: string[] = [];
  let full = false;
  for (const line of log.split('\n')) {
    if (full && line !== '' && !FRESH_LINE.test(line)) joined[joined.length - 1] += line;
    else joined.push(line);
    full = line.length === LOG_WIDTH;
  }
  return joined.join('\n');
}

/** The "l.<n>" line of the error whose "! " line is `lines[start]`, if TeX printed one before the next error. */
function findSourceLine(lines: string[], start: number): { line: number; index: number } | undefined {
  for (let next = start + 1; next < Math.min(lines.length, start + SOURCE_LINE_SEARCH); next += 1) {
    if (lines[next].startsWith('! ')) return undefined;
    const found = SOURCE_LINE.exec(lines[next]);
    if (found) return { line: Number(found[1]), index: next };
  }
  return undefined;
}

/** Follows the "(" and ")" of one log line. `open` has an entry per unclosed "(": a file's base name, or null. */
function trackFiles(text: string, open: Array<string | null>): void {
  for (let at = 0; at < text.length; at += 1) {
    if (text[at] === '(') {
      const file = OPENED_FILE.exec(text.slice(at + 1));
      open.push(file ? file[1].slice(file[1].lastIndexOf('/') + 1) : null);
    } else if (text[at] === ')') {
      open.pop();
    }
  }
}

function innermostFile(open: Array<string | null>): string | undefined {
  for (let index = open.length - 1; index >= 0; index -= 1) {
    const file = open[index];
    if (file !== null) return file;
  }
  return undefined;
}

/**
 * TeX errors: lines starting with "! ", each followed (usually) by "l.<n> ..." within a few lines. The file is the
 * innermost input file TeX had open, found from the "(file" and ")" in the log; none is given for main.tex.
 */
export function parseErrors(log: string): TexIssue[] {
  const lines = unwrapLog(log).split('\n');
  const open: Array<string | null> = [];
  const issues: TexIssue[] = [];
  // The lines from an error to the one after its "l.<n>" line echo the owner's source text, so their parentheses
  // say nothing about which file is open.
  let contextEnd = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index];
    if (!text.startsWith('! ')) {
      if (index > contextEnd) trackFiles(text, open);
      continue;
    }
    const source = findSourceLine(lines, index);
    contextEnd = source ? source.index + 1 : index;
    const message = text.slice(2).trim();
    // The fatal-error line only says that no PDF was made, and an emergency stop after another error only that TeX gave up.
    if (message.startsWith('==> Fatal error') || (message === 'Emergency stop.' && issues.length > 0)) continue;
    const issue: TexIssue = { message };
    if (source) issue.line = source.line;
    const file = innermostFile(open);
    if (file !== undefined && file !== MAIN_FILE) issue.file = file;
    issues.push(issue);
  }
  return issues;
}

/** The first line of each LaTeX, class and package warning. */
export const parseWarnings = (log: string): string[] =>
  unwrapLog(log)
    .split('\n')
    .filter((line) => /^(?:LaTeX(?: \S+)?|Package \S+|Class \S+) Warning:/.test(line))
    .map((line) => line.trim());

/** The counter values printed by the wrapper at the end of the document. */
export function parseCounters(log: string): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const match of log.matchAll(/^RESULTS-COUNTER:([A-Za-z@0-9]+)=(-?\d+)\s*$/gm)) counters[match[1]] = Number(match[2]);
  return counters;
}

function readGroup(text: string, at: number): { body: string; end: number } | null {
  if (text[at] !== '{') return null;
  let depth = 0;
  for (let index = at; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\') {
      index += 1;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return { body: text.slice(at + 1, index), end: index + 1 };
    }
  }
  return null;
}

/** \newlabel{name}{value} entries of an .aux file: name → value. */
export function parseAuxLabels(aux: string, marker = '\\newlabel{'): Record<string, string> {
  const labels: Record<string, string> = {};
  let at = aux.indexOf(marker);
  while (at !== -1) {
    const nameStart = at + marker.length;
    const nameEnd = aux.indexOf('}', nameStart);
    if (nameEnd === -1) break;
    const name = aux.slice(nameStart, nameEnd);
    // A name never spans lines or holds a brace; this one is an unclosed \newlabel{ and the "}" belongs to a later entry.
    const value = /[\n{]/.test(name) ? null : readGroup(aux, nameEnd + 1);
    if (value) labels[name] = value.body;
    at = aux.indexOf(marker, value ? value.end : nameStart);
  }
  return labels;
}

/** The \\bibcite entries of an .aux file (written by a typeset bibliography): key → second argument, like labels. */
export const parseAuxCitations = (aux: string): Record<string, string> => parseAuxLabels(aux, '\\bibcite{');

export function locateLine(line: number, doc: DocLines): LineLocation {
  if (line >= doc.sourceStartLine && line < doc.sourceStartLine + doc.sourceLineCount) {
    return { area: 'source', line: line - doc.sourceStartLine + 1 };
  }
  if (line >= doc.preambleStartLine && line < doc.preambleStartLine + doc.preambleLineCount) {
    return { area: 'preamble', line: line - doc.preambleStartLine + 1 };
  }
  return { area: 'wrapper', line };
}

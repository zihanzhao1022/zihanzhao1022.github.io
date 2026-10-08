import type { DocLines } from './document';

export interface TexIssue {
  message: string;
  /** Line in main.tex, when TeX printed one. */
  line?: number;
}

export interface LineLocation {
  area: 'source' | 'preamble' | 'wrapper';
  /** 1-based line within that area (main.tex line for 'wrapper'). */
  line: number;
}

/** TeX errors: lines starting with "! ", each followed (usually) by "l.<n> ..." within a few lines. */
export function parseErrors(log: string): TexIssue[] {
  const lines = log.split('\n');
  const issues: TexIssue[] = [];
  lines.forEach((text, index) => {
    if (!text.startsWith('! ')) return;
    const message = text.slice(2).trim();
    if (message.startsWith('==> Fatal error')) return;
    let line: number | undefined;
    for (let next = index + 1; next < Math.min(lines.length, index + 20); next += 1) {
      if (lines[next].startsWith('! ')) break;
      const found = /^l\.(\d+)/.exec(lines[next]);
      if (found) {
        line = Number(found[1]);
        break;
      }
    }
    issues.push(line === undefined ? { message } : { message, line });
  });
  return issues;
}

export const parseWarnings = (log: string): string[] =>
  log
    .split('\n')
    .filter((line) => /^(LaTeX|Package \S+) Warning:/.test(line))
    .map((line) => line.trim());

/** The counter values printed by the wrapper at the end of the document. */
export function parseCounters(log: string): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const match of log.matchAll(/^RESULTS-COUNTER:([A-Za-z@]+)=(-?\d+)\s*$/gm)) counters[match[1]] = Number(match[2]);
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
export function parseAuxLabels(aux: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const marker = '\\newlabel{';
  let at = aux.indexOf(marker);
  while (at !== -1) {
    const nameEnd = aux.indexOf('}', at + marker.length);
    if (nameEnd === -1) break;
    const value = readGroup(aux, nameEnd + 1);
    if (value) labels[aux.slice(at + marker.length, nameEnd)] = value.body;
    at = aux.indexOf(marker, value ? value.end : nameEnd + 1);
  }
  return labels;
}

export function locateLine(line: number, doc: DocLines): LineLocation {
  if (line >= doc.sourceStartLine && line < doc.sourceStartLine + doc.sourceLineCount) {
    return { area: 'source', line: line - doc.sourceStartLine + 1 };
  }
  if (line >= doc.preambleStartLine && line < doc.preambleStartLine + doc.preambleLineCount) {
    return { area: 'preamble', line: line - doc.preambleStartLine + 1 };
  }
  return { area: 'wrapper', line };
}

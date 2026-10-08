import { ResultPaper } from '../../types';
import { DEFAULT_PREAMBLE, stripComments } from '../tex/document';

/** One entry of a .bib file: its citation key and its text from "@" to the closing brace. */
export interface BibEntry {
  key: string;
  text: string;
}

const ENTRY_START = /@([A-Za-z]+)\s*([{(])/g;
// Not citable entries.
const SPECIAL = new Set(['string', 'preamble', 'comment']);

/** The citable entries of BibTeX text, e.g. what Google Scholar or DBLP copy. */
export function parseBibEntries(text: string): BibEntry[] {
  const entries: BibEntry[] = [];
  for (const match of text.matchAll(ENTRY_START)) {
    const start = match.index ?? 0;
    const open = match[2];
    const close = open === '{' ? '}' : ')';
    let depth = 0;
    let end = -1;
    for (let at = start + match[0].length - 1; at < text.length; at += 1) {
      if (text[at] === open || (open === '(' && text[at] === '{')) depth += 1;
      else if (text[at] === close || (open === '(' && text[at] === '}')) depth -= 1;
      if (depth === 0) {
        end = at + 1;
        break;
      }
    }
    if (end === -1 || SPECIAL.has(match[1].toLowerCase())) continue;
    const key = /^\s*([^,\s{}()]+)\s*,/.exec(text.slice(start + match[0].length, end))?.[1];
    if (key) entries.push({ key, text: text.slice(start, end) });
  }
  return entries;
}

export const bibKeysOf = (text: string): Set<string> => new Set(parseBibEntries(text).map((entry) => entry.key));

export interface BibMerge {
  text: string;
  /** Keys of the entries added, in the pasted order. */
  added: string[];
  /** Keys the file already had; those entries are left as they were. */
  skipped: string[];
}

/** Appends pasted entries to a .bib file's text, keeping entries whose key it already has. */
export function addBibEntries(existing: string, pasted: string): BibMerge {
  const known = bibKeysOf(existing);
  const added: string[] = [];
  const skipped: string[] = [];
  const texts: string[] = [];
  for (const entry of parseBibEntries(pasted)) {
    if (known.has(entry.key)) {
      if (!skipped.includes(entry.key)) skipped.push(entry.key);
      continue;
    }
    known.add(entry.key);
    added.push(entry.key);
    texts.push(entry.text.trim());
  }
  const base = existing.replace(/\s+$/, '');
  const text = texts.length === 0 ? existing : `${base}${base ? '\n\n' : ''}${texts.join('\n\n')}\n`;
  return { text, added, skipped };
}

// Conference styles that load natbib for author-year citations.
const NATBIB = /\\usepackage(?:\[[^\]]*\])?\{[^}]*\b(?:natbib|acl|iclr\w*|neurips\w*|icml\w*)\b[^}]*\}/;

/**
 * The \\bibliographystyle for a paper's references: an uploaded .bst (e.g. acl_natbib.bst) if there is one,
 * author-year (plainnat) when the preamble uses natbib, numbered in order of citation (unsrt) otherwise.
 */
export function bibliographyStyle(paper: ResultPaper): string {
  const bst = (paper.files ?? []).find((name) => name.endsWith('.bst'));
  if (bst) return bst.slice(0, -'.bst'.length);
  return NATBIB.test(stripComments(paper.preamble ?? DEFAULT_PREAMBLE)) ? 'plainnat' : 'unsrt';
}

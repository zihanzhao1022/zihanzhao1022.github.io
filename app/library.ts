import { slugify } from '../editor/schemas';
import { DEFAULT_PREAMBLE } from '../editor/tex/document';
import { ResultPaper } from '../types';

/** A slug for a new paper that no other paper of the account uses. */
export function uniqueSlug(title: string, taken: string[], fallback: string): string {
  const base = slugify(title).slice(0, 60).replace(/-+$/, '') || fallback;
  let slug = base;
  for (let n = 2; taken.includes(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

/** A new, private paper with no blocks yet. */
export function newPaper(fields: { title: string; venue?: string; year?: number }, author: string, taken: string[], now = Date.now()): ResultPaper {
  const id = `res-${now.toString(36)}`;
  return {
    id,
    slug: uniqueSlug(fields.title, taken, id),
    title: fields.title.trim(),
    authors: [`**${author}**`],
    ...(fields.venue?.trim() ? { venue: fields.venue.trim() } : {}),
    ...(fields.year ? { year: fields.year } : {}),
    hidden: true,
    preamble: DEFAULT_PREAMBLE,
    files: [],
    blocks: [],
  };
}

/**
 * A paper copied into another repository under a new id, with its files: block PDFs, kept versions' PDFs, the
 * bibliography and attachments all move from results/<old id>/ to results/<new id>/.
 */
export function copyPaper(
  paper: ResultPaper,
  read: (path: string) => Uint8Array | undefined,
  id: string,
  changes: Partial<ResultPaper>,
): { paper: ResultPaper; files: Map<string, Uint8Array> } {
  const from = `results/${paper.id}/`;
  const to = `results/${id}/`;
  const move = (path: string) => (path.startsWith(from) ? to + path.slice(from.length) : path);
  const files = new Map<string, Uint8Array>();
  const take = (path: string) => {
    const bytes = read(path);
    if (bytes) files.set(move(path), bytes);
    return move(path);
  };
  const blocks = paper.blocks.map((block) => ({
    ...block,
    ...(block.output ? { output: { ...block.output, pdf: take(block.output.pdf) } } : {}),
    ...(block.alternate
      ? { alternate: { ...block.alternate, ...(block.alternate.output ? { output: { ...block.alternate.output, pdf: take(block.alternate.output.pdf) } } : {}) } }
      : {}),
  }));
  (paper.files ?? []).forEach((name) => take(`${from}files/${name}`));
  const references = paper.references ? { ...paper.references, pdf: take(paper.references.pdf) } : undefined;
  return { paper: { ...paper, ...changes, id, blocks, ...(references ? { references } : {}) }, files };
}

/** Who a paper is shared with, and as what. */
export function sharing(paper: ResultPaper): { login: string; role: 'viewer' | 'editor' }[] {
  return [...(paper.editors ?? []).map((login) => ({ login, role: 'editor' as const })), ...(paper.viewers ?? []).map((login) => ({ login, role: 'viewer' as const }))];
}

/** The paper with these people on its lists (an editor may also view, so each is on one list only). */
export function withSharing(paper: ResultPaper, people: { login: string; role: 'viewer' | 'editor' }[]): ResultPaper {
  const viewers = people.filter((person) => person.role === 'viewer').map((person) => person.login);
  const editors = people.filter((person) => person.role === 'editor').map((person) => person.login);
  const { viewers: _viewers, editors: _editors, ...rest } = paper;
  return { ...rest, ...(viewers.length > 0 ? { viewers } : {}), ...(editors.length > 0 ? { editors } : {}) };
}

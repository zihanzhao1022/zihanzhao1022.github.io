import { IMAGE_TYPES, extensionOf } from './actions';

/** A folder of a paper's attachments, with what is in it sorted: folders first, then files, by name. */
export interface FileFolder {
  name: string;
  /** Path from the top, e.g. "figs/v2"; "" for the top. */
  path: string;
  folders: FileFolder[];
  /** Full names (paths) of the files directly in it. */
  files: string[];
}

const byName = (a: string, b: string): number => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });

/** The attachments' names (figs/a.pdf) as a tree of folders. */
export function fileTree(names: string[]): FileFolder {
  const root: FileFolder = { name: '', path: '', folders: [], files: [] };
  for (const name of names) {
    const parts = name.split('/');
    let folder = root;
    for (const part of parts.slice(0, -1)) {
      const path = folder.path ? `${folder.path}/${part}` : part;
      let next = folder.folders.find((item) => item.name === part);
      if (!next) {
        next = { name: part, path, folders: [], files: [] };
        folder.folders.push(next);
      }
      folder = next;
    }
    folder.files.push(name);
  }
  const sort = (folder: FileFolder): void => {
    folder.folders.sort((a, b) => byName(a.name, b.name));
    folder.files.sort((a, b) => byName(a.split('/').pop()!, b.split('/').pop()!));
    folder.folders.forEach(sort);
  };
  sort(root);
  return root;
}

/**
 * The code that uses an attachment, inserted where the cursor is: a picture's \includegraphics, a .tex
 * file's \input. Null for files that work otherwise (the preamble's .sty and .cls, the bibliography's .bib).
 */
export function insertionFor(name: string): string | null {
  const extension = extensionOf(name);
  if (IMAGE_TYPES.includes(extension)) return `\\includegraphics[width=\\linewidth]{${name}}\n`;
  if (extension === '.tex') return `\\input{${name}}\n`;
  return null;
}

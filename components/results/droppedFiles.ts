import type { DragEvent as ReactDragEvent } from 'react';

/** A file dropped or picked, with its path in what was dropped (figs/plot.pdf for a dropped folder figs). */
export interface PickedFile {
  path: string;
  file: File;
}

/** The parts of a file entry this reads; the browser's FileSystemEntry (or a test's stand-in). */
export interface DropEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  file?: (success: (file: File) => void, failure: (error: unknown) => void) => void;
  createReader?: () => { readEntries: (success: (entries: DropEntry[]) => void, failure: (error: unknown) => void) => void };
}

const CACHES = new Set(['__MACOSX', '__pycache__', 'node_modules']);

/** Hidden files and folders (.DS_Store, .git) and caches never belong to a paper. */
export const isJunk = (path: string): boolean => path.split('/').some((part) => part.startsWith('.') || CACHES.has(part));

/** The most files and folders a drop is read through; more is surely not a paper's files. */
export const MAX_ENTRIES = 2000;

export class TooManyFiles extends Error {}

async function children(entry: DropEntry): Promise<DropEntry[]> {
  const reader = entry.createReader!();
  const all: DropEntry[] = [];
  // A folder's entries come in batches until an empty one.
  for (;;) {
    const batch = await new Promise<DropEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

/** The files under dropped entries, folders read through, skipping junk; throws TooManyFiles past MAX_ENTRIES. */
export async function filesOfEntries(entries: DropEntry[]): Promise<PickedFile[]> {
  const picked: PickedFile[] = [];
  let seen = 0;
  const walk = async (entry: DropEntry, path: string): Promise<void> => {
    seen += 1;
    if (seen > MAX_ENTRIES) throw new TooManyFiles();
    if (isJunk(path)) return;
    if (entry.isDirectory) {
      for (const child of await children(entry)) await walk(child, `${path}/${child.name}`);
    } else if (entry.isFile && entry.file) {
      picked.push({ path, file: await new Promise<File>((resolve, reject) => entry.file!(resolve, reject)) });
    }
  };
  for (const entry of entries) await walk(entry, entry.name);
  return picked;
}

/**
 * The files of a drop, with folders. Call it in the drop handler itself: the browser only lets the dropped
 * items be read until the handler returns.
 */
export function droppedFiles(transfer: DataTransfer): Promise<PickedFile[]> {
  const entries = Array.from(transfer.items)
    .map((item) => (item.kind === 'file' ? (item.webkitGetAsEntry() as DropEntry | null) : null))
    .filter((entry): entry is DropEntry => entry !== null);
  if (entries.length > 0) return filesOfEntries(entries);
  return Promise.resolve(pickedFiles(transfer.files));
}

/** Files picked with a file input; those of a folder (webkitdirectory) carry their path in it. */
export const pickedFiles = (list: FileList): PickedFile[] =>
  Array.from(list)
    .map((file) => ({ path: file.webkitRelativePath || file.name, file }))
    .filter((picked) => !isJunk(picked.path));

/** Whether a drag carries files (not text or a link). */
export const carriesFiles = (event: DragEvent | ReactDragEvent): boolean => Array.from(event.dataTransfer?.types ?? []).includes('Files');

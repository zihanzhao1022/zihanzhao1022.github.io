import { Organizer, folderAndInside, moveFolder, moveTo } from './organizer';

/** What dragging paper rows or a folder carries, between the list of papers and the sidebar. */
export const PAPERS_TYPE = 'application/x-galley-papers';
export const FOLDER_TYPE = 'application/x-galley-folder';

/**
 * The folder being dragged, if any. Browsers keep what a drag carries hidden until the drop, so the folders it may
 * not go into (itself and those inside it) are found from here while it moves.
 */
export const dragged: { folder: string | null } = { folder: null };

/** Whether what is dragged may be dropped into a folder (null: out of every folder). */
export function accepts(organizer: Organizer, types: readonly string[], into: string | null): boolean {
  if (types.includes(PAPERS_TYPE)) return true;
  if (!types.includes(FOLDER_TYPE)) return false;
  return !(into && dragged.folder && folderAndInside(organizer, dragged.folder).has(into));
}

/** What a drop changes: papers go into the folder, a folder goes under it; null when it carries neither. */
export function dropping(data: DataTransfer, into: string | null): ((organizer: Organizer) => Organizer) | null {
  const papers = data.getData(PAPERS_TYPE);
  if (papers) return (organizer) => moveTo(organizer, JSON.parse(papers) as string[], into);
  const folder = data.getData(FOLDER_TYPE);
  if (folder && folder !== into) return (organizer) => moveFolder(organizer, folder, into);
  return null;
}

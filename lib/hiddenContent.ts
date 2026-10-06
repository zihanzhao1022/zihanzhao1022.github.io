const LIST_FILE = /[\\/]content[\\/](news|experiences|publications|projects|talks|awards)\.json$/;

/** True for the content files that hold lists of hideable items. */
export const isContentListFile = (id: string): boolean => LIST_FILE.test(id.split('?')[0]);

/** Removes items marked hidden, so they never reach the bundle visitors download. */
export function stripHiddenItems(json: string): string {
  const items = JSON.parse(json) as { hidden?: boolean }[];
  return JSON.stringify(items.filter((item) => !item.hidden));
}

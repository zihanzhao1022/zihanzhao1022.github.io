import { createContext, useContext } from 'react';
import type { PaperRole } from '../../editor/results/collaborators';

/** How a signed-in person's editor reaches the private results: the owner's, or a collaborator's. Visitors have none. */
export interface ResultsAccess {
  /** 'collaborator': someone the owner shared papers with, through the worker. Omitted: the owner. */
  role?: 'owner' | 'collaborator';
  /**
   * 'private': the page shows the private list and reads its files through readFile.
   * 'unavailable': the private repository cannot be read; the page shows the published snapshot.
   * 'loading': the private list is still on its way.
   */
  state: 'loading' | 'private' | 'unavailable';
  /** Why the private repository is unavailable. */
  reason?: 'missing' | 'empty' | 'error';
  readFile: (path: string) => Promise<Uint8Array>;
  /** A collaborator's role on each paper shared with them; their other papers are the published ones, from the site. */
  shared?: Record<string, PaperRole>;
  /** The site's copy of the published papers may be out of date because a sync failed. */
  siteBehind?: boolean;
  /** Brings the site's copy up to date from the latest private list. */
  syncSite?: () => void;
  /** Publishes collaborators' edits to a published paper (the owner only). */
  approveEdits?: (paperId: string) => void;
}

export const ResultsAccessContext = createContext<ResultsAccess | null>(null);

export const useResultsAccess = (): ResultsAccess | null => useContext(ResultsAccessContext);

export const isCollaborator = (access: ResultsAccess | null): boolean => access?.role === 'collaborator';

/** Whether a paper's files come through readFile rather than from the site's published copies. */
export const readsPrivately = (access: ResultsAccess | null, paperId: string): boolean =>
  access?.state === 'private' && (!isCollaborator(access) || access.shared?.[paperId] !== undefined);

/** Whether a collaborator may edit this paper. */
export const canEditShared = (access: ResultsAccess | null, paperId: string): boolean =>
  isCollaborator(access) && access?.shared?.[paperId] === 'editor';

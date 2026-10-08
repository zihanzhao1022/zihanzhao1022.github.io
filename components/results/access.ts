import { createContext, useContext } from 'react';

/** How the signed-in owner's editor reaches the private results. Visitors have none. */
export interface ResultsAccess {
  /**
   * 'private': the page shows the private list and reads its files through readFile.
   * 'unavailable': the private repository cannot be read; the page shows the published snapshot.
   * 'loading': the private list is still on its way.
   */
  state: 'loading' | 'private' | 'unavailable';
  /** Why the private repository is unavailable. */
  reason?: 'missing' | 'empty' | 'error';
  readFile: (path: string) => Promise<Uint8Array>;
  /** The site's copy of the published papers may be out of date because a sync failed. */
  siteBehind?: boolean;
  /** Brings the site's copy up to date from the latest private list. */
  syncSite?: () => void;
}

export const ResultsAccessContext = createContext<ResultsAccess | null>(null);

export const useResultsAccess = (): ResultsAccess | null => useContext(ResultsAccessContext);

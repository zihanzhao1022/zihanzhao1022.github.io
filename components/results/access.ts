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
}

export const ResultsAccessContext = createContext<ResultsAccess | null>(null);

export const useResultsAccess = (): ResultsAccess | null => useContext(ResultsAccessContext);

import { createContext, useContext } from 'react';

/** A signed-in person: GitHub user name and account ID (their avatar is at avatarUrl(id)). */
export interface Viewer {
  login: string;
  id: number;
}

export interface PresenceState {
  /** Who this browser is signed in as, once the worker has checked. */
  me?: Viewer;
  /** Everyone on the paper this page shows, including me. */
  viewers: Viewer[];
  /** The owner only: everyone signed in, with the papers they have open. */
  online?: (Viewer & { papers: string[] })[];
  /** The owner only: who came by in the last 7 days, most recent first (epoch milliseconds). */
  recent?: (Viewer & { at: number })[];
}

export interface PresenceValue extends PresenceState {
  /** Says which results paper this page shows (null when none). */
  setPaper: (paperId: string | null) => void;
}

/** Who else is around, like the avatars in Overleaf; null for visitors, who are not signed in. */
export const PresenceContext = createContext<PresenceValue | null>(null);

export const usePresence = (): PresenceValue | null => useContext(PresenceContext);

export const avatarUrl = (id: number, size = 64): string => `https://avatars.githubusercontent.com/u/${id}?s=${size}`;

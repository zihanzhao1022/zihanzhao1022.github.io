import { createContext, useContext } from 'react';

/** A signed-in person: GitHub user name and account ID (their avatar is at avatarUrl(id)). */
export interface Viewer {
  login: string;
  id: number;
}

/** Someone on the same paper, with the block they are looking at (none near the top of the page). */
export interface Reader extends Viewer {
  /** A block ID, or "references" for the bibliography. */
  block?: string;
}

export interface PresenceState {
  /** Who this browser is signed in as, once the worker has checked. */
  me?: Viewer;
  /** Everyone on the paper this page shows, including me, and where on it they are. */
  viewers: Reader[];
  /** The owner only: everyone signed in, with the papers they have open. */
  online?: (Viewer & { papers: string[] })[];
  /** The owner only: who came by in the last 7 days, most recent first (epoch milliseconds). */
  recent?: (Viewer & { at: number })[];
  /** The owner only: people without access who asked for it, most recent first. */
  requests?: AccessRequest[];
}

export interface AccessRequest extends Viewer {
  note: string;
  at: number;
}

export interface PresenceValue extends PresenceState {
  /** Says which results paper this page shows (null when none). */
  setPaper: (paperId: string | null) => void;
  /** Says which block of that paper is on screen (null when none). */
  setBlock: (blockId: string | null) => void;
  /** The owner answered a request (approving also needs the results-wide list to be saved). */
  resolveRequest: (login: string) => void;
}

/** Who else is around, like the avatars in Overleaf; null for visitors, who are not signed in. */
export const PresenceContext = createContext<PresenceValue | null>(null);

export const usePresence = (): PresenceValue | null => useContext(PresenceContext);

export const avatarUrl = (id: number, size = 64): string => `https://avatars.githubusercontent.com/u/${id}?s=${size}`;

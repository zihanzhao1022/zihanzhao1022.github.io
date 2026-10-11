import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PresenceValue, PresenceState, Reader, Viewer } from '../components/presence';
import { changeComments } from '../lib/comments';
import type { CommentOp, ResultComment } from '../types';
import { MOCK_MODE, Session } from '../lib/session';
import { mockUserId } from './auth';
import { EDITOR_CONFIG } from './config';

interface Connection {
  setPaper(paperId: string | null): void;
  setBlock(blockId: string | null): void;
  resolve(login: string): void;
  comment(op: CommentOp): void;
  close(): void;
}

const PING_MS = 45_000;
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

/**
 * Keeps a WebSocket to the worker's presence room while someone is signed in: says who they are, which
 * paper they show and which block of it is on screen, and hands every update to `onChange`. Reconnects
 * after drops.
 */
function connect(session: Session, onChange: (state: PresenceState) => void): Connection {
  const url = `${EDITOR_CONFIG.workerUrl.replace(/^http/, 'ws').replace(/\/+$/, '')}/presence`;
  let socket: WebSocket | null = null;
  let paper: string | null = null;
  let block: string | null = null;
  let closed = false;
  let attempt = 0;
  let ping: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let state: PresenceState = { viewers: [] };
  const update = (change: Partial<PresenceState>) => {
    state = { ...state, ...change };
    onChange(state);
  };

  const send = (message: unknown) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  const open = () => {
    socket = new WebSocket(url);
    socket.onopen = () => {
      attempt = 0;
      send({ t: 'hello', kind: session.role === 'collaborator' ? 'collaborator' : 'owner', token: session.token });
      send({ t: 'view', paper, block });
      ping = setInterval(() => send({ t: 'ping' }), PING_MS);
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }
      if (message.t === 'welcome') update({ me: message.me as Viewer, connected: true });
      if (message.t === 'error') closed = true;
      if (message.t === 'presence') {
        update({
          viewers: (message.viewers as Reader[]) ?? [],
          online: message.online as PresenceState['online'],
          recent: message.recent as PresenceState['recent'],
          requests: message.requests as PresenceState['requests'],
        });
      }
      if (message.t === 'comments' && typeof message.paper === 'string') {
        update({ comments: { paper: message.paper, threads: (message.threads as ResultComment[]) ?? [] } });
      }
    };
    socket.onclose = () => {
      clearInterval(ping);
      if (state.connected) update({ connected: false });
      if (closed) return;
      retry = setTimeout(open, RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]);
      attempt += 1;
    };
  };
  open();

  return {
    setPaper(next) {
      if (next !== paper) block = null;
      paper = next;
      send({ t: 'view', paper, block });
    },
    setBlock(next) {
      if (next === block || paper === null) return;
      block = next;
      send({ t: 'view', paper, block });
    },
    resolve(login) {
      send({ t: 'resolve', login });
    },
    comment(op) {
      send({ t: 'comment', op });
    },
    close() {
      closed = true;
      clearInterval(ping);
      clearTimeout(retry);
      socket?.close(1000, 'signed out');
    },
  };
}

/** `npm run dev:mock`: two made-up people, alice on the same paper (at its second block) and bob elsewhere. */
function connectMock(session: Session, onChange: (state: PresenceState) => void): Connection {
  const me = { login: session.login, id: mockUserId(session.login) };
  const alice = { login: 'alice', id: mockUserId('alice') };
  const bob = { login: 'bob', id: mockUserId('bob') };
  let paper: string | null = null;
  let block: string | null = null;
  let requests: PresenceState['requests'] = [];
  // Comments follow the room's rules (lib/comments) and stay in this browser.
  const readComments = (): Record<string, ResultComment[]> => {
    try {
      return JSON.parse(localStorage.getItem('mock-comments') ?? '{}') as Record<string, ResultComment[]>;
    } catch {
      return {};
    }
  };
  let comments = readComments();
  // The mock knows no paper's blocks, so alice reads the second one on the page.
  const aliceBlock = () => {
    const ids = Array.from(document.querySelectorAll<HTMLElement>('[data-result-block-id]'), (element) => element.dataset.resultBlockId);
    return ids[1] ?? ids[0];
  };
  const at = (where: string | null | undefined) => (where ? { block: where } : {});
  const emit = () =>
    onChange({
      me,
      connected: true,
      ...(paper ? { comments: { paper, threads: comments[paper] ?? [] } } : {}),
      viewers: paper ? [{ ...me, ...at(block) }, { ...alice, ...at(aliceBlock()) }] : [],
      ...(session.role === 'collaborator'
        ? {}
        : {
            online: [
              { ...me, papers: paper ? [paper] : [] },
              { ...alice, papers: paper ? [paper] : [] },
              { ...bob, papers: [] },
            ],
            recent: [
              { ...alice, at: Date.now() - 60 * 60_000 },
              { ...bob, at: Date.now() - 26 * 60 * 60_000 },
            ],
            requests,
          }),
    });
  // Requests made by mock collaborators (see AccessRequest), kept by the mock backend.
  const load = () =>
    import('./results/mockBackend').then(({ mockRequests }) => {
      requests = mockRequests();
      emit();
    });
  const timer = setTimeout(() => void load(), 300);
  return {
    setPaper(next) {
      if (next !== paper) block = null;
      paper = next;
      emit();
    },
    setBlock(next) {
      block = next;
      emit();
    },
    resolve(login) {
      void import('./results/mockBackend').then(({ mockResolveRequest }) => {
        mockResolveRequest(login);
        return load();
      });
    },
    comment(op) {
      if (!paper) return;
      const threads = comments[paper] ?? [];
      const actor = { ...me, owner: session.role !== 'collaborator' };
      const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const change = changeComments(threads, op, actor, () => true, { paper, now: Date.now(), newId });
      if (!change) return;
      const next =
        'put' in change
          ? [...threads.filter((thread) => thread.id !== change.put.id), change.put].sort((a, b) => a.at - b.at)
          : threads.filter((thread) => thread.id !== change.remove.id);
      comments = { ...comments, [paper]: next };
      try {
        localStorage.setItem('mock-comments', JSON.stringify(comments));
      } catch {
        // Private windows may refuse; the comments still show until reload.
      }
      emit();
    },
    close() {
      clearTimeout(timer);
    },
  };
}

/** Presence for the signed-in owner or collaborator (see components/presence.ts). */
export function usePresence(session: Session): PresenceValue {
  const [state, setState] = useState<PresenceState>({ viewers: [] });
  const connection = useRef<Connection | null>(null);
  useEffect(() => {
    const created = (MOCK_MODE ? connectMock : connect)(session, setState);
    connection.current = created;
    return () => {
      created.close();
      connection.current = null;
    };
  }, [session]);
  const setPaper = useCallback((paperId: string | null) => connection.current?.setPaper(paperId), []);
  const setBlock = useCallback((blockId: string | null) => connection.current?.setBlock(blockId), []);
  const resolveRequest = useCallback((login: string) => connection.current?.resolve(login), []);
  const comment = useCallback((op: CommentOp) => connection.current?.comment(op), []);
  return useMemo(() => ({ ...state, setPaper, setBlock, resolveRequest, comment }), [state, setPaper, setBlock, resolveRequest, comment]);
}

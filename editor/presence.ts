import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PresenceValue, PresenceState, Viewer } from '../components/presence';
import { MOCK_MODE, Session } from '../lib/session';
import { mockUserId } from './auth';
import { EDITOR_CONFIG } from './config';

interface Connection {
  setPaper(paperId: string | null): void;
  close(): void;
}

const PING_MS = 45_000;
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

/**
 * Keeps a WebSocket to the worker's presence room while someone is signed in: says who they are and which
 * paper they show, and hands every update to `onChange`. Reconnects after drops.
 */
function connect(session: Session, onChange: (state: PresenceState) => void): Connection {
  const url = `${EDITOR_CONFIG.workerUrl.replace(/^http/, 'ws').replace(/\/+$/, '')}/presence`;
  let socket: WebSocket | null = null;
  let paper: string | null = null;
  let closed = false;
  let attempt = 0;
  let ping: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let me: Viewer | undefined;

  const send = (message: unknown) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  const open = () => {
    socket = new WebSocket(url);
    socket.onopen = () => {
      attempt = 0;
      send({ t: 'hello', kind: session.role === 'collaborator' ? 'collaborator' : 'owner', token: session.token });
      send({ t: 'view', paper });
      ping = setInterval(() => send({ t: 'ping' }), PING_MS);
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }
      if (message.t === 'welcome') me = message.me as Viewer;
      if (message.t === 'error') closed = true;
      if (message.t === 'presence') {
        onChange({
          me,
          viewers: (message.viewers as Viewer[]) ?? [],
          ...(message.online ? { online: message.online as PresenceState['online'] } : {}),
          ...(message.recent ? { recent: message.recent as PresenceState['recent'] } : {}),
        });
      }
    };
    socket.onclose = () => {
      clearInterval(ping);
      if (closed) return;
      retry = setTimeout(open, RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]);
      attempt += 1;
    };
  };
  open();

  return {
    setPaper(next) {
      paper = next;
      send({ t: 'view', paper });
    },
    close() {
      closed = true;
      clearInterval(ping);
      clearTimeout(retry);
      socket?.close(1000, 'signed out');
    },
  };
}

/** `npm run dev:mock`: two made-up people, alice on the same paper and bob elsewhere on the site. */
function connectMock(session: Session, onChange: (state: PresenceState) => void): Connection {
  const me = { login: session.login, id: mockUserId(session.login) };
  const alice = { login: 'alice', id: mockUserId('alice') };
  const bob = { login: 'bob', id: mockUserId('bob') };
  let paper: string | null = null;
  const emit = () =>
    onChange({
      me,
      viewers: paper ? [me, alice] : [],
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
          }),
    });
  const timer = setTimeout(emit, 300);
  return {
    setPaper(next) {
      paper = next;
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
  return useMemo(() => ({ ...state, setPaper }), [state, setPaper]);
}

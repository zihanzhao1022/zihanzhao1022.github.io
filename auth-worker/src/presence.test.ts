import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResultPaper } from '../../types';
import { signSession } from './crypto';
import { Presence } from './presence';
import { ResultsEnv } from './results';

/** A server-side WebSocket as the hibernation API hands it to the Durable Object. */
class FakeSocket {
  sent: Record<string, unknown>[] = [];
  closed = false;
  private attachment: unknown;
  send(text: string) {
    this.sent.push(JSON.parse(text) as Record<string, unknown>);
  }
  close() {
    this.closed = true;
  }
  serializeAttachment(value: unknown) {
    this.attachment = structuredClone(value);
  }
  deserializeAttachment() {
    return this.attachment;
  }
  last(t: string) {
    return [...this.sent].reverse().find((message) => message.t === t);
  }
}

const env: ResultsEnv & { OWNER_LOGIN: string } = {
  GITHUB_CLIENT_ID: 'Iv1.test',
  OWNER_LOGIN: 'zihanzhao1022',
  PRIVATE_REPO: 'homepage-private',
  GITHUB_APP_PRIVATE_KEY: 'key',
  SESSION_SECRET: 'session-secret',
};

// Made-up papers: alice and bob may view A, only alice B.
const PAPERS: ResultPaper[] = [
  { id: 'A', slug: 'a', title: 'Made-up A', authors: [], hidden: true, viewers: ['alice', 'bob'], collaboratorIds: { alice: 101, bob: 102 }, blocks: [] },
  { id: 'B', slug: 'b', title: 'Made-up B', authors: [], hidden: true, viewers: ['alice'], collaboratorIds: { alice: 101 }, blocks: [] },
];

function room() {
  const sockets: FakeSocket[] = [];
  const store = new Map<string, unknown>();
  const state = {
    acceptWebSocket: (socket: WebSocket) => sockets.push(socket as unknown as FakeSocket),
    getWebSockets: () => sockets.filter((socket) => !socket.closed) as unknown as WebSocket[],
    storage: {
      get: async <T,>(key: string) => store.get(key) as T | undefined,
      put: async (key: string, value: unknown) => void store.set(key, structuredClone(value)),
    },
  };
  const presence = new Presence(state, env, async () => [PAPERS, { viewers: ['carol'], collaboratorIds: { carol: 103 } }]);
  const join = async (hello: Record<string, unknown>) => {
    const socket = new FakeSocket();
    state.acceptWebSocket(socket as unknown as WebSocket);
    socket.serializeAttachment({ paper: null });
    await presence.webSocketMessage(socket as unknown as WebSocket, JSON.stringify({ t: 'hello', ...hello }));
    return socket;
  };
  const say = (socket: FakeSocket, message: Record<string, unknown>) => presence.webSocketMessage(socket as unknown as WebSocket, JSON.stringify(message));
  return { presence, join, say, store };
}

const collaborator = async (login: string, id: number) => ({ kind: 'collaborator', token: await signSession({ login, id, exp: Date.now() + 60_000 }, 'session-secret') });

/** GitHub's /user for the owner's token. */
function ownerGitHub() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>).Authorization;
      if (String(input) === 'https://api.github.com/user' && auth === 'Bearer ghu_owner') return new Response(JSON.stringify({ login: 'ZihanZhao1022', id: 1 }));
      return new Response('{}', { status: 401 });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('presence', () => {
  it('lets in only signed-in people', async () => {
    ownerGitHub();
    const { join } = room();
    const forged = await join({ kind: 'collaborator', token: 'forged.token' });
    expect(forged.closed).toBe(true);
    const stranger = await join({ kind: 'owner', token: 'ghu_someone_else' });
    expect(stranger.closed).toBe(true);
    const owner = await join({ kind: 'owner', token: 'ghu_owner' });
    expect(owner.last('welcome')).toEqual({ t: 'welcome', me: { login: 'ZihanZhao1022', id: 1 } });
  });

  it('shows everyone on a paper who else is on it, and only the owner who is online anywhere', async () => {
    ownerGitHub();
    const { join, say } = room();
    const owner = await join({ kind: 'owner', token: 'ghu_owner' });
    const alice = await join(await collaborator('alice', 101));
    const bob = await join(await collaborator('bob', 102));
    await say(owner, { t: 'view', paper: 'A' });
    await say(alice, { t: 'view', paper: 'A' });
    await say(bob, { t: 'view', paper: null });

    expect(alice.last('presence')).toEqual({ t: 'presence', viewers: [{ login: 'ZihanZhao1022', id: 1 }, { login: 'alice', id: 101 }] });
    expect(bob.last('presence')).toEqual({ t: 'presence', viewers: [] });
    const seen = owner.last('presence') as { online: { login: string; papers: string[] }[]; recent: { login: string }[] };
    expect(seen.online.map((user) => [user.login, user.papers])).toEqual([
      ['ZihanZhao1022', ['A']],
      ['alice', ['A']],
      ['bob', []],
    ]);
    expect(seen.recent.map((visit) => visit.login).sort()).toEqual(['ZihanZhao1022', 'alice', 'bob']);
  });

  it('keeps collaborators out of papers they cannot see', async () => {
    const { join, say } = room();
    const alice = await join(await collaborator('alice', 101));
    const bob = await join(await collaborator('bob', 102));
    await say(alice, { t: 'view', paper: 'B' });
    // bob is not on B's list: claiming to view it must not show him who reads it.
    await say(bob, { t: 'view', paper: 'B' });
    expect(bob.last('presence')).toEqual({ t: 'presence', viewers: [] });
    expect(alice.last('presence')).toEqual({ t: 'presence', viewers: [{ login: 'alice', id: 101 }] });
  });

  it('drops people who leave and remembers when they were last seen', async () => {
    const { presence, join, say, store } = room();
    const alice = await join(await collaborator('alice', 101));
    const bob = await join(await collaborator('bob', 102));
    await say(alice, { t: 'view', paper: 'A' });
    await say(bob, { t: 'view', paper: 'A' });
    await presence.webSocketClose(bob as unknown as WebSocket);
    expect(alice.last('presence')).toEqual({ t: 'presence', viewers: [{ login: 'alice', id: 101 }] });
    expect(Object.keys(store.get('recent') as object).sort()).toEqual(['alice', 'bob']);
  });

  it('lets people on the results-wide list onto every paper', async () => {
    const { join, say } = room();
    const carol = await join(await collaborator('carol', 103));
    await say(carol, { t: 'view', paper: 'B' });
    expect(carol.last('presence')).toEqual({ t: 'presence', viewers: [{ login: 'carol', id: 103 }] });
  });

  it('answers pings and ignores junk', async () => {
    const { join, say } = room();
    const alice = await join(await collaborator('alice', 101));
    await say(alice, { t: 'ping' });
    expect(alice.last('pong')).toEqual({ t: 'pong' });
    await say(alice, { t: 'view', paper: 12 });
    expect(alice.last('presence')).toEqual({ t: 'presence', viewers: [] });
  });
});

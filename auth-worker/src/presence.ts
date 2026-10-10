/**
 * Who is on the site right now, like the avatars in Overleaf. Every signed-in browser keeps a WebSocket to
 * one Durable Object and says which results paper it shows. On a paper page everyone sees who else is on
 * that paper; only the owner sees who is online anywhere and who came by in the last week. Visitors who are
 * not signed in never connect. Nothing is stored except when each person was last seen.
 */
import { roleOf } from '../../editor/results/collaborators';
import { ResultPaper, ResultsSiteAccess } from '../../types';
import { verifySession } from './crypto';
import { githubHeaders } from './github-app';
import { ResultsEnv, collaboratorsEnabled, readShared } from './results';

export interface Viewer {
  login: string;
  id: number;
}
export interface OnlineUser extends Viewer {
  /** The papers this person has open (several tabs can show several). */
  papers: string[];
}
export interface RecentVisit extends Viewer {
  /** Epoch milliseconds. */
  at: number;
}
/** Someone who signed in without access and asked the owner for it. */
export interface AccessRequest extends RecentVisit {
  note: string;
}

interface Signed extends Viewer {
  owner: boolean;
}

/** What each socket remembers (it survives hibernation). */
interface Attachment {
  user?: Signed;
  paper: string | null;
}

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;
/** Requests kept at once; more are refused until the owner answers some. */
const MAX_REQUESTS = 30;
const PAPERS_TTL_MS = 60_000;
const OWNER_TTL_MS = 10 * 60_000;

async function sha256(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const send = (socket: WebSocket, message: unknown): void => {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // A socket that went away meanwhile; its close event cleans up.
  }
};

export class Presence {
  private papers: { at: number; list: ResultPaper[]; site: ResultsSiteAccess } | null = null;
  /** GitHub tokens already checked to be the owner's, by hash. */
  private owners = new Map<string, { user: Viewer; until: number }>();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: ResultsEnv,
    private readonly loadShared: () => Promise<[ResultPaper[], ResultsSiteAccess]> = () => readShared(env),
  ) {}

  async fetch(request: Request): Promise<Response> {
    // From the worker only (it checked the requester's token); browsers reach this object at /presence.
    if (new URL(request.url).pathname === '/request' && request.method === 'POST') return this.addRequest(await request.json());
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ paper: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    let message: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
      if (typeof parsed !== 'object' || parsed === null) return;
      message = parsed as Record<string, unknown>;
    } catch {
      return;
    }
    const attachment = socket.deserializeAttachment() as Attachment;
    if (message.t === 'ping') {
      send(socket, { t: 'pong' });
      return;
    }
    if (message.t === 'hello') {
      const user = await this.identify(message);
      if (!user) {
        send(socket, { t: 'error', message: 'not_signed_in' });
        socket.close(4001, 'not signed in');
        return;
      }
      socket.serializeAttachment({ user, paper: null } satisfies Attachment);
      await this.remember(user);
      send(socket, { t: 'welcome', me: { login: user.login, id: user.id } });
      await this.broadcast();
      return;
    }
    if (message.t === 'resolve' && attachment.user?.owner && typeof message.login === 'string') {
      // The owner answered (the site adds an approved person to the results-wide list itself).
      const requests = await this.requests();
      delete requests[message.login.toLowerCase()];
      await this.state.storage.put('requests', requests);
      await this.broadcast();
      return;
    }
    if (message.t === 'view' && attachment.user) {
      const wanted = typeof message.paper === 'string' ? message.paper : null;
      // Only papers this person may see, so nobody learns who reads a paper they have no access to.
      const paper = wanted && (await this.mayView(attachment.user, wanted)) ? wanted : null;
      socket.serializeAttachment({ ...attachment, paper } satisfies Attachment);
      await this.broadcast();
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    await this.leave(socket);
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    await this.leave(socket);
  }

  private async leave(socket: WebSocket): Promise<void> {
    const { user } = socket.deserializeAttachment() as Attachment;
    socket.serializeAttachment({ paper: null } satisfies Attachment);
    try {
      socket.close(1000, 'bye');
    } catch {
      // Already closed.
    }
    if (!user) return;
    await this.remember(user);
    await this.broadcast();
  }

  /** A collaborator's worker session, or the owner's GitHub token (checked with GitHub, then remembered). */
  private async identify(message: Record<string, unknown>): Promise<Signed | null> {
    const token = typeof message.token === 'string' ? message.token : '';
    if (!token) return null;
    if (message.kind === 'collaborator') {
      const claims = this.env.SESSION_SECRET ? await verifySession(token, this.env.SESSION_SECRET) : null;
      return claims ? { login: claims.login, id: claims.id, owner: false } : null;
    }
    const key = await sha256(token);
    const known = this.owners.get(key);
    if (known && known.until > Date.now()) return { ...known.user, owner: true };
    const res = await fetch('https://api.github.com/user', { headers: githubHeaders(`Bearer ${token}`) });
    if (!res.ok) return null;
    const user = (await res.json()) as { login?: unknown; id?: unknown };
    if (typeof user.login !== 'string' || typeof user.id !== 'number') return null;
    if (user.login.toLowerCase() !== this.env.OWNER_LOGIN.toLowerCase()) return null;
    this.owners.set(key, { user: { login: user.login, id: user.id }, until: Date.now() + OWNER_TTL_MS });
    return { login: user.login, id: user.id, owner: true };
  }

  private async mayView(user: Signed, paperId: string): Promise<boolean> {
    if (user.owner) return true;
    if (!collaboratorsEnabled(this.env)) return false;
    try {
      if (!this.papers || Date.now() - this.papers.at > PAPERS_TTL_MS) {
        const [list, site] = await this.loadShared();
        this.papers = { at: Date.now(), list, site };
      }
    } catch {
      return false;
    }
    const paper = this.papers.list.find((item) => item.id === paperId);
    return paper !== undefined && roleOf(paper, user, this.papers.site) !== null;
  }

  private async requests(): Promise<Record<string, AccessRequest>> {
    return (await this.state.storage.get<Record<string, AccessRequest>>('requests')) ?? {};
  }

  private async addRequest(raw: unknown): Promise<Response> {
    const { login, id, note } = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    if (typeof login !== 'string' || typeof id !== 'number') return new Response(null, { status: 400 });
    const requests = await this.requests();
    const key = login.toLowerCase();
    if (!requests[key] && Object.keys(requests).length >= MAX_REQUESTS) return new Response(null, { status: 429 });
    requests[key] = { login, id, at: Date.now(), note: typeof note === 'string' ? note.slice(0, 300) : '' };
    await this.state.storage.put('requests', requests);
    await this.broadcast();
    return new Response(null, { status: 202 });
  }

  /** Last seen, by user name, for the owner's "last 7 days". */
  private async remember(user: Signed): Promise<void> {
    const now = Date.now();
    const recent = (await this.state.storage.get<Record<string, RecentVisit>>('recent')) ?? {};
    recent[user.login.toLowerCase()] = { login: user.login, id: user.id, at: now };
    for (const [key, visit] of Object.entries(recent)) if (now - visit.at > RECENT_MS) delete recent[key];
    await this.state.storage.put('recent', recent);
  }

  private async broadcast(): Promise<void> {
    const signed = this.state
      .getWebSockets()
      .map((socket) => ({ socket, attachment: socket.deserializeAttachment() as Attachment }))
      .filter((entry): entry is { socket: WebSocket; attachment: Attachment & { user: Signed } } => entry.attachment.user !== undefined);
    const online = new Map<string, OnlineUser>();
    for (const { attachment } of signed) {
      const key = attachment.user.login.toLowerCase();
      const entry = online.get(key) ?? { login: attachment.user.login, id: attachment.user.id, papers: [] };
      if (attachment.paper && !entry.papers.includes(attachment.paper)) entry.papers.push(attachment.paper);
      online.set(key, entry);
    }
    const recent = Object.values((await this.state.storage.get<Record<string, RecentVisit>>('recent')) ?? {})
      .filter((visit) => Date.now() - visit.at <= RECENT_MS)
      .sort((a, b) => b.at - a.at);
    const requests = Object.values(await this.requests()).sort((a, b) => b.at - a.at);
    for (const { socket, attachment } of signed) {
      const viewers = new Map<string, Viewer>();
      if (attachment.paper) {
        for (const other of signed) {
          if (other.attachment.paper === attachment.paper) viewers.set(other.attachment.user.login.toLowerCase(), { login: other.attachment.user.login, id: other.attachment.user.id });
        }
      }
      send(socket, {
        t: 'presence',
        viewers: [...viewers.values()],
        ...(attachment.user.owner ? { online: [...online.values()], recent, requests } : {}),
      });
    }
  }
}

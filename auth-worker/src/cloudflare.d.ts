// The few Cloudflare Workers runtime APIs the presence Durable Object uses (the project has no
// @cloudflare/workers-types; these match https://developers.cloudflare.com/durable-objects/api/).

interface WebSocket {
  /** Keeps a small value with the socket across Durable Object hibernation. */
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

interface ResponseInit {
  /** The client end of a WebSocketPair, for a 101 response. */
  webSocket?: WebSocket | null;
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

interface DurableObjectState {
  /** Accepts a server socket with the hibernation API: messages arrive at webSocketMessage. */
  acceptWebSocket(socket: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  storage: DurableObjectStorage;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): { fetch(request: Request): Promise<Response> };
}

export type Headers = Record<string, string>;

export const json = (body: unknown, status: number, cors: Headers): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

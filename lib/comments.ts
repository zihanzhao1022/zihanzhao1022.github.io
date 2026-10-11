import { CommentAuthor, ResultComment } from '../types';

/** How long comments and their quotes may be, and how many a paper keeps. */
export const COMMENT_LIMITS = { text: 2000, quote: 300, context: 40, replies: 100, threads: 300 } as const;

/** Block IDs as the site makes them, and "references". */
const BLOCK_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Who asks: the owner may resolve and delete anything. */
export interface CommentActor extends CommentAuthor {
  owner: boolean;
}

/** A thread to store (new or changed) or to remove. */
export type CommentChange = { put: ResultComment } | { remove: ResultComment };

const cleanText = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim().slice(0, max) : '');

/**
 * What a reader's request does to the threads of the paper they have open: anyone who may read it comments
 * and replies on the blocks they can see; only authors and the owner resolve or delete. Null when the request
 * does not fit (empty text, a block or thread they cannot see, not theirs to resolve or delete, malformed).
 */
export function changeComments(
  threads: ResultComment[],
  raw: unknown,
  actor: CommentActor,
  mayHear: (block: string) => boolean,
  context: { paper: string; now: number; newId: (prefix: string) => string },
): CommentChange | null {
  const op = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const author = { login: actor.login, id: actor.id };
  const owns = (who: CommentAuthor) => actor.owner || who.id === actor.id;
  const thread = typeof op.thread === 'string' ? threads.find((item) => item.id === op.thread && mayHear(item.block)) : undefined;

  if (op.kind === 'add') {
    const text = cleanText(op.text, COMMENT_LIMITS.text);
    const block = typeof op.block === 'string' && BLOCK_ID.test(op.block) && mayHear(op.block) ? op.block : null;
    if (!text || !block || threads.length >= COMMENT_LIMITS.threads) return null;
    const quote = cleanText(op.quote, COMMENT_LIMITS.quote);
    const around = (value: unknown) => (typeof value === 'string' ? value.slice(0, COMMENT_LIMITS.context) : '');
    const prefix = around(op.prefix);
    const suffix = around(op.suffix);
    return {
      put: {
        id: context.newId('c'),
        paper: context.paper,
        block,
        author,
        at: context.now,
        text,
        replies: [],
        ...(quote ? { quote, ...(prefix ? { prefix } : {}), ...(suffix ? { suffix } : {}) } : {}),
      },
    };
  }
  if (!thread) return null;
  if (op.kind === 'reply') {
    const text = cleanText(op.text, COMMENT_LIMITS.text);
    if (!text || thread.replies.length >= COMMENT_LIMITS.replies) return null;
    return { put: { ...thread, replies: [...thread.replies, { id: context.newId('r'), author, at: context.now, text }] } };
  }
  if (op.kind === 'resolve' && owns(thread.author) && typeof op.resolved === 'boolean') {
    const { resolved: _resolved, ...open } = thread;
    return { put: op.resolved ? { ...open, resolved: { login: actor.login, at: context.now } } : open };
  }
  if (op.kind === 'delete' && typeof op.reply === 'string') {
    const reply = thread.replies.find((item) => item.id === op.reply);
    if (!reply || !owns(reply.author)) return null;
    return { put: { ...thread, replies: thread.replies.filter((item) => item !== reply) } };
  }
  if (op.kind === 'delete' && owns(thread.author)) return { remove: thread };
  return null;
}

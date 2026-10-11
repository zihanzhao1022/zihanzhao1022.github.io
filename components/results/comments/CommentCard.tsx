import React, { useState } from 'react';
import { COMMENT_LIMITS } from '../../../lib/comments';
import { CommentAuthor, CommentOp, ResultComment } from '../../../types';
import { avatarUrl } from '../../presence';
import { timeAgo } from './commentText';

/** A text box for a new comment or a reply: Ctrl/Cmd+Enter sends, Escape cancels. */
export const CommentBox: React.FC<{
  placeholder: string;
  submit: string;
  connected: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}> = ({ placeholder, submit, connected, onSubmit, onCancel }) => {
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim() || !connected) return;
    onSubmit(text.trim());
    setText('');
  };
  return (
    <div className="mt-2" onClick={(event) => event.stopPropagation()}>
      <textarea
        value={text}
        autoFocus
        rows={3}
        maxLength={COMMENT_LIMITS.text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send();
          if (event.key === 'Escape') onCancel();
        }}
        className="w-full resize-y rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-end gap-2 text-xs">
        {!connected && <span className="mr-auto text-gray-400">正在连接…</span>}
        <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100">
          取消
        </button>
        <button
          type="button"
          disabled={!text.trim() || !connected}
          onClick={send}
          className="rounded bg-purple-600 px-2.5 py-1 font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {submit}
        </button>
      </div>
    </div>
  );
};

const Byline: React.FC<{ author: CommentAuthor; at: number; now: number }> = ({ author, at, now }) => (
  <div className="flex min-w-0 items-center gap-2">
    <img src={avatarUrl(author.id, 40)} alt="" className="h-6 w-6 shrink-0 rounded-full bg-gray-200" />
    <span className="truncate text-xs font-medium text-gray-800">@{author.login}</span>
    <span className="shrink-0 text-xs text-gray-400">{timeAgo(at, now)}</span>
  </div>
);

interface CardProps {
  thread: ResultComment;
  /** Who is reading: their own comments, and the owner every comment, can be resolved and deleted. */
  meId?: number;
  owner: boolean;
  focused: boolean;
  connected: boolean;
  now: number;
  onFocus: () => void;
  act: (op: CommentOp) => void;
}

/** One thread: who wrote it and when, the quoted text, the comment, its replies and what can be done. */
export const CommentCard: React.FC<CardProps> = ({ thread, meId, owner, focused, connected, now, onFocus, act }) => {
  const [replying, setReplying] = useState(false);
  const mine = (author: CommentAuthor) => owner || author.id === meId;
  const action = 'text-xs text-gray-400 hover:text-purple-700';
  return (
    <article
      id={`comment-${thread.id}`}
      onClick={onFocus}
      className={`cursor-pointer rounded-lg border bg-white p-3 text-sm shadow-sm transition-colors ${
        focused ? 'border-purple-300 ring-2 ring-purple-100' : 'border-gray-200 hover:border-gray-300'
      } ${thread.resolved ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Byline author={thread.author} at={thread.at} now={now} />
        {mine(thread.author) && (
          <div className="flex shrink-0 gap-2" onClick={(event) => event.stopPropagation()}>
            <button type="button" className={action} onClick={() => act({ kind: 'resolve', thread: thread.id, resolved: !thread.resolved })}>
              {thread.resolved ? '重新打开' : '解决'}
            </button>
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-red-600"
              onClick={() => window.confirm('删除这条批注和它的所有回复？') && act({ kind: 'delete', thread: thread.id })}
            >
              删除
            </button>
          </div>
        )}
      </div>
      {thread.quote && <blockquote className="mt-2 line-clamp-3 border-l-2 border-amber-300 pl-2 text-xs text-gray-500">{thread.quote}</blockquote>}
      <p className="mt-2 whitespace-pre-wrap break-words text-gray-800">{thread.text}</p>
      {thread.resolved && <p className="mt-1 text-xs text-gray-400">@{thread.resolved.login} 标记为已解决</p>}
      {thread.replies.length > 0 && (
        <ul className="mt-3 space-y-3 border-t border-gray-100 pt-3">
          {thread.replies.map((reply) => (
            <li key={reply.id}>
              <div className="flex items-center justify-between gap-2">
                <Byline author={reply.author} at={reply.at} now={now} />
                {mine(reply.author) && (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-gray-400 hover:text-red-600"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (window.confirm('删除这条回复？')) act({ kind: 'delete', thread: thread.id, reply: reply.id });
                    }}
                  >
                    删除
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words pl-8 text-gray-800">{reply.text}</p>
            </li>
          ))}
        </ul>
      )}
      {!thread.resolved &&
        (replying ? (
          <CommentBox
            placeholder="回复…"
            submit="回复"
            connected={connected}
            onSubmit={(text) => {
              act({ kind: 'reply', thread: thread.id, text });
              setReplying(false);
            }}
            onCancel={() => setReplying(false)}
          />
        ) : (
          <button
            type="button"
            className={`mt-2 ${action}`}
            onClick={(event) => {
              event.stopPropagation();
              setReplying(true);
            }}
          >
            回复
          </button>
        ))}
    </article>
  );
};

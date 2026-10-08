import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ResultsAccess } from '../../components/results/access';
import { Session } from '../../lib/session';
import { SiteContent } from '../../types';
import { describeSaveError } from '../backend';
import { ContentOp } from '../ops';
import { attachmentPath, rebuildPaper, withOutputs } from './actions';
import { ResultsBackend, createResults } from './backend';
import type { ResultsSave } from './BlockEditor';
import { ResultsOp, applyResultsOp, fromContentOp, resultsCommitMessage } from './ops';

export interface EditorToast {
  message: string;
  action?: { label: string; onClick: () => void };
}

const PUBLISH_CONFIRM =
  '公开后，这篇论文的结果会提交到网站的公开仓库，访客可以看到。之后再隐藏，Git 历史里仍会保留。确定公开吗？';

const notReady = (): Promise<Uint8Array> => Promise.reject(new Error('私有仓库还没有准备好'));

interface Options {
  session: Session;
  setContent: React.Dispatch<React.SetStateAction<SiteContent>>;
  contentRef: React.MutableRefObject<SiteContent>;
  /** The editor's save queue, shared so every commit happens one at a time. */
  queue: React.MutableRefObject<Promise<unknown>>;
  onDeploy: (commitSha: string) => void;
  onToast: (toast: EditorToast | null) => void;
}

/** The owner's side of the results pages: the private list, its saves and publishing. */
export function useResultsEditor({ session, setContent, contentRef, queue, onDeploy, onToast }: Options) {
  const [backend, setBackend] = useState<ResultsBackend | null>(null);
  const [access, setAccess] = useState<ResultsAccess>({ state: 'loading', readFile: notReady });
  /** Once the private list is in, reloading the public content must not replace it with the snapshot. */
  const privateLoaded = useRef(false);
  const callbacks = useRef({ onDeploy, onToast });
  callbacks.current = { onDeploy, onToast };

  useEffect(() => {
    let cancelled = false;
    createResults(session)
      .then(async (created) => {
        const loaded = await created.load();
        if (cancelled) return;
        setBackend(created);
        if (loaded.state === 'ready') {
          privateLoaded.current = true;
          setContent((current) => ({ ...current, results: loaded.papers }));
          setAccess({ state: 'private', readFile: created.readFile });
        } else {
          setAccess({ state: 'unavailable', reason: loaded.reason, readFile: created.readFile });
        }
      })
      .catch(() => {
        if (!cancelled) setAccess({ state: 'unavailable', reason: 'error', readFile: notReady });
      });
    return () => {
      cancelled = true;
    };
  }, [session, setContent]);

  const reload = useCallback(() => {
    backend
      ?.load()
      .then((loaded) => {
        if (loaded.state === 'ready') setContent((current) => ({ ...current, results: loaded.papers }));
      })
      .catch(() => undefined);
  }, [backend, setContent]);

  const retryPublish = useCallback(
    (papers: SiteContent['results']) => {
      backend
        ?.syncPublic(papers, 'content: update results')
        .then((sha) => {
          if (sha) callbacks.current.onDeploy(sha);
          callbacks.current.onToast({ message: '网站上的公开内容已更新' });
        })
        .catch((error: unknown) => callbacks.current.onToast({ message: describeSaveError(error) }));
    },
    [backend],
  );

  const saveResults = useCallback<ResultsSave>(
    (op, writes, deletes, message, publicMessage) => {
      if (!backend || access.state !== 'private') return Promise.reject(new Error('私有仓库不可用，暂时不能保存'));
      const run = queue.current.then(async () => {
        const result = await backend.save(op, writes, deletes, message, publicMessage);
        setContent((current) => ({ ...current, results: result.papers }));
        if (result.publicCommit) callbacks.current.onDeploy(result.publicCommit);
        if (result.publicError) {
          callbacks.current.onToast({
            message: '已保存，但更新网站上的公开内容失败',
            action: { label: '重试', onClick: () => retryPublish(result.papers) },
          });
        }
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    [backend, access.state, queue, setContent, retryPublish],
  );

  /** Saves an edit made through the generic dialogs or by dragging a paper. */
  const saveContentOp = useCallback(
    (op: ContentOp): Promise<void> => {
      const resultsOp = fromContentOp(op);
      if (!resultsOp || op.kind === 'patchProfile') return Promise.reject(new Error('不支持的操作'));
      const papers = contentRef.current.results;
      if (op.kind === 'upsert') {
        const title = String(op.item.title ?? '');
        const isNew = !papers.some((paper) => paper.id === op.item.id);
        return saveResults(resultsOp, [], [], resultsCommitMessage(isNew ? 'add paper' : 'update paper', title), `content: update result "${title}"`);
      }
      if (op.kind === 'reorder') {
        return saveResults(resultsOp, [], [], resultsCommitMessage('reorder papers'), 'content: reorder results');
      }
      const paper = papers.find((item) => item.id === op.id);
      const title = paper?.title ?? '';
      if (op.kind === 'delete') {
        const files = paper
          ? [
              ...paper.blocks.flatMap((block) => (block.output ? [block.output.pdf] : [])),
              ...(paper.files ?? []).map((name) => attachmentPath(paper.id, name)),
            ]
          : [];
        return saveResults(resultsOp, [], files, resultsCommitMessage('delete paper', title), `content: unpublish result "${title}"`);
      }
      if (!op.hidden && !window.confirm(PUBLISH_CONFIRM)) return Promise.reject(new Error('已取消公开'));
      return saveResults(
        resultsOp,
        [],
        [],
        resultsCommitMessage(op.hidden ? 'hide' : 'publish', title),
        `content: ${op.hidden ? 'unpublish' : 'publish'} result "${title}"`,
      );
    },
    [contentRef, saveResults],
  );

  /** Drag and drop of blocks: the page changes at once, then the affected blocks are renumbered and saved. */
  const reorderBlocks = useCallback(
    (paperId: string, ids: string[]) => {
      if (!backend || access.state !== 'private') return;
      const op: ResultsOp = { kind: 'reorderBlocks', paperId, ids };
      const paper = applyResultsOp(contentRef.current.results, op).find((item) => item.id === paperId);
      if (!paper) return;
      setContent((current) => ({ ...current, results: applyResultsOp(current.results, op) }));
      callbacks.current.onToast({ message: '正在更新编号…' });
      void (async () => {
        try {
          const rebuilt = await rebuildPaper(paper, backend.readFile);
          if (rebuilt.failed) throw new Error(`重新编译失败：${rebuilt.failed.message}`);
          await saveResults(
            withOutputs(paperId, [op], rebuilt),
            rebuilt.writes,
            rebuilt.deletes,
            resultsCommitMessage('reorder blocks in', paper.title),
            `content: update result "${paper.title}"`,
          );
          callbacks.current.onToast({ message: '顺序已保存' });
        } catch (error) {
          callbacks.current.onToast({ message: describeSaveError(error) });
          reload();
        }
      })();
    },
    [backend, access.state, contentRef, setContent, saveResults, reload],
  );

  return { access, privateLoaded, saveResults, saveContentOp, reorderBlocks, reload };
}

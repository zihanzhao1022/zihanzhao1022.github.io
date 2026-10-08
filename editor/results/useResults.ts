import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResultsAccess } from '../../components/results/access';
import { Session } from '../../lib/session';
import { ResultPaper, SiteContent } from '../../types';
import { describeSaveError } from '../backend';
import { ContentOp } from '../ops';
import { attachmentPath, rebuildPaper, withOutputs } from './actions';
import { GENERIC_PUBLIC_MESSAGE, ResultsBackend, ResultsSaveResult, createResults } from './backend';
import type { ResultsSave } from './BlockEditor';
import { ResultsOp, applyResultsOp, fromContentOp, resultsCommitMessage } from './ops';
import { hasPublished } from './snapshot';

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

type LoadState = Pick<ResultsAccess, 'state' | 'reason'>;

/** The owner's side of the results pages: the private list, its saves and publishing. */
export function useResultsEditor({ session, setContent, contentRef, queue, onDeploy, onToast }: Options) {
  const [backend, setBackend] = useState<ResultsBackend | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  /** The site's copy of the published papers may be out of date (a sync failed). */
  const [siteBehind, setSiteBehind] = useState(false);
  /** Once the private list is in, reloading the public content must not replace it with the snapshot. */
  const privateLoaded = useRef(false);
  /** The private list as last loaded or saved; queued work starts from it, never from the page. */
  const latest = useRef<ResultPaper[]>([]);
  /** Block reorders already shown on the page but not saved yet; re-applied after every save. */
  const pending = useRef<ResultsOp[]>([]);
  const callbacks = useRef({ onDeploy, onToast });
  callbacks.current = { onDeploy, onToast };

  const show = useCallback(
    (papers: ResultPaper[]) => setContent((current) => ({ ...current, results: pending.current.reduce(applyResultsOp, papers) })),
    [setContent],
  );

  const enqueue = useCallback(
    <T,>(task: () => Promise<T>): Promise<T> => {
      const run = queue.current.then(task);
      queue.current = run.catch(() => undefined);
      return run;
    },
    [queue],
  );

  useEffect(() => {
    let cancelled = false;
    createResults(session)
      .then(async (created) => {
        const loaded = await created.load();
        if (cancelled) return;
        setBackend(created);
        if (loaded.state !== 'ready') {
          setLoadState({ state: 'unavailable', reason: loaded.reason });
          return;
        }
        // What the page showed until now is the published snapshot.
        const snapshotShown = contentRef.current.results.length > 0;
        privateLoaded.current = true;
        latest.current = loaded.papers;
        show(loaded.papers);
        setLoadState({ state: 'private' });
        // Catch up with collaborators' edits and with syncs that failed in an earlier session.
        if (hasPublished(loaded.papers) || snapshotShown) {
          const run = queue.current.then(() => created.resync(GENERIC_PUBLIC_MESSAGE));
          queue.current = run.catch(() => undefined);
          run.then(
            (sha) => {
              if (!sha) return;
              callbacks.current.onDeploy(sha);
              callbacks.current.onToast({ message: '已更新网站上的公开论文结果' });
            },
            () => setSiteBehind(true),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState({ state: 'unavailable', reason: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [session, contentRef, queue, show]);

  const reload = useCallback(() => {
    backend
      ?.load()
      .then((loaded) => {
        if (loaded.state !== 'ready') return;
        latest.current = loaded.papers;
        show(loaded.papers);
      })
      .catch(() => undefined);
  }, [backend, show]);

  const syncSite = useCallback(() => {
    if (!backend) return;
    enqueue(() => backend.resync(GENERIC_PUBLIC_MESSAGE)).then(
      (sha) => {
        setSiteBehind(false);
        if (sha) callbacks.current.onDeploy(sha);
        callbacks.current.onToast({ message: '网站上的公开内容已更新' });
      },
      (error: unknown) => callbacks.current.onToast({ message: describeSaveError(error) }),
    );
  }, [backend, enqueue]);

  /** Takes in a finished save: the new list, the deployment it started, and whether the site kept up. */
  const settle = useCallback(
    (result: ResultsSaveResult) => {
      latest.current = result.papers;
      show(result.papers);
      if (result.publicCommit) callbacks.current.onDeploy(result.publicCommit);
      setSiteBehind(Boolean(result.publicError));
      if (result.publicError) {
        callbacks.current.onToast({ message: '已保存，但更新网站上的公开内容失败', action: { label: '重试', onClick: syncSite } });
      }
    },
    [show, syncSite],
  );

  const unavailable = useCallback(
    () => new Error(loadState.state === 'loading' ? '论文结果还在加载，请稍后再试' : '私有仓库不可用，暂时不能保存'),
    [loadState.state],
  );

  const saveResults = useCallback<ResultsSave>(
    (op, writes, deletes, message, publicMessage) => {
      if (!backend || loadState.state !== 'private') return Promise.reject(unavailable());
      return enqueue(async () => settle(await backend.save(op, writes, deletes, message, publicMessage)));
    },
    [backend, loadState.state, unavailable, enqueue, settle],
  );

  /** Saves an edit made through the generic dialogs or by dragging a paper. */
  const saveContentOp = useCallback(
    (op: ContentOp): Promise<void> => {
      const resultsOp = fromContentOp(op);
      if (!resultsOp || op.kind === 'patchProfile') return Promise.reject(new Error('不支持的操作'));
      if (op.kind === 'upsert') {
        const title = String(op.item.title ?? '');
        const isNew = !latest.current.some((paper) => paper.id === op.item.id);
        return saveResults(resultsOp, [], [], resultsCommitMessage(isNew ? 'add paper' : 'update paper', title), `content: update result "${title}"`);
      }
      if (op.kind === 'reorder') {
        return saveResults(resultsOp, [], [], resultsCommitMessage('reorder papers'), 'content: reorder results');
      }
      const paper = latest.current.find((item) => item.id === op.id);
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
    [saveResults],
  );

  /**
   * Drag and drop of blocks: the page changes at once. Renumbering and saving wait their turn in the queue
   * and start from the latest saved list, so quick successive drags are applied in order.
   */
  const reorderBlocks = useCallback(
    (paperId: string, ids: string[]) => {
      if (!backend || loadState.state !== 'private') return;
      const op: ResultsOp = { kind: 'reorderBlocks', paperId, ids };
      pending.current.push(op);
      setContent((current) => ({ ...current, results: applyResultsOp(current.results, op) }));
      callbacks.current.onToast({ message: '正在更新编号…' });
      const done = () => {
        pending.current = pending.current.filter((queued) => queued !== op);
      };
      enqueue(async () => {
        const paper = applyResultsOp(latest.current, op).find((item) => item.id === paperId);
        if (!paper) return;
        const rebuilt = await rebuildPaper(paper, backend.readFile);
        if (rebuilt.failed) throw new Error(`重新编译失败：${rebuilt.failed.message}`);
        const result = await backend.save(
          withOutputs(paperId, [op], rebuilt),
          rebuilt.writes,
          rebuilt.deletes,
          resultsCommitMessage('reorder blocks in', paper.title),
          `content: update result "${paper.title}"`,
        );
        done();
        settle(result);
        if (!result.publicError) callbacks.current.onToast({ message: '顺序已保存' });
      }).catch((error: unknown) => {
        done();
        show(latest.current);
        callbacks.current.onToast({ message: describeSaveError(error) });
      });
    },
    [backend, loadState.state, setContent, enqueue, settle, show],
  );

  const access = useMemo<ResultsAccess>(
    () => ({
      ...loadState,
      readFile: backend?.readFile ?? notReady,
      siteBehind,
      syncSite,
    }),
    [loadState, backend, siteBehind, syncSite],
  );

  return { access, privateLoaded, saveResults, saveContentOp, reorderBlocks, reload };
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResultsAccess } from '../../components/results/access';
import { Session } from '../../lib/session';
import { ResultPaper, ResultsSiteAccess, SiteContent } from '../../types';
import { describeSaveError } from '../backend';
import { ContentOp } from '../ops';
import { attachmentPath, rebuildPaper, withOutputs } from './actions';
import { GENERIC_PUBLIC_MESSAGE, ResultsBackend, ResultsSaveResult } from './backend';
import type { ResultsSave } from './BlockEditor';
import { PaperRole, withCollaboratorIds } from './collaborators';
import { createCollaboratorResults, createResults, createUserLookup } from './connect';
import { ResultsOp, applyResultsOp, fromContentOp, resultsCommitMessage } from './ops';
import { WorkerError } from './workerBackend';

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
  /** Signs out a collaborator the worker no longer lets in (session expired, or nothing shared any more). */
  onSignedOut?: (message: string) => void;
}

type LoadState = Pick<ResultsAccess, 'state' | 'reason'>;

/**
 * The editing side of the results pages: the private list, its saves and publishing for the owner; the
 * shared papers, through the worker, for a collaborator.
 */
export function useResultsEditor({ session, setContent, contentRef, queue, onDeploy, onToast, onSignedOut }: Options) {
  const collaborator = session.role === 'collaborator';
  const [backend, setBackend] = useState<ResultsBackend | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  /** The site's copy of the published papers may be out of date (a sync failed). */
  const [siteBehind, setSiteBehind] = useState(false);
  /** Who may view every paper (the owner's results-access.json). */
  const [siteAccess, setSiteAccess] = useState<ResultsSiteAccess>({});
  /** A collaborator's role on each paper shared with them. */
  const [roles, setRoles] = useState<Record<string, PaperRole> | undefined>(undefined);
  /** Once the private list is in, reloading the public content must not replace it with the snapshot. */
  const privateLoaded = useRef(false);
  /** The private list as last loaded or saved; queued work starts from it, never from the page. */
  const latest = useRef<ResultPaper[]>([]);
  /** Block reorders already shown on the page but not saved yet; re-applied after every save. */
  const pending = useRef<ResultsOp[]>([]);
  const callbacks = useRef({ onDeploy, onToast, onSignedOut });
  callbacks.current = { onDeploy, onToast, onSignedOut };

  const show = useCallback(
    (papers: ResultPaper[]) =>
      setContent((current) => ({ ...current, results: pending.current.reduce(applyResultsOp, papers) })),
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
    (collaborator ? createCollaboratorResults(session) : createResults(session))
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
        setRoles(loaded.roles);
        show(loaded.papers);
        setLoadState({ state: 'private' });
        // Only the owner publishes and keeps the results-wide list.
        if (collaborator) return;
        created
          .loadAccess?.()
          .then((access) => {
            if (!cancelled) setSiteAccess(access);
          })
          .catch(() => undefined);
        if (loaded.papers.some((paper) => !paper.hidden && paper.pendingReview?.length)) {
          callbacks.current.onToast({ message: '协作者修改了已公开的论文，在论文页确认后才会更新到网站' });
        }
        if (loaded.papers.length === 0) {
          // An empty private list next to published papers looks like a lost results.json: never wipe the
          // site on its own, let the owner decide through the banner.
          if (snapshotShown) setSiteBehind(true);
          return;
        }
        // Catch up with syncs that failed in an earlier session (a no-op when the site is up to date).
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
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof WorkerError && (error.status === 401 || error.status === 403)) {
          callbacks.current.onSignedOut?.(error.status === 401 ? '登录已过期，请重新登录' : '作者已经不再和你共享论文');
          return;
        }
        setLoadState({ state: 'unavailable', reason: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [session, collaborator, contentRef, queue, show]);

  const reload = useCallback(() => {
    if (!backend) return;
    // In the queue, so a slow reload never rolls the list back past a save queued after it.
    enqueue(() => backend.load())
      .then((loaded) => {
        if (loaded.state !== 'ready') return;
        latest.current = loaded.papers;
        show(loaded.papers);
      })
      .catch(() => undefined);
  }, [backend, enqueue, show]);

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
      if (result.roles) setRoles(result.roles);
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

  const lookupUser = useMemo(() => createUserLookup(session), [session]);

  /** Saves who may view every paper, with their GitHub account IDs (looked up like a paper's lists). */
  const saveSiteViewers = useCallback(
    async (names: string[], knownIds: Record<string, number> = {}): Promise<void> => {
      if (!backend?.saveAccess) throw new Error('私有仓库不可用，暂时不能保存');
      // IDs already known (e.g. from an access request, checked at GitHub sign-in) need no lookup.
      const previous = { collaboratorIds: { ...siteAccess.collaboratorIds, ...knownIds } };
      const next = await withCollaboratorIds<ResultsSiteAccess>(names.length > 0 ? { viewers: names } : {}, previous, lookupUser);
      await enqueue(() => backend.saveAccess!(next, 'results: update who may view every paper'));
      setSiteAccess(next);
    },
    [backend, siteAccess, lookupUser, enqueue],
  );

  /** Saves an edit made through the generic dialogs or by dragging a paper. */
  const saveContentOp = useCallback(
    async (op: ContentOp): Promise<void> => {
      const resultsOp = fromContentOp(op);
      if (!resultsOp || op.kind === 'patchProfile') throw new Error('不支持的操作');
      if (op.kind === 'upsert') {
        const title = String(op.item.title ?? '');
        const previous = latest.current.find((paper) => paper.id === op.item.id);
        // Access is checked against GitHub account IDs, looked up here for names newly added to the lists.
        const paper = await withCollaboratorIds(op.item as unknown as ResultPaper, previous, lookupUser);
        return saveResults(
          { kind: 'putPaper', paper },
          [],
          [],
          resultsCommitMessage(previous ? 'update paper' : 'add paper', title),
          `content: update result "${title}"`,
        );
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
      if (!op.hidden && !window.confirm(PUBLISH_CONFIRM)) throw new Error('已取消公开');
      return saveResults(
        resultsOp,
        [],
        [],
        resultsCommitMessage(op.hidden ? 'hide' : 'publish', title),
        `content: ${op.hidden ? 'unpublish' : 'publish'} result "${title}"`,
      );
    },
    [saveResults, lookupUser],
  );

  /** Publishes collaborators' edits to a published paper: until then the site shows it as it was before them. */
  const approveEdits = useCallback(
    (paperId: string) => {
      const paper = latest.current.find((item) => item.id === paperId);
      if (!backend || !paper) return;
      enqueue(async () => {
        const result = await backend.save(
          { kind: 'approveEdits', id: paperId },
          [],
          [],
          resultsCommitMessage('publish edits to', paper.title),
          `content: update result "${paper.title}"`,
        );
        settle(result);
        if (!result.publicError) callbacks.current.onToast({ message: '修改已发布，网站约 1 分钟后更新' });
      }).catch((error: unknown) => callbacks.current.onToast({ message: describeSaveError(error) }));
    },
    [backend, enqueue, settle],
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
        if (!paper) {
          done();
          show(latest.current);
          return;
        }
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

  /**
   * Whether a dragged order of this paper's blocks is still being renumbered and saved. The block and
   * preamble dialogs rebuild from the page, which has the new order but not yet the new numbers, so they
   * must not open until then.
   */
  const isReordering = useCallback(
    (paperId: string) => pending.current.some((op) => op.kind === 'reorderBlocks' && op.paperId === paperId),
    [],
  );

  const access = useMemo<ResultsAccess>(
    () => ({
      role: collaborator ? 'collaborator' : 'owner',
      ...loadState,
      readFile: backend?.readFile ?? notReady,
      shared: roles,
      ...(collaborator ? {} : { siteBehind, syncSite, approveEdits, siteViewers: siteAccess.viewers ?? [], saveSiteViewers }),
    }),
    [collaborator, loadState, backend, roles, siteBehind, syncSite, approveEdits, siteAccess, saveSiteViewers],
  );

  return { access, privateLoaded, saveResults, saveContentOp, reorderBlocks, reload, isReordering };
}

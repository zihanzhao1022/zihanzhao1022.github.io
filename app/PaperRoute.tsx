import React, { useMemo, useState } from 'react';
import { Presentation as PresentIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { bundledContent } from '../content';
import { ContentContext } from '../components/ContentContext';
import { EditModeContext, EditModeValue } from '../components/EditMode';
import { ResultsAccess, ResultsAccessContext } from '../components/results/access';
import ResultPage from '../components/results/ResultPage';
import { mockStore } from '../editor/results/mockBackend';
import { publicView } from '../editor/results/snapshot';
import { useT } from '../lib/phrases/app';
import { accountOf, storeKeyOf } from './accounts';
import { useAccount } from './AccountContext';
import Presentation from './Presentation';
import Workspace from './Workspace';

const noop = () => {};

/** A message in place of a paper, with the way back. */
const Missing: React.FC<{ text: string; hint?: string }> = ({ text, hint }) => {
  const t = useT();
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-gray-800">{text}</p>
      {hint && <p className="mt-2 text-sm text-gray-500">{hint}</p>}
      <Link to="/" className="mt-6 inline-block text-sm text-violet-700 hover:underline">
        {t('回到首页')}
      </Link>
    </div>
  );
};

/**
 * A published paper as anyone with the link reads it: no hidden blocks, no sources, no editing. In the real
 * service the worker serves it from the owner's repository; the prototype reads the owner's mock store.
 */
const PublicPaper: React.FC<{ owner: string; slug: string }> = ({ owner, slug }) => {
  const t = useT();
  const account = useAccount();
  const author = accountOf(owner);
  const [presenting, setPresenting] = useState(false);
  const store = useMemo(() => (author ? mockStore(storeKeyOf(author.login)) : null), [author]);
  const paper = store?.papers.find((item) => item.slug === slug);
  const view = useMemo(() => (paper && !paper.hidden ? publicView(paper) : null), [paper]);
  const access = useMemo<ResultsAccess | null>(() => {
    if (!view || !store) return null;
    const published = new Set([...view.blocks.flatMap((block) => (block.output ? [block.output.pdf] : [])), ...(view.references ? [view.references.pdf] : [])]);
    return {
      role: 'collaborator',
      state: 'private',
      shared: { [view.id]: 'viewer' },
      readFile: async (path) => {
        const bytes = published.has(path) ? store.read(path) : undefined;
        if (!bytes) throw new Error(t('读不到这个文件'));
        return bytes;
      },
    };
  }, [view, store, t]);
  const mode = useMemo<EditModeValue>(
    () => ({ editing: false, loggedIn: Boolean(account), canLogin: false, ready: true, open: noop, login: noop, reorder: noop, reorderBlocks: noop }),
    [account],
  );

  if (!paper) return <Missing text={t('找不到这篇论文。')} hint={t('链接可能写错了，或者作者已经删除了它。')} />;
  if (!view || !access) {
    return <Missing text={t('这篇论文没有公开。')} hint={account ? t('作者没有把它共享给你。') : t('如果作者把它共享给了你，请先登录。')} />;
  }
  return (
    <ContentContext.Provider value={{ ...bundledContent, results: [view] }}>
      <EditModeContext.Provider value={mode}>
        <ResultsAccessContext.Provider value={access}>
          <div className="sticky top-14 z-30 -mx-4 mb-6 flex items-center gap-2 border-b border-gray-200 bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-12 md:px-12">
            <span className="mr-auto truncate text-sm text-gray-500">{t('{name} 公开的论文', { name: author?.name ?? owner })}</span>
            <button type="button" onClick={() => setPresenting(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
              <PresentIcon size={16} />
              {t('演示')}
            </button>
          </div>
          <ResultPage inApp backTo="/" backLabel={account ? t('我的论文') : t('首页')} />
          {presenting && <Presentation paper={view} readFile={access.readFile} onClose={() => setPresenting(false)} />}
        </ResultsAccessContext.Provider>
      </EditModeContext.Provider>
    </ContentContext.Provider>
  );
};

/** /p/<owner>/<slug>: the account's own paper, one shared with it, or a published one. */
const PaperRoute: React.FC = () => {
  const t = useT();
  const { owner = '', slug = '' } = useParams();
  const account = useAccount();
  if (account && owner.toLowerCase() === account.account.login.toLowerCase()) return <Workspace list={account.mine} owner />;
  if (account) {
    const shared = account.shared.content.results.find((paper) => paper.slug === slug && account.ownerOf(paper.id)?.login === owner);
    if (shared) return <Workspace list={account.shared} owner={false} paperId={shared.id} />;
    if (account.shared.access.state === 'loading') return <p className="py-24 text-center text-sm text-gray-400">{t('正在打开论文…')}</p>;
  }
  return <PublicPaper owner={owner} slug={slug} />;
};

export default PaperRoute;

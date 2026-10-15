import React, { useState } from 'react';
import { Globe, Lock, Plus, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Modal } from '../editor/components/Modal';
import { describeSaveError } from '../editor/backend';
import { useMessage } from '../lib/i18n';
import { useT } from '../lib/phrases/app';
import { ResultPaper } from '../types';
import { Account, accountOf, connectedRepo } from './accounts';
import { useAccount } from './AccountContext';
import Avatar from './Avatar';
import { newPaper, sharing } from './library';

/** What a paper holds, counted by kind. */
function Contents({ paper }: { paper: ResultPaper }) {
  const t = useT();
  const count = (kind: string) => paper.blocks.filter((block) => block.kind === kind).length;
  const parts = [
    count('text') > 0 ? t('{n} 段文字', { n: count('text') }) : '',
    count('figure') > 0 ? t('{n} 张图', { n: count('figure') }) : '',
    count('table') > 0 ? t('{n} 个表格', { n: count('table') }) : '',
  ].filter(Boolean);
  return <span>{parts.length > 0 ? parts.join(t('，')) : t('还是空的')}</span>;
}

/** Who can see one of the account's papers. */
export function Reach({ paper }: { paper: ResultPaper }) {
  const t = useT();
  const people = sharing(paper);
  if (!paper.hidden) {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-700">
        <Globe size={14} />
        {t('公开')}
      </span>
    );
  }
  if (people.length > 0) {
    return (
      <span className="inline-flex items-center gap-2 text-violet-700">
        <span className="flex -space-x-1.5">
          {people.slice(0, 3).map((person) => (
            <Avatar key={person.login} account={accountOf(person.login) ?? { login: person.login, id: 0, name: person.login }} size={20} className="ring-2 ring-white" />
          ))}
        </span>
        {t('共享给 {n} 人', { n: people.length })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-500">
      <Lock size={14} />
      {t('只有你')}
    </span>
  );
}

const ROW = 'group grid grid-cols-1 gap-x-6 gap-y-1 py-5 sm:grid-cols-[minmax(0,1fr)_auto]';

/** Starts a paper: just its title and where it is going; everything else is added on its page. */
const NewPaperDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const t = useT();
  const { account, mine } = useAccount()!;
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useMessage();

  const create = async () => {
    if (!title.trim()) {
      setProblem(() => t('先给论文起个标题'));
      return;
    }
    setBusy(true);
    try {
      const paper = newPaper({ title, venue, year: new Date().getFullYear() }, account.name, mine.content.results.map((item) => item.slug));
      await mine.saveContentOp({ kind: 'upsert', collection: 'results', item: paper as unknown as { id: string } & Record<string, unknown> });
      onClose();
      navigate(`/p/${account.login}/${paper.slug}`);
    } catch (error) {
      setProblem(() => describeSaveError(error));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('新建论文')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
            {t('取消')}
          </button>
          <button type="button" disabled={busy} onClick={() => void create()} className={BUTTON_PRIMARY}>
            {busy ? t('创建中…') : t('创建')}
          </button>
        </>
      }
    >
      <form
        className="space-y-4 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label className="block space-y-1">
          <span className="text-gray-700">{t('标题')}</span>
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100" />
        </label>
        <label className="block space-y-1">
          <span className="text-gray-700">{t('投稿去向或状态（可以不填）')}</span>
          <input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="ACL 2027" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100" />
        </label>
        <p className="text-xs text-gray-500">{t('新论文只有你能看到；建好后在页面上添加文字、图和表格，再决定分享给谁。')}</p>
        {/* Enter in either field creates the paper; the visible buttons are outside the form. */}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
        {problem && (
          <p role="alert" className="text-red-700">
            {problem}
          </p>
        )}
      </form>
    </Modal>
  );
};

/** The signed-in account's papers, then the papers others shared with it. */
const Dashboard: React.FC = () => {
  const t = useT();
  const { account, mine, shared, ownerOf } = useAccount()!;
  const [creating, setCreating] = useState(false);
  const repo = connectedRepo(account.login);
  const own = mine.content.results;
  const others = shared.content.results;

  return (
    <div className="mx-auto max-w-4xl py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="font-serif-display text-4xl text-gray-900">{t('我的论文')}</h1>
          {repo && <p className="mt-2 text-sm text-gray-500">{t('存放在 GitHub 仓库 {repo}', { repo })}</p>}
        </div>
        <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800">
          <Plus size={16} />
          {t('新建论文')}
        </button>
      </div>

      {mine.access.state === 'loading' ? (
        <p className="py-10 text-sm text-gray-400">{t('正在读取你的仓库…')}</p>
      ) : own.length === 0 ? (
        <div className="py-14">
          <p className="font-serif-display text-xl text-gray-800">{t('还没有论文')}</p>
          <p className="mt-2 max-w-md text-sm text-gray-500">{t('新建一篇，把第一张图或表格放进去，再把链接发给合作者。')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {own.map((paper) => (
            <li key={paper.id} className={ROW}>
              <div className="min-w-0">
                <Link to={`/p/${account.login}/${paper.slug}`} className="font-serif-display text-xl text-gray-900 hover:text-violet-700">
                  {paper.title}
                </Link>
                <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-gray-500">
                  {paper.venue && <span>{paper.venue}</span>}
                  <Contents paper={paper} />
                </p>
              </div>
              <div className="text-sm sm:pt-1.5">
                <Reach paper={paper} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-14 flex items-center gap-2 border-b border-gray-200 pb-3 text-sm font-medium text-gray-700">
        <Users size={16} className="text-gray-400" />
        {t('共享给我的')}
      </h2>
      {shared.access.state === 'loading' ? (
        <p className="py-6 text-sm text-gray-400">{t('正在读取…')}</p>
      ) : others.length === 0 ? (
        <p className="py-6 text-sm text-gray-500">{t('别人把论文共享给你后，会出现在这里。')}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {others.map((paper) => {
            const author: Account | undefined = ownerOf(paper.id);
            const role = shared.access.shared?.[paper.id];
            return (
              <li key={paper.id} className={ROW}>
                <div className="min-w-0">
                  <Link to={`/p/${author?.login ?? ''}/${paper.slug}`} className="font-serif-display text-xl text-gray-900 hover:text-violet-700">
                    {paper.title}
                  </Link>
                  <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-gray-500">
                    {paper.venue && <span>{paper.venue}</span>}
                    <Contents paper={paper} />
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 sm:pt-1.5">
                  {author && <Avatar account={author} size={20} />}
                  <span>{author?.name}</span>
                  <span className="text-gray-400">{role === 'editor' ? t('可编辑') : t('可查看')}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {creating && <NewPaperDialog onClose={() => setCreating(false)} />}
    </div>
  );
};

export default Dashboard;

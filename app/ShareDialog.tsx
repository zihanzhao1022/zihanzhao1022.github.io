import React, { useState } from 'react';
import { Check, Copy, Globe, Lock, X } from 'lucide-react';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Modal } from '../editor/components/Modal';
import { describeSaveError } from '../editor/backend';
import { ContentOp } from '../editor/ops';
import { ResultsSave } from '../editor/results/BlockEditor';
import { resultsCommitMessage } from '../editor/results/ops';
import { useMessage } from '../lib/i18n';
import { useT } from '../lib/phrases/app';
import { ResultPaper } from '../types';
import { Account, accountOf } from './accounts';
import Avatar from './Avatar';
import { sharing, withSharing } from './library';

interface Props {
  paper: ResultPaper;
  owner: Account;
  saveContentOp: (op: ContentOp) => Promise<void>;
  saveResults: ResultsSave;
  onClose: () => void;
}

type Role = 'viewer' | 'editor';

/** The link anyone the paper is shared with (or anyone, once public) opens it at. */
export const paperLink = (owner: string, slug: string): string => `${window.location.origin}${window.location.pathname}#/p/${owner}/${slug}`;

/** Who may read or edit a paper, by GitHub user name, and whether anyone with the link may read it. */
const ShareDialog: React.FC<Props> = ({ paper, owner, saveContentOp, saveResults, onClose }) => {
  const t = useT();
  const [people, setPeople] = useState(() => sharing(paper));
  const [login, setLogin] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useMessage();
  const link = paperLink(owner.login, paper.slug);
  const changed = JSON.stringify(people) !== JSON.stringify(sharing(paper));

  const add = () => {
    const name = login.trim().replace(/^@/, '');
    if (!name) return;
    if (name.toLowerCase() === owner.login.toLowerCase()) {
      setProblem(() => t('这是你自己的论文'));
      return;
    }
    setPeople((current) => [...current.filter((person) => person.login.toLowerCase() !== name.toLowerCase()), { login: name, role }]);
    setLogin('');
    setProblem(null);
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await work();
    } catch (error) {
      setProblem(() => describeSaveError(error));
    } finally {
      setBusy(false);
    }
  };

  const savePeople = () =>
    run(async () => {
      await saveContentOp({ kind: 'upsert', collection: 'results', item: withSharing(paper, people) as unknown as { id: string } & Record<string, unknown> });
      onClose();
    });

  const setPublic = (published: boolean) =>
    run(async () => {
      if (published && !window.confirm(t('公开后，任何拿到链接的人都能看这篇论文（看不到隐藏的块和 LaTeX 源码）。确定公开吗？'))) return;
      await saveResults(
        { kind: 'setPaperHidden', id: paper.id, hidden: !published },
        [],
        [],
        resultsCommitMessage(published ? 'publish' : 'hide', paper.title),
        '',
      );
    });

  const copy = () => {
    navigator.clipboard.writeText(link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setProblem(() => t('复制失败，请手动复制链接')),
    );
  };

  return (
    <Modal
      title={t('分享「{title}」', { title: paper.title })}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
            {changed ? t('取消') : t('完成')}
          </button>
          {changed && (
            <button type="button" disabled={busy} onClick={() => void savePeople()} className={BUTTON_PRIMARY}>
              {busy ? t('保存中…') : t('保存')}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-6 text-sm">
        <section className="space-y-3">
          <h3 className="font-medium text-gray-900">{t('邀请合作者')}</h3>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              add();
            }}
          >
            <input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder={t('GitHub 用户名')}
              aria-label={t('GitHub 用户名')}
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
            <select value={role} onChange={(event) => setRole(event.target.value as Role)} aria-label={t('权限')} className="rounded-md border border-gray-300 px-2 py-2">
              <option value="viewer">{t('可查看')}</option>
              <option value="editor">{t('可编辑')}</option>
            </select>
            <button type="submit" className={BUTTON_SECONDARY}>
              {t('添加')}
            </button>
          </form>
          <p className="text-xs text-gray-500">{t('对方用 GitHub 登录 Galley 后，会在“共享给我的”里看到这篇论文。原型里可以试 alice 和 bob。')}</p>
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
            <li className="flex items-center gap-3 px-3 py-2">
              <Avatar account={owner} />
              <span className="flex-1 text-gray-800">{owner.name}</span>
              <span className="text-xs text-gray-500">{t('作者')}</span>
            </li>
            {people.map((person) => (
              <li key={person.login} className="flex items-center gap-3 px-3 py-2">
                <Avatar account={accountOf(person.login) ?? { login: person.login, id: 0, name: person.login }} />
                <span className="flex-1 truncate text-gray-800">@{person.login}</span>
                <select
                  value={person.role}
                  onChange={(event) =>
                    setPeople((current) => current.map((item) => (item.login === person.login ? { ...item, role: event.target.value as Role } : item)))
                  }
                  aria-label={t('{login} 的权限', { login: person.login })}
                  className="rounded border border-gray-200 px-1.5 py-1 text-xs"
                >
                  <option value="viewer">{t('可查看')}</option>
                  <option value="editor">{t('可编辑')}</option>
                </select>
                <button
                  type="button"
                  onClick={() => setPeople((current) => current.filter((item) => item.login !== person.login))}
                  aria-label={t('不再和 {login} 共享', { login: person.login })}
                  className="rounded p-1 text-gray-400 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3">
          <h3 className="font-medium text-gray-900">{t('链接')}</h3>
          <div className="flex items-start gap-3 rounded-md border border-gray-200 p-3">
            {paper.hidden ? <Lock size={18} className="mt-0.5 text-gray-500" /> : <Globe size={18} className="mt-0.5 text-emerald-600" />}
            <div className="flex-1 space-y-1">
              <p className="text-gray-800">{paper.hidden ? t('只有你和上面的人能打开') : t('公开：任何拿到链接的人都能看')}</p>
              <p className="text-xs text-gray-500">
                {paper.hidden ? t('公开后，读者看不到隐藏的块和 LaTeX 源码。') : t('读者看不到隐藏的块和 LaTeX 源码。')}
              </p>
            </div>
            <button type="button" disabled={busy} onClick={() => void setPublic(Boolean(paper.hidden))} className={BUTTON_SECONDARY}>
              {paper.hidden ? t('公开') : t('取消公开')}
            </button>
          </div>
          <div className="flex gap-2">
            <input readOnly value={link} aria-label={t('论文链接')} className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600" />
            <button type="button" onClick={copy} className={BUTTON_SECONDARY}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('已复制') : t('复制链接')}
            </button>
          </div>
        </section>
        {problem && (
          <p role="alert" className="text-red-700">
            {problem}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default ShareDialog;

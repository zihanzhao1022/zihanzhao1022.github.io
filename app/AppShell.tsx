import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Repeat } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import LangSwitch from '../components/LangSwitch';
import { BUTTON_SECONDARY, Modal } from '../editor/components/Modal';
import { useT } from '../lib/phrases/app';
import { ACCOUNTS, Account, connectedRepo } from './accounts';
import Avatar from './Avatar';

/** A galley proof: a sheet with a correction mark in its margin. */
export const Mark: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <rect x="4" y="2.5" width="13" height="19" rx="1.5" fill="white" stroke="#18181b" strokeWidth="1.5" />
    <path d="M7.5 7.5h6M7.5 10.5h6M7.5 13.5h4" stroke="#a1a1aa" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M19.5 9.5c1.8 0 1.8 3 0 3" fill="none" stroke="#6d28d9" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/** Choosing one of the prototype's made-up accounts, in place of GitHub's sign-in. */
export const SignInDialog: React.FC<{ current: Account | null; onChoose: (account: Account) => void; onClose: () => void }> = ({ current, onChoose, onClose }) => {
  const t = useT();
  const notes: Record<string, string> = {
    [ACCOUNTS[0].login]: t('你的账号，已经有一篇示例论文'),
    alice: t('合作者：共享了一篇论文给你'),
    bob: t('新用户：从连接仓库开始'),
  };
  return (
    <Modal
      title={t('用 GitHub 登录（原型）')}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
          {t('取消')}
        </button>
      }
    >
      <p className="mb-4 text-sm text-gray-600">{t('原型不连真的 GitHub，选一个虚构的账号登录：')}</p>
      <ul className="space-y-2">
        {ACCOUNTS.map((account) => (
          <li key={account.login}>
            <button
              type="button"
              onClick={() => onChoose(account)}
              className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left hover:border-violet-400 ${current?.login === account.login ? 'border-violet-500 bg-violet-50/50' : 'border-gray-200'}`}
            >
              <Avatar account={account} size={32} />
              <span className="flex-1">
                <span className="block font-medium text-gray-900">{account.name}</span>
                <span className="block text-sm text-gray-500">@{account.login}</span>
              </span>
              <span className="text-right text-xs text-gray-500">{notes[account.login]}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
};

/** The account's picture, opening what it can do: switch accounts (the prototype) or sign out. */
const AccountMenu: React.FC<{ account: Account; onSwitch: () => void; onSignOut: () => void }> = ({ account, onSwitch, onSignOut }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50';
  return (
    <div ref={menu} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={t('账号')} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
        <Avatar account={account} size={30} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-sm font-medium text-gray-900">{account.name}</p>
            <p className="text-xs text-gray-500">{connectedRepo(account.login) ?? t('还没有连接仓库')}</p>
          </div>
          <button type="button" className={item} onClick={() => { setOpen(false); onSwitch(); }}>
            <Repeat size={14} />
            {t('换个账号')}
          </button>
          <button type="button" className={item} onClick={() => { setOpen(false); onSignOut(); }}>
            <LogOut size={14} />
            {t('退出登录')}
          </button>
        </div>
      )}
    </div>
  );
};

interface Props {
  account: Account | null;
  onSignIn: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

/**
 * What is under the bar: whether the page has scrolled at all (its hairline only shows once something is under it),
 * and whether a dark section ([data-under="dark"]) is passing beneath it, so it turns dark too.
 */
function useUnderBar(bar: React.RefObject<HTMLElement>, page: string): { scrolled: boolean; dark: boolean } {
  const [under, setUnder] = useState({ scrolled: false, dark: false });
  useEffect(() => {
    const check = () => {
      const height = bar.current?.getBoundingClientRect().bottom ?? 0;
      const dark = Array.from(document.querySelectorAll('[data-under="dark"]')).some((section) => {
        const { top, bottom } = section.getBoundingClientRect();
        return top < height && bottom > height / 2;
      });
      const scrolled = window.scrollY > 0;
      setUnder((current) => (current.scrolled === scrolled && current.dark === dark ? current : { scrolled, dark }));
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [bar, page]);
  return under;
}

/** The bar over every page of the app, and the room the pages get under it. */
const AppShell: React.FC<Props> = ({ account, onSignIn, onSignOut, children }) => {
  const t = useT();
  const { pathname } = useLocation();
  const bar = useRef<HTMLElement>(null);
  const { scrolled, dark } = useUnderBar(bar, pathname);
  // A paper's page holds its outline and comments beside the text.
  const paper = pathname.startsWith('/p/');
  // The landing page runs its sections edge to edge.
  const bleed = !account && pathname === '/';
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <p className="bg-[#f5f5f7] px-4 py-2 text-center text-xs text-[#6e6e73]">{t('这是原型：账号是虚构的，数据只存在这个浏览器里。')}</p>
      <header
        ref={bar}
        className={`sticky top-0 z-40 border-b backdrop-blur-xl backdrop-saturate-[1.8] transition-[background-color,border-color,color] duration-300 ${
          dark ? 'border-white/10 bg-[#161617]/80 text-white' : `bg-white/75 ${scrolled ? 'border-black/[0.08]' : 'border-transparent'}`
        }`}
      >
        <div className={`mx-auto flex h-12 items-center gap-6 px-4 sm:px-6 ${paper ? 'max-w-[92rem]' : bleed ? 'max-w-[1120px]' : 'max-w-6xl'}`}>
          <Link to="/" className="flex items-center gap-2">
            <Mark />
            <span className="font-serif-display text-xl font-semibold tracking-tight">Galley</span>
          </Link>
          {account && (
            <Link to="/" className={`text-sm ${pathname === '/' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>
              {t('我的论文')}
            </Link>
          )}
          <div className="ml-auto flex items-center gap-4">
            <LangSwitch dark={dark} />
            {account ? (
              <AccountMenu account={account} onSwitch={onSignIn} onSignOut={onSignOut} />
            ) : (
              <button type="button" onClick={onSignIn} className={`text-sm font-medium ${dark ? 'text-white/85 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}>
                {t('登录')}
              </button>
            )}
          </div>
        </div>
      </header>
      {/* A paper's blocks keep their drag handles and readers' pictures just outside them, as on the site. */}
      <main className={bleed ? '' : `mx-auto px-4 sm:px-6 ${paper ? 'max-w-[92rem] md:px-12' : 'max-w-6xl'}`}>{children}</main>
    </div>
  );
};

export default AppShell;

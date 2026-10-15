import React, { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Check, Folder, FolderInput, Globe, Lock, MoreHorizontal, Search, Tag as TagIcon, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Modal } from '../editor/components/Modal';
import { describeSaveError } from '../editor/backend';
import { useLang, useMessage } from '../lib/i18n';
import { useT } from '../lib/phrases/app';
import { ResultPaper } from '../types';
import { Account, accountOf, connectedRepo } from './accounts';
import { useAccount } from './AccountContext';
import Avatar from './Avatar';
import { newPaper, sharing } from './library';
import { TAG_LOOK, ago } from './look';
import Menu, { MenuItem, MenuLabel } from './Menu';
import { Listed, Organizer, TAG_COLORS, View, addTag, inView, moveTo, paperKey, setArchived, setTag, touch } from './organizer';
import Sidebar, { PAPERS_TYPE } from './Sidebar';

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

/** A paper as the list shows it: one of the account's own, or one shared with it. */
interface Row extends Listed {
  paper: ResultPaper;
  owner?: Account;
  href: string;
  touched?: number;
}

/** Starts a paper: just its title and where it is going; everything else is added on its page. */
const NewPaperDialog: React.FC<{ folder: string | null; onClose: () => void }> = ({ folder, onClose }) => {
  const t = useT();
  const { account, mine, organize } = useAccount()!;
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
      // A paper started while a folder is open goes into that folder.
      const key = paperKey(account.login, paper.id);
      organize((current) => touch(folder ? moveTo(current, [key], folder) : current, key));
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
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100" />
        </label>
        <label className="block space-y-1">
          <span className="text-gray-700">{t('投稿去向或状态（可以不填）')}</span>
          <input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="ACL 2027" className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100" />
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

/** Every folder as "parent / child", for the menus that move papers. */
function folderPaths(organizer: Organizer): { id: string; path: string }[] {
  const path = (id: string | null): string => {
    const folder = organizer.folders.find((item) => item.id === id);
    if (!folder) return '';
    return folder.parent ? `${path(folder.parent)} / ${folder.name}` : folder.name;
  };
  return organizer.folders.map((folder) => ({ id: folder.id, path: path(folder.id) })).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

/** Tags to put on or take off papers, and a field that makes a new tag and puts it on. */
const TagChoices: React.FC<{ keys: string[]; close: () => void }> = ({ keys, close }) => {
  const t = useT();
  const { organizer, organize } = useAccount()!;
  const [name, setName] = useState('');
  return (
    <>
      <MenuLabel>{t('标签')}</MenuLabel>
      {organizer.tags.map((tag) => {
        const on = keys.every((key) => organizer.papers[key]?.tags?.includes(tag.id));
        return (
          <MenuItem key={tag.id} checked={on} onSelect={() => organize((current) => setTag(current, keys, tag.id, !on))}>
            <span className={`h-2.5 w-2.5 rounded-full ${TAG_LOOK[tag.color].dot}`} />
            <span className="flex-1">{tag.name}</span>
            {on && <Check size={14} className="text-violet-600" />}
          </MenuItem>
        );
      })}
      <form
        className="px-2 pb-1.5 pt-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          organize((current) => {
            const made = addTag(current, name.trim(), TAG_COLORS[current.tags.length % TAG_COLORS.length]);
            return setTag(made.organizer, keys, made.id, true);
          });
          setName('');
          close();
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('新标签，回车添加')}
          aria-label={t('新标签，回车添加')}
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-[13px] outline-none focus:border-violet-400"
        />
      </form>
    </>
  );
};

/** Folders to move papers into, or out of every folder. */
const FolderChoices: React.FC<{ keys: string[]; close: () => void }> = ({ keys, close }) => {
  const t = useT();
  const { organizer, organize } = useAccount()!;
  const current = keys.length === 1 ? organizer.papers[keys[0]]?.folder : undefined;
  const move = (folder: string | null) => {
    organize((now) => moveTo(now, keys, folder));
    close();
  };
  return (
    <>
      <MenuLabel>{t('移到文件夹')}</MenuLabel>
      {folderPaths(organizer).map((folder) => (
        <MenuItem key={folder.id} checked={current === folder.id} onSelect={() => move(folder.id)}>
          <Folder size={14} className="text-gray-400" />
          <span className="flex-1 truncate">{folder.path}</span>
          {current === folder.id && <Check size={14} className="text-violet-600" />}
        </MenuItem>
      ))}
      {organizer.folders.length === 0 && <p className="px-3 py-1 text-xs text-gray-400">{t('先在左边建个文件夹')}</p>}
      <MenuItem onSelect={() => move(null)}>
        <span className="flex-1 text-gray-500">{t('不放在文件夹里')}</span>
      </MenuItem>
    </>
  );
};

type Sort = { by: 'touched' | 'title'; up: boolean };

const COLUMNS = 'grid grid-cols-[1.75rem_minmax(0,1fr)_2rem] items-center gap-x-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_9rem_7.5rem_2rem]';

/** The signed-in account's papers, its own and those shared with it, sorted into folders and tagged. */
const Dashboard: React.FC = () => {
  const t = useT();
  const lang = useLang();
  const { account, mine, shared, ownerOf, organizer, organize } = useAccount()!;
  const [view, setView] = useState<View>({ kind: 'all' });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>({ by: 'touched', up: false });
  const [creating, setCreating] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const own = mine.content.results.map((paper): Row => ({
      key: paperKey(account.login, paper.id),
      mine: true,
      title: paper.title,
      venue: paper.venue,
      paper,
      owner: account,
      href: `/p/${account.login}/${paper.slug}`,
    }));
    const others = shared.content.results.map((paper): Row => {
      const owner = ownerOf(paper.id);
      return { key: paperKey(owner?.login ?? '?', paper.id), mine: false, title: paper.title, venue: paper.venue, paper, owner, href: `/p/${owner?.login ?? ''}/${paper.slug}` };
    });
    return [...own, ...others].map((row) => ({ ...row, touched: organizer.papers[row.key]?.touched }));
  }, [mine.content.results, shared.content.results, account, ownerOf, organizer]);

  const counts = useMemo(() => {
    const live = rows.filter((row) => !organizer.papers[row.key]?.archived);
    return {
      all: live.length,
      mine: live.filter((row) => row.mine).length,
      shared: live.filter((row) => !row.mine).length,
      archived: rows.length - live.length,
      folder: (id: string) => inView(organizer, rows, { kind: 'folder', id }).length,
      tag: (id: string) => inView(organizer, rows, { kind: 'tag', id }).length,
    };
  }, [rows, organizer]);

  const shown = useMemo(() => {
    const direction = sort.up ? 1 : -1;
    return [...inView(organizer, rows, view, search)].sort((a, b) =>
      sort.by === 'title' ? direction * a.title.localeCompare(b.title, undefined, { numeric: true }) : direction * ((a.touched ?? 0) - (b.touched ?? 0)),
    );
  }, [organizer, rows, view, search, sort]);

  const repo = connectedRepo(account.login);
  const loading = mine.access.state === 'loading' || shared.access.state === 'loading';
  // Only what is on screen counts as chosen; changing the view or the search leaves the rest alone.
  const keys = shown.filter((row) => selected.has(row.key)).map((row) => row.key);
  const allChosen = shown.length > 0 && keys.length === shown.length;
  const archive = view.kind === 'archived';

  let heading: React.ReactNode = t('全部论文');
  if (view.kind === 'mine') heading = t('我的论文');
  if (view.kind === 'shared') heading = t('共享给我的');
  if (view.kind === 'archived') heading = t('已归档');
  if (view.kind === 'folder') heading = folderPaths(organizer).find((folder) => folder.id === view.id)?.path ?? t('文件夹');
  if (view.kind === 'tag') {
    const tag = organizer.tags.find((item) => item.id === view.id);
    heading = (
      <span className="inline-flex items-center gap-3">
        {tag && <span className={`h-3 w-3 rounded-full ${TAG_LOOK[tag.color].dot}`} />}
        {tag?.name}
      </span>
    );
  }

  const choose = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const sortBy = (by: Sort['by'], label: string) => (
    <button
      type="button"
      onClick={() => setSort((current) => (current.by === by ? { by, up: !current.up } : { by, up: by === 'title' }))}
      className={`inline-flex items-center gap-1 text-left hover:text-gray-900 ${sort.by === by ? 'text-gray-900' : ''}`}
    >
      {label}
      {sort.by === by && (sort.up ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );

  const bar = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm text-gray-700 transition-colors duration-150 hover:bg-white';

  return (
    <div className="grid gap-8 py-8 md:grid-cols-[14.5rem_minmax(0,1fr)] md:gap-10">
      <aside className="rounded-2xl bg-[#f5f5f7] p-3 md:sticky md:top-[4.25rem] md:max-h-[calc(100svh-5.25rem)] md:self-start md:overflow-y-auto">
        <Sidebar
          organizer={organizer}
          organize={organize}
          view={view}
          onView={(next) => {
            setView(next);
            setSelected(new Set());
          }}
          counts={counts}
          onNew={() => setCreating(true)}
        />
        {repo && <p className="mt-6 break-words px-2 pb-1 text-xs leading-relaxed text-gray-400">{t('存放在 GitHub 仓库 {repo}', { repo })}</p>}
      </aside>

      <section className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="galley-display text-[2rem] text-gray-900">{heading}</h1>
          <label className="relative block w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('搜索标题或投稿去向')}
              aria-label={t('搜索标题或投稿去向')}
              className="w-full rounded-xl border border-transparent bg-black/[0.04] py-2 pl-9 pr-3 text-sm outline-none transition-colors duration-150 focus:border-violet-300 focus:bg-white"
            />
          </label>
        </div>

        <div className={`mt-5 flex min-h-[2.5rem] flex-wrap items-center gap-1 rounded-xl px-3 transition-colors duration-150 ${keys.length > 0 ? 'bg-violet-50' : ''}`}>
          {keys.length > 0 ? (
            <>
              <span className="mr-3 text-sm font-medium text-violet-900">{t('已选 {n} 篇', { n: keys.length })}</span>
              <Menu label={t('标签')} align="left" className={bar} trigger={<><TagIcon size={14} />{t('标签')}</>}>
                {(close) => <TagChoices keys={keys} close={close} />}
              </Menu>
              <Menu label={t('移到文件夹')} align="left" className={bar} trigger={<><FolderInput size={14} />{t('移到文件夹')}</>}>
                {(close) => <FolderChoices keys={keys} close={close} />}
              </Menu>
              <button
                type="button"
                onClick={() => {
                  organize((current) => setArchived(current, keys, !archive));
                  setSelected(new Set());
                }}
                className={bar}
              >
                {archive ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                {archive ? t('取消归档') : t('归档')}
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className={`${bar} ml-auto text-gray-500`}>
                {t('取消选择')}
              </button>
            </>
          ) : (
            // Dragging papers onto folders needs a mouse, and the folders sit beside the list only on wide screens.
            <span className="hidden text-sm text-gray-400 md:inline">{t('勾选几篇可以一起打标签、移动或归档；也可以把论文直接拖到左边的文件夹上。')}</span>
          )}
        </div>

        <div className={`${COLUMNS} mt-2 border-b border-black/[0.06] px-3 pb-2 text-xs text-gray-500`}>
          <input
            type="checkbox"
            checked={allChosen}
            disabled={shown.length === 0}
            onChange={() => setSelected(allChosen ? new Set() : new Set(shown.map((row) => row.key)))}
            aria-label={t('全选')}
            className="h-4 w-4 accent-violet-700"
          />
          {sortBy('title', t('标题'))}
          <span className="hidden sm:block">{t('拥有者')}</span>
          <span className="hidden sm:block">{sortBy('touched', t('最近修改'))}</span>
          <span />
        </div>

        {loading ? (
          <p className="px-3 py-10 text-sm text-gray-400">{t('正在读取你的仓库…')}</p>
        ) : shown.length === 0 ? (
          <div className="px-3 py-14">
            <p className="text-gray-800">
              {search ? t('没有找到这样的论文') : archive ? t('没有归档的论文') : view.kind === 'shared' ? t('别人把论文共享给你后，会出现在这里。') : t('这里还没有论文')}
            </p>
            {!search && !archive && view.kind !== 'shared' && <p className="mt-1 text-sm text-gray-500">{t('新建一篇，把第一张图或表格放进去，再把链接发给合作者。')}</p>}
          </div>
        ) : (
          <ul>
            {shown.map((row, index) => {
              const placement = organizer.papers[row.key] ?? {};
              const tags = organizer.tags.filter((tag) => placement.tags?.includes(tag.id));
              const chosen = selected.has(row.key);
              return (
                <li
                  key={row.key}
                  draggable
                  onDragStart={(event) => {
                    // A chosen row carries everything chosen with it.
                    event.dataTransfer.setData(PAPERS_TYPE, JSON.stringify(chosen ? keys : [row.key]));
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                  className={`galley-row ${COLUMNS} border-b border-black/[0.06] px-3 py-3 transition-colors duration-150 ${chosen ? 'bg-violet-50/70' : 'hover:bg-black/[0.02]'}`}
                >
                  <input type="checkbox" checked={chosen} onChange={() => choose(row.key)} aria-label={t('选中《{title}》', { title: row.title })} className="h-4 w-4 accent-violet-700" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link to={row.href} draggable={false} className="min-w-0 font-medium text-gray-900 hover:text-violet-700 sm:truncate">
                        {row.title}
                      </Link>
                      {tags.map((tag) => (
                        <span key={tag.id} className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-xs ${TAG_LOOK[tag.color].chip}`}>
                          {tag.name}
                          <button
                            type="button"
                            onClick={() => organize((current) => setTag(current, [row.key], tag.id, false))}
                            aria-label={t('去掉标签 {name}', { name: tag.name })}
                            title={t('去掉标签 {name}', { name: tag.name })}
                            className="rounded-full p-0.5 opacity-50 transition-opacity duration-150 hover:opacity-100"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
                      {row.venue && <span>{row.venue}</span>}
                      {row.mine && <Reach paper={row.paper} />}
                      <span className="sm:hidden">{row.touched ? ago(row.touched, lang) : ''}</span>
                    </p>
                  </div>
                  <span className="hidden min-w-0 items-center gap-2 text-sm text-gray-600 sm:flex">
                    {row.mine ? (
                      t('你')
                    ) : (
                      <>
                        {row.owner && <Avatar account={row.owner} size={20} />}
                        <span className="truncate">{row.owner?.name}</span>
                      </>
                    )}
                  </span>
                  <span className="hidden text-sm tabular-nums text-gray-500 sm:block">{row.touched ? ago(row.touched, lang) : '—'}</span>
                  <Menu label={t('更多操作')} trigger={<MoreHorizontal size={16} />} className="rounded-lg p-1.5 text-gray-500 transition-colors duration-150 hover:bg-black/5">
                    {(close) => (
                      <>
                        <TagChoices keys={[row.key]} close={close} />
                        <div className="my-1 border-t border-black/5" />
                        <FolderChoices keys={[row.key]} close={close} />
                        <div className="my-1 border-t border-black/5" />
                        <MenuItem
                          onSelect={() => {
                            organize((current) => setArchived(current, [row.key], !placement.archived));
                            close();
                          }}
                        >
                          {placement.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                          {placement.archived ? t('取消归档') : t('归档')}
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {creating && <NewPaperDialog folder={view.kind === 'folder' ? view.id : null} onClose={() => setCreating(false)} />}
    </div>
  );
};

export default Dashboard;

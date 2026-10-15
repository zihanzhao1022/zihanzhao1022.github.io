import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Globe,
  Lock,
  MoreHorizontal,
  Search,
  Tag as TagIcon,
  X,
} from 'lucide-react';
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
import { FOLDER_TYPE, PAPERS_TYPE, accepts, dragged, dropping } from './dragging';
import {
  Line,
  Listed,
  Order,
  Organizer,
  TAG_COLORS,
  View,
  addFolder,
  addTag,
  folderAndInside,
  inView,
  moveTo,
  paperKey,
  paperOrder,
  removeFolder,
  renameFolder,
  setArchived,
  setTag,
  touch,
  tree,
} from './organizer';
import Sidebar, { NameInput } from './Sidebar';

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

const COLUMNS = 'grid grid-cols-[1.75rem_minmax(0,1fr)_2rem] items-center gap-x-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_9rem_7.5rem_2rem]';

/** How far each folder level steps in, and where its guide line runs: past the row's padding, the checkbox
    column and its gap, through the middle of the folder's arrow. */
const INDENT = 1.5;
const indent = (depth: number): string => `${depth * INDENT}rem`;
const guideAt = (level: number): string => `calc(3.25rem + ${level * INDENT + 0.5}rem)`;

/** Folders whose contents this browser keeps folded in the list, per account. */
const CLOSED_KEY = 'galley-closed-folders';

function loadClosed(login: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(`${CLOSED_KEY}:${login}`) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

type Editing = { kind: 'new-folder'; parent: string | null } | { kind: 'rename'; id: string } | null;

/** The signed-in account's papers, its own and those shared with it, in its folders and with its tags. */
const Dashboard: React.FC = () => {
  const t = useT();
  const lang = useLang();
  const { account, mine, shared, ownerOf, organizer, organize } = useAccount()!;
  const [view, setView] = useState<View>({ kind: 'all' });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<Order>({ by: 'touched', up: false });
  const [creating, setCreating] = useState(false);
  const [closed, setClosed] = useState(() => loadClosed(account.login));
  const [editing, setEditing] = useState<Editing>(null);
  // The folder a drag would drop into (null: out of every folder), while one is over the list.
  const [target, setTarget] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(`${CLOSED_KEY}:${account.login}`, JSON.stringify([...closed]));
    } catch {
      // Folds are a convenience; they simply reset.
    }
  }, [closed, account.login]);

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

  // Searches, tags and the archive cut across folders, so they list papers flat, each with the folder it is in.
  const flat = search.trim() !== '' || view.kind === 'tag' || view.kind === 'archived';
  const base = view.kind === 'folder' ? view.id : null;
  const lines = useMemo<Line<Row>[]>(() => {
    if (flat) return [...inView(organizer, rows, view, search)].sort(paperOrder(order)).map((paper) => ({ kind: 'paper', paper, depth: 0, path: [] }));
    const live = inView(organizer, rows, view.kind === 'folder' ? { kind: 'all' } : view);
    return tree(organizer, live, { base, closed, empty: view.kind === 'all' || view.kind === 'folder', order });
  }, [flat, organizer, rows, view, search, order, base, closed]);
  const shown = lines.flatMap((line) => (line.kind === 'paper' ? [line.paper] : []));

  const repo = connectedRepo(account.login);
  const loading = mine.access.state === 'loading' || shared.access.state === 'loading';
  // Only what is on screen counts as chosen; changing the view or the search leaves the rest alone.
  const keys = shown.filter((row) => selected.has(row.key)).map((row) => row.key);
  const allChosen = shown.length > 0 && keys.length === shown.length;
  const archive = view.kind === 'archived';
  const paths = folderPaths(organizer);

  let heading: React.ReactNode = t('全部论文');
  if (view.kind === 'mine') heading = t('我的论文');
  if (view.kind === 'shared') heading = t('共享给我的');
  if (view.kind === 'archived') heading = t('已归档');
  if (view.kind === 'folder') heading = paths.find((folder) => folder.id === view.id)?.path ?? t('文件夹');
  if (view.kind === 'tag') {
    const tag = organizer.tags.find((item) => item.id === view.id);
    heading = (
      <span className="inline-flex items-center gap-3">
        {tag && <span className={`h-3 w-3 rounded-full ${TAG_LOOK[tag.color].dot}`} />}
        {tag?.name}
      </span>
    );
  }

  const show = (next: View) => {
    setView(next);
    setSelected(new Set());
    setEditing(null);
  };

  const choose = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const fold = (id: string, open?: boolean) =>
    setClosed((current) => {
      const next = new Set(current);
      if (open ?? next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Dropping on a folder's line puts things into it; on a paper's line, into the folder that paper is in; on the
  // list's empty space, into the folder the list shows (or out of every folder).
  const dragOver = (event: React.DragEvent, into: string | null) => {
    event.stopPropagation();
    if (!accepts(organizer, event.dataTransfer.types, into)) {
      setTarget(undefined);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setTarget(into);
  };
  const drop = (event: React.DragEvent, into: string | null) => {
    event.stopPropagation();
    setTarget(undefined);
    const change = dropping(event.dataTransfer, into);
    if (!change) return;
    event.preventDefault();
    organize(change);
  };
  const dropInto = (into: string | null): React.HTMLAttributes<HTMLLIElement> =>
    flat ? {} : { onDragOver: (event) => dragOver(event, into), onDrop: (event) => drop(event, into) };
  const dragEnd = () => {
    dragged.folder = null;
    setTarget(undefined);
  };
  // The lines inside the folder a drag would drop into are tinted with it.
  const tinted = (path: string[]) => target !== undefined && target !== null && target !== base && path.includes(target);

  const sortBy = (by: Order['by'], label: string) => (
    <button
      type="button"
      onClick={() => setOrder((current) => (current.by === by ? { by, up: !current.up } : { by, up: by === 'title' }))}
      className={`inline-flex items-center gap-1 text-left hover:text-gray-900 ${order.by === by ? 'text-gray-900' : ''}`}
    >
      {label}
      {order.by === by && (order.up ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );

  /** Thin lines down the left of a line, one for each folder it is in, so a folder's contents read as one. */
  const guides = (depth: number) =>
    Array.from({ length: depth }, (_, level) => (
      <span key={level} aria-hidden="true" className="pointer-events-none absolute -bottom-px top-0 w-px bg-black/[0.08]" style={{ left: guideAt(level) }} />
    ));

  const newFolderLine = (parent: string | null, depth: number) => (
    <li key={`new-folder:${parent ?? ''}`} className={`relative ${COLUMNS} border-b border-black/[0.06] px-3 py-2`}>
      {guides(depth)}
      <span />
      <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: indent(depth) }}>
        <span className="w-4 shrink-0" />
        <Folder size={16} className="shrink-0 text-violet-500" />
        <NameInput
          placeholder={t('文件夹名')}
          className="ml-0.5 w-full max-w-xs"
          onDone={(name) => {
            if (name) organize((current) => addFolder(current, name, parent).organizer);
            setEditing(null);
          }}
        />
      </div>
    </li>
  );

  // Rows come in after one another within each folder, so opening a folder plays its own rows from the top.
  const delays = new Map<string, number>();
  const delayOf = (path: string[]) => {
    const at = path.join('/');
    const n = delays.get(at) ?? 0;
    delays.set(at, n + 1);
    return `${Math.min(n, 8) * 30}ms`;
  };

  const folderLine = (line: Extract<Line<Row>, { kind: 'folder' }>) => {
    const { folder, depth, path, count, latest, open, inner } = line;
    const renaming = editing?.kind === 'rename' && editing.id === folder.id;
    const Icon = open && inner ? FolderOpen : Folder;
    return (
      <React.Fragment key={`folder:${folder.id}`}>
        <li
          draggable={!renaming}
          onDragStart={(event) => {
            dragged.folder = folder.id;
            event.dataTransfer.setData(FOLDER_TYPE, folder.id);
            event.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={dragEnd}
          {...dropInto(folder.id)}
          onDoubleClick={() => show({ kind: 'folder', id: folder.id })}
          style={{ animationDelay: delayOf(path) }}
          className={`galley-row relative ${COLUMNS} border-b border-black/[0.06] px-3 py-2.5 transition-colors duration-150 ${
            target === folder.id ? 'bg-violet-100/80' : tinted(path) ? 'bg-violet-50/70' : 'hover:bg-black/[0.02]'
          }`}
        >
          {guides(depth)}
          {/* Its own guide starts under its arrow and runs down beside what it holds. */}
          {open && inner && <span aria-hidden="true" className="pointer-events-none absolute -bottom-px top-[calc(50%+0.625rem)] w-px bg-black/[0.08]" style={{ left: guideAt(depth) }} />}
          <span />
          <div className="flex min-w-0 items-center" style={{ paddingLeft: indent(depth) }}>
            {renaming ? (
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="w-4 shrink-0" />
                <Icon size={16} className="shrink-0 text-violet-500" />
                <NameInput
                  initial={folder.name}
                  placeholder={t('文件夹名')}
                  className="ml-0.5 w-full max-w-xs"
                  onDone={(name) => {
                    if (name) organize((current) => renameFolder(current, folder.id, name));
                    setEditing(null);
                  }}
                />
              </span>
            ) : (
              <button type="button" onClick={() => fold(folder.id)} aria-expanded={inner ? open : undefined} className="flex min-w-0 items-center gap-1.5 text-left">
                <span className={`flex w-4 shrink-0 justify-center text-gray-400 ${inner ? '' : 'invisible'}`}>
                  <ChevronRight size={14} className={`transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${open ? 'rotate-90' : ''}`} />
                </span>
                <Icon size={16} className="shrink-0 text-violet-500" />
                <span className="ml-0.5 truncate font-medium text-gray-900">{folder.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-400">{count}</span>
              </button>
            )}
          </div>
          <span className="hidden sm:block" />
          <span className="hidden text-sm tabular-nums text-gray-500 sm:block">{latest ? ago(latest, lang) : '—'}</span>
          <Menu label={t('文件夹操作')} trigger={<MoreHorizontal size={16} />} className="rounded-lg p-1.5 text-gray-500 transition-colors duration-150 hover:bg-black/5">
            {(close) => (
              <>
                <MenuItem onSelect={() => { close(); show({ kind: 'folder', id: folder.id }); }}>{t('打开文件夹')}</MenuItem>
                <MenuItem onSelect={() => { close(); fold(folder.id, true); setEditing({ kind: 'new-folder', parent: folder.id }); }}>{t('新建子文件夹')}</MenuItem>
                <MenuItem onSelect={() => { close(); setEditing({ kind: 'rename', id: folder.id }); }}>{t('重命名')}</MenuItem>
                <MenuItem
                  danger
                  onSelect={() => {
                    close();
                    if (view.kind === 'folder' && folderAndInside(organizer, folder.id).has(view.id)) show({ kind: 'all' });
                    organize((current) => removeFolder(current, folder.id));
                  }}
                >
                  {t('删除文件夹（里面的论文移到上一层）')}
                </MenuItem>
              </>
            )}
          </Menu>
        </li>
        {editing?.kind === 'new-folder' && editing.parent === folder.id && newFolderLine(folder.id, depth + 1)}
      </React.Fragment>
    );
  };

  const paperLine = (line: Extract<Line<Row>, { kind: 'paper' }>) => {
    const { paper: row, depth, path } = line;
    const placement = organizer.papers[row.key] ?? {};
    const tags = organizer.tags.filter((tag) => placement.tags?.includes(tag.id));
    const chosen = selected.has(row.key);
    const where = flat && placement.folder ? paths.find((folder) => folder.id === placement.folder)?.path : undefined;
    return (
      <li
        key={row.key}
        draggable
        onDragStart={(event) => {
          // A chosen row carries everything chosen with it.
          dragged.folder = null;
          event.dataTransfer.setData(PAPERS_TYPE, JSON.stringify(chosen ? keys : [row.key]));
          event.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={dragEnd}
        {...dropInto(path.length > 0 ? path[path.length - 1] : null)}
        style={{ animationDelay: delayOf(path) }}
        className={`galley-row relative ${COLUMNS} border-b border-black/[0.06] px-3 py-3 transition-colors duration-150 ${
          chosen ? 'bg-violet-50/70' : tinted(path) ? 'bg-violet-50/70' : 'hover:bg-black/[0.02]'
        }`}
      >
        {guides(depth)}
        <input type="checkbox" checked={chosen} onChange={() => choose(row.key)} aria-label={t('选中《{title}》', { title: row.title })} className="h-4 w-4 accent-violet-700" />
        <div className="flex min-w-0 items-start gap-1.5" style={{ paddingLeft: indent(depth) }}>
          {!flat && <span className="w-4 shrink-0" />}
          <FileText size={16} className="mt-[3px] shrink-0 text-gray-400" />
          <div className="ml-0.5 min-w-0 flex-1">
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
              {where && (
                <span className="inline-flex items-center gap-1">
                  <Folder size={12} className="text-violet-500" />
                  {where}
                </span>
              )}
              {row.venue && <span>{row.venue}</span>}
              {row.mine && <Reach paper={row.paper} />}
              <span className="sm:hidden">{row.touched ? ago(row.touched, lang) : ''}</span>
            </p>
          </div>
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
  };

  const bar = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm text-gray-700 transition-colors duration-150 hover:bg-white';
  // New folders can be made here where empty folders are listed: in everything, and inside a folder.
  const foldersHere = !flat && (view.kind === 'all' || view.kind === 'folder');

  return (
    <div className="grid gap-8 py-8 md:grid-cols-[14.5rem_minmax(0,1fr)] md:gap-10">
      <aside className="rounded-2xl bg-[#f5f5f7] p-3 md:sticky md:top-[4.25rem] md:max-h-[calc(100svh-5.25rem)] md:self-start md:overflow-y-auto">
        <Sidebar organizer={organizer} organize={organize} view={view} onView={show} counts={counts} onNew={() => setCreating(true)} />
        {repo && <p className="mt-6 break-words px-2 pb-1 text-xs leading-relaxed text-gray-400">{t('存放在 GitHub 仓库 {repo}', { repo })}</p>}
      </aside>

      <section className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="galley-display text-[2rem] text-gray-900">{heading}</h1>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {foldersHere && (
              <button
                type="button"
                onClick={() => setEditing({ kind: 'new-folder', parent: base })}
                aria-label={t('新建文件夹')}
                title={t('新建文件夹')}
                className="galley-press flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-black/[0.05] hover:text-gray-800"
              >
                <FolderPlus size={17} />
              </button>
            )}
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
            // Dragging papers onto folders needs a mouse; on phones the hint would only mislead.
            <span className="hidden text-sm text-gray-400 md:inline">{t('勾选几篇可以一起打标签、移动或归档；把论文拖到文件夹上就能放进去。')}</span>
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
        ) : lines.length === 0 && editing?.kind !== 'new-folder' ? (
          <div className="px-3 py-14">
            <p className="text-gray-800">
              {search ? t('没有找到这样的论文') : archive ? t('没有归档的论文') : view.kind === 'shared' ? t('别人把论文共享给你后，会出现在这里。') : t('这里还没有论文')}
            </p>
            {!search && !archive && view.kind !== 'shared' && <p className="mt-1 text-sm text-gray-500">{t('新建一篇，把第一张图或表格放进去，再把链接发给合作者。')}</p>}
          </div>
        ) : (
          <ul
            onDragOver={flat ? undefined : (event) => dragOver(event, base)}
            onDrop={flat ? undefined : (event) => drop(event, base)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(undefined);
            }}
            className={`rounded-b-xl pb-16 transition-shadow duration-150 ${target === base ? 'shadow-[inset_0_0_0_2px_rgba(167,139,250,0.55)]' : ''}`}
          >
            {editing?.kind === 'new-folder' && editing.parent === base && newFolderLine(base, 0)}
            {lines.map((line) => (line.kind === 'folder' ? folderLine(line) : paperLine(line)))}
          </ul>
        )}
      </section>
      {creating && <NewPaperDialog folder={base} onClose={() => setCreating(false)} />}
    </div>
  );
};

export default Dashboard;

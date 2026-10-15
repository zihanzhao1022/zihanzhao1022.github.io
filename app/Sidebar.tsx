import React, { useState } from 'react';
import { Archive, ChevronDown, ChevronRight, FileText, Folder, FolderPlus, Inbox, MoreHorizontal, Plus, Users } from 'lucide-react';
import { useT } from '../lib/phrases/app';
import { TAG_LOOK } from './look';
import Menu, { MenuItem, MenuLabel } from './Menu';
import {
  Folder as FolderType,
  Organizer,
  TAG_COLORS,
  TagColor,
  View,
  addFolder,
  addTag,
  changeTag,
  folderAndInside,
  moveFolder,
  moveTo,
  removeFolder,
  removeTag,
  renameFolder,
} from './organizer';

/** What dragging a paper row or a folder carries. */
export const PAPERS_TYPE = 'application/x-galley-papers';
const FOLDER_TYPE = 'application/x-galley-folder';

interface Props {
  organizer: Organizer;
  organize: (change: (organizer: Organizer) => Organizer) => void;
  view: View;
  onView: (view: View) => void;
  /** How many papers each kind of view holds, and each folder and tag (archived papers left out). */
  counts: { all: number; mine: number; shared: number; archived: number; folder: (id: string) => number; tag: (id: string) => number };
  onNew: () => void;
}

const same = (a: View, b: View): boolean => a.kind === b.kind && ('id' in a ? a.id : '') === ('id' in b ? b.id : '');

/** A line of the sidebar, highlighted when its view is the one shown, or when something is dragged over it. */
const Row: React.FC<{
  active: boolean;
  dropping?: boolean;
  depth?: number;
  icon: React.ReactNode;
  label: React.ReactNode;
  count?: number;
  onClick: () => void;
  actions?: React.ReactNode;
  dropProps?: React.HTMLAttributes<HTMLDivElement>;
}> = ({ active, dropping = false, depth = 0, icon, label, count, onClick, actions, dropProps }) => (
  <div
    {...dropProps}
    className={`group flex items-center rounded-lg pr-1 transition-colors duration-150 ${dropping ? 'bg-violet-100 ring-1 ring-violet-300' : active ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'hover:bg-black/[0.04]'}`}
    style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
  >
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-[13px] text-gray-800">
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-xs tabular-nums text-gray-400">{count}</span>}
    </button>
    {/* The actions stay while their menu is open, even once the pointer has left the row. */}
    {actions && <div className="opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100">{actions}</div>}
  </div>
);

/** A name typed in place: Enter keeps it, Esc or leaving the field drops it. */
const NameField: React.FC<{ initial?: string; placeholder: string; depth?: number; onDone: (name: string | null) => void }> = ({ initial = '', placeholder, depth = 0, onDone }) => {
  const [name, setName] = useState(initial);
  const done = (keep: boolean) => onDone(keep && name.trim() ? name.trim() : null);
  return (
    <div className="py-0.5 pr-1" style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}>
      <input
        autoFocus
        value={name}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') done(true);
          if (event.key === 'Escape') done(false);
        }}
        onBlur={() => done(true)}
        className="w-full rounded-md border border-violet-300 bg-white px-2 py-1 text-[13px] outline-none ring-2 ring-violet-100"
      />
    </div>
  );
};

type Editing = { kind: 'new-folder'; parent: string | null } | { kind: 'rename-folder'; id: string } | { kind: 'new-tag' } | { kind: 'rename-tag'; id: string } | null;

/** The left column of the list of papers: kinds of papers, the account's folders and its tags. */
const Sidebar: React.FC<Props> = ({ organizer, organize, view, onView, counts, onNew }) => {
  const t = useT();
  const [editing, setEditing] = useState<Editing>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [over, setOver] = useState<string | null>(null);

  // Papers or a folder dropped on a folder (or on "all papers", which takes papers out of every folder).
  const dropOn = (target: string | null): React.HTMLAttributes<HTMLDivElement> => ({
    onDragOver: (event) => {
      const papers = event.dataTransfer.types.includes(PAPERS_TYPE);
      const folder = target !== null && event.dataTransfer.types.includes(FOLDER_TYPE);
      if (!papers && !folder) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setOver(target ?? 'root');
    },
    // Moving between the row's own parts is not leaving it.
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null);
    },
    onDrop: (event) => {
      setOver(null);
      const papers = event.dataTransfer.getData(PAPERS_TYPE);
      const folder = event.dataTransfer.getData(FOLDER_TYPE);
      if (papers) {
        event.preventDefault();
        organize((current) => moveTo(current, JSON.parse(papers) as string[], target));
      } else if (folder && folder !== target) {
        event.preventDefault();
        organize((current) => moveFolder(current, folder, target));
      }
    },
  });

  const children = (parent: string | null): FolderType[] =>
    organizer.folders.filter((folder) => folder.parent === parent).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const folderRows = (parent: string | null, depth: number): React.ReactNode =>
    children(parent).map((folder) => {
      const inner = children(folder.id);
      const open = !closed.has(folder.id);
      const active = view.kind === 'folder' && view.id === folder.id;
      return (
        <div key={folder.id}>
          {editing?.kind === 'rename-folder' && editing.id === folder.id ? (
            <NameField
              initial={folder.name}
              placeholder={t('文件夹名')}
              depth={depth}
              onDone={(name) => {
                if (name) organize((current) => renameFolder(current, folder.id, name));
                setEditing(null);
              }}
            />
          ) : (
            <div draggable onDragStart={(event) => event.dataTransfer.setData(FOLDER_TYPE, folder.id)}>
              <Row
                active={active}
                dropping={over === folder.id}
                depth={depth}
                dropProps={dropOn(folder.id)}
                icon={
                  <span className="flex items-center gap-1">
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={open ? t('收起') : t('展开')}
                      onClick={(event) => {
                        event.stopPropagation();
                        setClosed((current) => {
                          const next = new Set(current);
                          if (next.has(folder.id)) next.delete(folder.id);
                          else next.add(folder.id);
                          return next;
                        });
                      }}
                      className={`text-gray-400 ${inner.length === 0 ? 'invisible' : ''}`}
                    >
                      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    <Folder size={15} className={active ? 'text-violet-600' : 'text-gray-400'} />
                  </span>
                }
                label={folder.name}
                count={counts.folder(folder.id)}
                onClick={() => onView({ kind: 'folder', id: folder.id })}
                actions={
                  <Menu label={t('文件夹操作')} trigger={<MoreHorizontal size={14} />} className="rounded p-1 text-gray-500 hover:bg-black/5">
                    {(close) => (
                      <>
                        <MenuItem onSelect={() => { close(); setClosed((current) => { const next = new Set(current); next.delete(folder.id); return next; }); setEditing({ kind: 'new-folder', parent: folder.id }); }}>{t('新建子文件夹')}</MenuItem>
                        <MenuItem onSelect={() => { close(); setEditing({ kind: 'rename-folder', id: folder.id }); }}>{t('重命名')}</MenuItem>
                        <MenuItem
                          danger
                          onSelect={() => {
                            close();
                            if (folderAndInside(organizer, folder.id).has(view.kind === 'folder' ? view.id : '')) onView({ kind: 'all' });
                            organize((current) => removeFolder(current, folder.id));
                          }}
                        >
                          {t('删除文件夹（里面的论文移到上一层）')}
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                }
              />
            </div>
          )}
          {open && folderRows(folder.id, depth + 1)}
          {editing?.kind === 'new-folder' && editing.parent === folder.id && (
            <NameField
              placeholder={t('文件夹名')}
              depth={depth + 1}
              onDone={(name) => {
                if (name) organize((current) => addFolder(current, name, folder.id).organizer);
                setEditing(null);
              }}
            />
          )}
        </div>
      );
    });

  const kinds: { view: View; icon: React.ReactNode; label: string; count: number; drop?: boolean }[] = [
    { view: { kind: 'all' }, icon: <Inbox size={15} className="text-gray-400" />, label: t('全部论文'), count: counts.all, drop: true },
    { view: { kind: 'mine' }, icon: <FileText size={15} className="text-gray-400" />, label: t('我的论文'), count: counts.mine },
    { view: { kind: 'shared' }, icon: <Users size={15} className="text-gray-400" />, label: t('共享给我的'), count: counts.shared },
    { view: { kind: 'archived' }, icon: <Archive size={15} className="text-gray-400" />, label: t('已归档'), count: counts.archived },
  ];

  const colorNames: Record<TagColor, string> = {
    red: t('红色'),
    orange: t('橙色'),
    yellow: t('黄色'),
    green: t('绿色'),
    teal: t('青色'),
    blue: t('蓝色'),
    violet: t('紫色'),
    gray: t('灰色'),
  };

  const section = 'mb-1 mt-6 flex items-center justify-between pl-2 pr-1 text-xs font-medium text-gray-500';
  const add = 'rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700';

  return (
    <nav aria-label={t('论文分类')} className="space-y-0.5">
      <button type="button" onClick={onNew} className="galley-press mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-800">
        <Plus size={16} />
        {t('新建论文')}
      </button>
      {kinds.map((kind) => (
        <Row
          key={kind.view.kind}
          active={same(view, kind.view)}
          dropping={kind.drop === true && over === 'root'}
          dropProps={kind.drop ? dropOn(null) : undefined}
          icon={kind.icon}
          label={kind.label}
          count={kind.count}
          onClick={() => onView(kind.view)}
        />
      ))}

      <div className={section}>
        <span>{t('文件夹')}</span>
        <button type="button" onClick={() => setEditing({ kind: 'new-folder', parent: null })} aria-label={t('新建文件夹')} title={t('新建文件夹')} className={add}>
          <FolderPlus size={14} />
        </button>
      </div>
      {folderRows(null, 0)}
      {editing?.kind === 'new-folder' && editing.parent === null && (
        <NameField
          placeholder={t('文件夹名')}
          onDone={(name) => {
            if (name) organize((current) => addFolder(current, name, null).organizer);
            setEditing(null);
          }}
        />
      )}
      {organizer.folders.length === 0 && editing?.kind !== 'new-folder' && <p className="px-2 py-1 text-xs text-gray-400">{t('建个文件夹，把论文拖进去')}</p>}

      <div className={section}>
        <span>{t('标签')}</span>
        <button type="button" onClick={() => setEditing({ kind: 'new-tag' })} aria-label={t('新建标签')} title={t('新建标签')} className={add}>
          <Plus size={14} />
        </button>
      </div>
      {organizer.tags.map((tag) =>
        editing?.kind === 'rename-tag' && editing.id === tag.id ? (
          <NameField
            key={tag.id}
            initial={tag.name}
            placeholder={t('标签名')}
            onDone={(name) => {
              if (name) organize((current) => changeTag(current, tag.id, { name }));
              setEditing(null);
            }}
          />
        ) : (
          <Row
            key={tag.id}
            active={view.kind === 'tag' && view.id === tag.id}
            icon={<span className={`ml-0.5 h-2.5 w-2.5 rounded-full ${TAG_LOOK[tag.color].dot}`} />}
            label={tag.name}
            count={counts.tag(tag.id)}
            onClick={() => onView({ kind: 'tag', id: tag.id })}
            actions={
              <Menu label={t('标签操作')} trigger={<MoreHorizontal size={14} />} className="rounded p-1 text-gray-500 hover:bg-black/5">
                {(close) => (
                  <>
                    <MenuItem onSelect={() => { close(); setEditing({ kind: 'rename-tag', id: tag.id }); }}>{t('重命名')}</MenuItem>
                    <MenuLabel>{t('颜色')}</MenuLabel>
                    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={colorNames[color]}
                          title={colorNames[color]}
                          onClick={() => { close(); organize((current) => changeTag(current, tag.id, { color })); }}
                          className={`h-4 w-4 rounded-full ${TAG_LOOK[color].dot} ${tag.color === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                        />
                      ))}
                    </div>
                    <MenuItem
                      danger
                      onSelect={() => {
                        close();
                        if (view.kind === 'tag' && view.id === tag.id) onView({ kind: 'all' });
                        organize((current) => removeTag(current, tag.id));
                      }}
                    >
                      {t('删除标签')}
                    </MenuItem>
                  </>
                )}
              </Menu>
            }
          />
        ),
      )}
      {editing?.kind === 'new-tag' && (
        <NameField
          placeholder={t('标签名')}
          onDone={(name) => {
            if (name) organize((current) => addTag(current, name, TAG_COLORS[current.tags.length % TAG_COLORS.length]).organizer);
            setEditing(null);
          }}
        />
      )}
      {organizer.tags.length === 0 && editing?.kind !== 'new-tag' && <p className="px-2 py-1 text-xs text-gray-400">{t('还没有标签')}</p>}
    </nav>
  );
};

export default Sidebar;

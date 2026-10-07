import React, { useState } from 'react';
import { Eye, EyeOff, Link2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { BUILTIN_PAGES, BuiltinPage, NavItem, SiteContent } from '../../types';
import { describeSaveError } from '../backend';
import { SortableList } from '../dnd/SortableList';
import { ContentOp, commitMessage } from '../ops';
import { FormRequest, ItemModal, SaveHandler } from './ItemModal';
import { BUTTON_SECONDARY, Modal } from './Modal';

const TYPE_LABELS: Record<NavItem['type'], string> = { builtin: '内置页面', page: '自定义页面', link: '外部链接' };

const DELETE_CONFIRM: Record<NavItem['type'], string> = {
  builtin: '从导航中删除这个页面？页面内容会保留，之后可以在「恢复已删除」里加回来。',
  page: '删除这个自定义页面？页面正文会一起删除。',
  link: '删除这个外部链接？',
};

const ACTION = 'inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 disabled:opacity-40';
const DANGER = 'inline-flex items-center gap-1 text-gray-500 hover:text-red-600 disabled:opacity-40';
const CHIP =
  'inline-flex items-center gap-1 px-3 py-1 rounded-full border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40';

const isHome = (item: NavItem): boolean => item.type === 'builtin' && item.page === 'about';

interface Props {
  content: SiteContent;
  onSave: SaveHandler;
  onReorder: (ids: string[]) => void;
  onClose: () => void;
}

/** The navigation bar's entries: drag to reorder; hide, edit and delete them; add pages and links. */
export const NavigationModal: React.FC<Props> = ({ content, onSave, onReorder, onClose }) => {
  const [form, setForm] = useState<FormRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = content.navigation;
  const deleted = BUILTIN_PAGES.filter((page) => !items.some((item) => item.type === 'builtin' && item.page === page));

  const run = async (op: ContentOp, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(op, [], message);
    } catch (saveError) {
      setError(describeSaveError(saveError));
    } finally {
      setBusy(false);
    }
  };

  const toggleHidden = (item: NavItem) =>
    run(
      { kind: 'setHidden', collection: 'navigation', id: item.id, hidden: !item.hidden },
      commitMessage(item.hidden ? 'unhide' : 'hide', 'nav item', item.label),
    );

  const remove = (item: NavItem) => {
    if (!window.confirm(DELETE_CONFIRM[item.type])) return;
    void run({ kind: 'delete', collection: 'navigation', id: item.id }, commitMessage('delete', 'nav item', item.label));
  };

  const restore = (page: BuiltinPage) =>
    run(
      { kind: 'upsert', collection: 'navigation', item: { id: page, type: 'builtin', page, label: page }, at: 'end' },
      commitMessage('add', 'nav item', page),
    );

  return (
    <>
      <Modal
        title="导航设置"
        onClose={onClose}
        footer={
          <button type="button" onClick={onClose} className={`${BUTTON_SECONDARY} ml-auto`}>
            完成
          </button>
        }
      >
        {error && (
          <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}
        <p className="mb-3 text-xs text-gray-400">拖动左侧把手调整顺序。每个操作都会立即保存并发布。</p>
        <SortableList
          items={items}
          className="rounded-md border border-gray-200 divide-y divide-gray-100"
          handleClassName="absolute left-1.5 top-1/2 -translate-y-1/2"
          onReorder={onReorder}
          renderItem={(item) => (
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pl-10 pr-3 bg-white${item.hidden ? ' opacity-50' : ''}`}>
              <span className="text-sm font-medium text-gray-900">{item.label}</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500">
                {isHome(item) ? '首页' : TYPE_LABELS[item.type]}
                {item.hidden ? ' · 已隐藏' : ''}
              </span>
              <span className="ml-auto flex items-center gap-3 text-xs">
                {!isHome(item) && (
                  <button type="button" disabled={busy} onClick={() => void toggleHidden(item)} className={ACTION}>
                    {item.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                    {item.hidden ? '取消隐藏' : '隐藏'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setForm({ kind: 'edit', collection: 'navigation', id: item.id })}
                  className={ACTION}
                >
                  <Pencil size={13} />
                  编辑
                </button>
                {!isHome(item) && (
                  <button type="button" disabled={busy} onClick={() => remove(item)} className={DANGER}>
                    <Trash2 size={13} />
                    删除
                  </button>
                )}
              </span>
            </div>
          )}
        />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setForm({ kind: 'add', collection: 'navigation', preset: { type: 'page' } })}
            className={CHIP}
          >
            <Plus size={13} />
            新增页面
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setForm({ kind: 'add', collection: 'navigation', preset: { type: 'link' } })}
            className={CHIP}
          >
            <Link2 size={13} />
            新增外部链接
          </button>
          {deleted.length > 0 && <span className="ml-2 text-xs text-gray-400">恢复已删除：</span>}
          {deleted.map((page) => (
            <button key={page} type="button" disabled={busy} onClick={() => void restore(page)} className={CHIP}>
              <RotateCcw size={12} />
              {page}
            </button>
          ))}
        </div>
        {busy && <p className="mt-3 text-xs text-gray-400">保存中…</p>}
      </Modal>
      {form && <ItemModal request={form} content={content} onSave={onSave} onClose={() => setForm(null)} />}
    </>
  );
};

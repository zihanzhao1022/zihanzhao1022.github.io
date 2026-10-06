import React, { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ExperienceCategory, ListCollection, SiteContent } from '../../types';
import { describeSaveError } from '../backend';
import { commitMessage } from '../ops';
import { LIST_SCHEMAS, Values } from '../schemas';
import { SaveHandler } from './ItemModal';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Modal } from './Modal';

const SECTION_NAMES: Record<string, string> = {
  news: '新闻',
  talks: '报告',
  education: '教育经历',
  work: '工作经历',
  volunteer: '志愿与服务',
};

interface Props {
  collection: ListCollection;
  category?: ExperienceCategory;
  content: SiteContent;
  onSave: SaveHandler;
  onClose: () => void;
}

export const ReorderModal: React.FC<Props> = ({ collection, category, content, onSave, onClose }) => {
  const schema = LIST_SCHEMAS[collection];
  const [items] = useState(() =>
    (content[collection] as unknown as Values[]).filter((item) => !category || item.category === category),
  );
  const [order, setOrder] = useState(() => items.map((item) => String(item.id)));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const dirty = order.join() !== items.map((item) => String(item.id)).join();

  const move = (index: number, delta: number) => {
    setOrder((current) => {
      const next = [...current];
      const [id] = next.splice(index, 1);
      next.splice(index + delta, 0, id);
      return next;
    });
  };

  const close = () => {
    if (saving) return;
    if (dirty && !window.confirm('放弃未保存的修改？')) return;
    onClose();
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(
        { kind: 'reorder', collection, ids: order },
        [],
        commitMessage('reorder', category ? `${collection} (${category})` : collection),
      );
      onClose();
    } catch (error) {
      setSaveError(describeSaveError(error));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`调整顺序 · ${SECTION_NAMES[category ?? collection] ?? collection}`}
      onClose={close}
      footer={
        <div className="ml-auto flex items-center gap-2">
          <button type="button" disabled={saving} onClick={close} className={BUTTON_SECONDARY}>
            取消
          </button>
          <button type="button" disabled={saving || !dirty} onClick={() => void save()} className={BUTTON_PRIMARY}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      }
    >
      {saveError && (
        <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700">
          {saveError}
        </div>
      )}
      <ol className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {order.map((id, index) => (
          <li key={id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-5 text-xs text-gray-400">{index + 1}</span>
            <span className="flex-1 text-sm text-gray-800 line-clamp-2">{schema.label(byId.get(id) ?? {})}</span>
            <button
              type="button"
              aria-label="上移"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              aria-label="下移"
              disabled={index === order.length - 1}
              onClick={() => move(index, 1)}
              className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              <ArrowDown size={16} />
            </button>
          </li>
        ))}
      </ol>
    </Modal>
  );
};

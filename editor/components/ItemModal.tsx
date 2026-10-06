import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { EditRequest, SiteContent } from '../../types';
import { ImageUpload, describeSaveError } from '../backend';
import { ContentOp, ListItem, commitMessage, itemNoun } from '../ops';
import {
  FormSchema,
  FormState,
  LIST_SCHEMAS,
  PROFILE_SCHEMAS,
  Values,
  fromFormState,
  newItem,
  profileFields,
  toFormState,
  validateForm,
  visibleFields,
} from '../schemas';
import { FieldControl } from './fields';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Modal } from './Modal';

export type SaveHandler = (op: ContentOp, uploads: ImageUpload[], message: string) => Promise<void>;

export type FormRequest = Exclude<EditRequest, { kind: 'reorder' }>;

interface ResolvedForm {
  schema: FormSchema;
  item: Values;
  title: string;
  isNew: boolean;
}

function resolveForm(request: FormRequest, content: SiteContent): ResolvedForm | null {
  if (request.kind === 'profile') {
    const schema = PROFILE_SCHEMAS[request.section];
    return { schema, item: content.profile as unknown as Values, title: schema.editTitle, isNew: false };
  }
  const schema = LIST_SCHEMAS[request.collection];
  if (request.kind === 'add') {
    return { schema, item: newItem(request.collection, request.preset), title: schema.addTitle, isNew: true };
  }
  const item = (content[request.collection] as unknown as Values[]).find((entry) => entry.id === request.id);
  return item ? { schema, item, title: schema.editTitle, isNew: false } : null;
}

interface Props {
  request: FormRequest;
  content: SiteContent;
  onSave: SaveHandler;
  onClose: () => void;
}

export const ItemModal: React.FC<Props> = ({ request, content, onSave, onClose }) => {
  // Resolved once: the form edits the item as it was when the dialog opened.
  const [form] = useState(() => resolveForm(request, content));
  const initial = useMemo(() => (form ? toFormState(form.schema, form.item) : {}), [form]);
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!form) {
    return (
      <Modal
        title="找不到这一条"
        onClose={onClose}
        footer={
          <button type="button" className={`${BUTTON_SECONDARY} ml-auto`} onClick={onClose}>
            关闭
          </button>
        }
      >
        <p className="text-sm text-gray-600">这一条可能已经在别处被删除了，刷新页面可以看到最新内容。</p>
      </Modal>
    );
  }

  const dirty = JSON.stringify(state) !== JSON.stringify(initial);

  const close = () => {
    if (saving) return;
    if (dirty && !window.confirm('放弃未保存的修改？')) return;
    onClose();
  };

  const submit = async (op: ContentOp, uploads: ImageUpload[], message: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(op, uploads, message);
      onClose();
    } catch (error) {
      setSaveError(describeSaveError(error));
      setSaving(false);
    }
  };

  const save = () => {
    const found = validateForm(form.schema, state);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const { item, uploads } = fromFormState(form.schema, state, form.item, new Date());
    if (request.kind === 'profile') {
      void submit(
        { kind: 'patchProfile', collection: 'profile', fields: profileFields(form.schema, item) },
        uploads,
        commitMessage('update', `profile ${request.section}`),
      );
    } else {
      void submit(
        { kind: 'upsert', collection: request.collection, item: item as ListItem },
        uploads,
        commitMessage(form.isNew ? 'add' : 'update', itemNoun(request.collection), form.schema.label(item)),
      );
    }
  };

  const remove = () => {
    if (request.kind !== 'edit') return;
    if (!window.confirm('确定删除这一条吗？删除后会立即发布。')) return;
    void submit(
      { kind: 'delete', collection: request.collection, id: request.id },
      [],
      commitMessage('delete', itemNoun(request.collection), form.schema.label(form.item)),
    );
  };

  const setField = (key: string, value: unknown) => {
    setState((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  return (
    <Modal
      title={form.title}
      onClose={close}
      footer={
        <>
          {request.kind === 'edit' && (
            <button
              type="button"
              disabled={saving}
              onClick={remove}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 size={14} />
              删除
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" disabled={saving} onClick={close} className={BUTTON_SECONDARY}>
              取消
            </button>
            <button type="button" disabled={saving} onClick={save} className={BUTTON_PRIMARY}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </>
      }
    >
      {saveError && (
        <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {visibleFields(form.schema, state).map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          value={state[field.key]}
          error={errors[field.key]}
          onChange={(value) => setField(field.key, value)}
        />
      ))}
      <p className="text-xs text-gray-400">保存后会立即提交到 GitHub，网站约 1 分钟后更新。</p>
    </Modal>
  );
};

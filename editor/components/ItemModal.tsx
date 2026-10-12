import React, { useMemo, useState } from 'react';
import { LANGS, Lang, Message, say, useMessage } from '../../lib/i18n';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { useT } from '../../lib/phrases/editor';
import { EditRequest, SiteContent } from '../../types';
import { ImageUpload, describeSaveError } from '../backend';
import { existingImages } from '../existingImages';
import { ContentOp, ListItem, commitMessage, itemNoun } from '../ops';
import {
  Field,
  FormSchema,
  FormState,
  PROFILE_SCHEMAS,
  Values,
  fromFormState,
  listSchema,
  newItem,
  profileFields,
  toFormState,
  validateForm,
  visibleFields,
  withTranslations,
} from '../schemas';
import { FieldControl } from './fields';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Modal } from './Modal';

export type SaveHandler = (op: ContentOp, uploads: ImageUpload[], message: string) => Promise<void>;

export type FormRequest = Extract<EditRequest, { kind: 'edit' | 'add' | 'profile' }>;

interface ResolvedForm {
  schema: FormSchema;
  item: Values;
  /** A phrase, translated where it is shown. */
  title: string;
  isNew: boolean;
  /** The home page entry can be renamed, but not hidden or deleted. */
  locked: boolean;
  /** Keys whose value must differ from every other item's, with the message shown otherwise. */
  unique: Record<string, string>;
}

// English is the text itself; the other tabs hold the owner's translations of it.
const TABS: Lang[] = ['en', 'zh', 'ja'];
const langName = (lang: Lang): string => LANGS.find((entry) => entry.lang === lang)?.name ?? lang;
const tabOf = (field: Field | undefined): Lang => field?.translation?.lang ?? 'en';

function resolveForm(request: FormRequest, content: SiteContent): ResolvedForm | null {
  const form = findForm(request, content);
  return form && { ...form, schema: withTranslations(form.schema) };
}

function findForm(request: FormRequest, content: SiteContent): ResolvedForm | null {
  if (request.kind === 'profile') {
    const schema = PROFILE_SCHEMAS[request.section];
    return { schema, item: content.profile as unknown as Values, title: schema.editTitle, isNew: false, locked: true, unique: {} };
  }
  if (request.kind === 'add') {
    const schema = listSchema(request.collection, request.preset ?? {});
    return { schema, item: newItem(schema, request.preset), title: schema.addTitle, isNew: true, locked: false, unique: schema.unique ?? {} };
  }
  const item = (content[request.collection] as unknown as Values[]).find((entry) => entry.id === request.id);
  if (!item) return null;
  const schema = listSchema(request.collection, item);
  const locked = request.collection === 'navigation' && item.type === 'builtin' && item.page === 'about';
  return { schema, item, title: schema.editTitle, isNew: false, locked, unique: schema.unique ?? {} };
}

interface Props {
  request: FormRequest;
  content: SiteContent;
  onSave: SaveHandler;
  onClose: () => void;
}

export const ItemModal: React.FC<Props> = ({ request, content, onSave, onClose }) => {
  const t = useT();
  // Resolved once: the form edits the item as it was when the dialog opened.
  const [form] = useState(() => resolveForm(request, content));
  const initial = useMemo(() => (form ? toFormState(form.schema, form.item) : {}), [form]);
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, Message>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useMessage();
  const [tab, setTab] = useState<Lang>('en');

  if (!form) {
    return (
      <Modal
        title={t('找不到这一条')}
        onClose={onClose}
        footer={
          <button type="button" className={`${BUTTON_SECONDARY} ml-auto`} onClick={onClose}>
            {t('关闭')}
          </button>
        }
      >
        <p className="text-sm text-gray-600">{t('这一条可能已经在别处被删除了，刷新页面可以看到最新内容。')}</p>
      </Modal>
    );
  }

  const dirty = JSON.stringify(state) !== JSON.stringify(initial);
  const isHidden = form.item.hidden === true;
  const translated = form.schema.fields.some((field) => field.translation);
  const fieldTab = (key: string): Lang => tabOf(form.schema.fields.find((field) => field.key === key));
  const problemTabs = new Set(Object.keys(errors).map(fieldTab));

  /** The English a translation stands for, shown in its empty box (or under a list) while translating. */
  const english = (field: Field): string => {
    const value = field.translation ? state[field.translation.of] : undefined;
    if (!Array.isArray(value)) return typeof value === 'string' ? value : '';
    const cells = (row: Values) => (field.columns ?? []).map((column) => row[column.key]).filter((cell) => typeof cell === 'string' && cell);
    return (value as Values[]).map((row) => cells(row).join(' / ')).join(', ');
  };
  const shown = (field: Field): Field => {
    if (!field.translation) return field;
    const text = english(field);
    if (!text) return field;
    return field.type === 'rows' ? { ...field, help: t('英文：{text}', { text }) } : { ...field, placeholder: text };
  };

  const close = () => {
    if (saving) return;
    if (dirty && !window.confirm(t('放弃未保存的修改？'))) return;
    onClose();
  };

  const submit = async (op: ContentOp, uploads: ImageUpload[], message: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(op, uploads, message);
      onClose();
    } catch (error) {
      setSaveError(() => describeSaveError(error));
      setSaving(false);
    }
  };

  const save = () => {
    const found = validateForm(form.schema, state);
    // Checked again when shown, so the messages follow the language switch.
    setErrors(Object.fromEntries(Object.keys(found).map((key) => [key, () => validateForm(form.schema, state)[key] ?? found[key]])));
    const problems = Object.keys(found).map(fieldTab);
    if (problems.length > 0) {
      // Open the first tab with a problem, unless this one has one.
      if (!problems.includes(tab)) setTab(problems[0]);
      return;
    }
    const { item, uploads } = fromFormState(form.schema, state, form.item, new Date());
    if (request.kind === 'profile') {
      void submit(
        { kind: 'patchProfile', collection: 'profile', fields: profileFields(form.schema, item) },
        uploads,
        commitMessage('update', `profile ${request.section}`),
      );
      return;
    }
    const others = (content[request.collection] as unknown as Values[]).filter((entry) => entry.id !== item.id);
    const taken = Object.entries(form.unique).find(
      ([key]) => item[key] !== undefined && others.some((entry) => entry[key] === item[key]),
    );
    if (taken) {
      const [key, message] = taken;
      setErrors({ [key]: () => t(message) });
      return;
    }
    void submit(
      {
        kind: 'upsert',
        collection: request.collection,
        item: item as ListItem,
        // New navigation entries go to the end of the bar; other new items start their list.
        at: request.collection === 'navigation' ? 'end' : 'start',
      },
      uploads,
      commitMessage(form.isNew ? 'add' : 'update', itemNoun(request.collection), form.schema.label(item)),
    );
  };

  const remove = () => {
    if (request.kind !== 'edit') return;
    if (!window.confirm(t('确定删除这一条吗？删除后会立即发布。'))) return;
    void submit(
      { kind: 'delete', collection: request.collection, id: request.id },
      [],
      commitMessage('delete', itemNoun(request.collection), form.schema.label(form.item)),
    );
  };

  // Hiding acts on the stored item, like delete; unsaved form changes are dropped after confirmation.
  const toggleHidden = () => {
    if (request.kind !== 'edit') return;
    if (dirty && !window.confirm(t('放弃未保存的修改？'))) return;
    void submit(
      { kind: 'setHidden', collection: request.collection, id: request.id, hidden: !isHidden },
      [],
      commitMessage(isHidden ? 'unhide' : 'hide', itemNoun(request.collection), form.schema.label(form.item)),
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

  const itemActions = request.kind === 'edit' && !form.locked;
  // Image fields offer the images already used on the site; those used by the same kind of field come first.
  const imageKind = request.kind === 'profile' ? 'profile' : request.collection;

  return (
    <Modal
      title={t(form.title)}
      onClose={close}
      footer={
        <>
          {itemActions && (
            <button
              type="button"
              disabled={saving}
              onClick={remove}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {t('删除')}
            </button>
          )}
          {itemActions && (
            <button
              type="button"
              disabled={saving}
              onClick={toggleHidden}
              className="ml-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {isHidden ? t('取消隐藏') : t('隐藏')}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" disabled={saving} onClick={close} className={BUTTON_SECONDARY}>
              {t('取消')}
            </button>
            <button type="button" disabled={saving} onClick={save} className={BUTTON_PRIMARY}>
              {saving ? t('保存中…') : t('保存')}
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
      {isHidden && <div className="mb-4 p-3 rounded-md bg-gray-50 text-sm text-gray-600">{t('这一条目前对访客隐藏。')}</div>}
      {translated && (
        <div role="tablist" className="mb-4 flex gap-1 border-b border-gray-200">
          {TABS.map((lang) => (
            <button
              key={lang}
              type="button"
              role="tab"
              lang={lang}
              aria-selected={tab === lang}
              onClick={() => setTab(lang)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
                tab === lang ? 'border-purple-600 font-medium text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {langName(lang)}
              {problemTabs.has(lang) && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />}
            </button>
          ))}
        </div>
      )}
      {tab !== 'en' && (
        <p className="mb-4 text-xs text-gray-500">{t('网站切换到{lang}时显示这里填写的内容；留空的项显示英文。', { lang: langName(tab) })}</p>
      )}
      {visibleFields(form.schema, state).filter((field) => tabOf(field) === tab).map((field) => (
        <FieldControl
          key={field.key}
          field={shown(field)}
          value={state[field.key]}
          error={errors[field.key] === undefined ? undefined : say(errors[field.key])}
          onChange={(value) => setField(field.key, value)}
          imageChoices={field.type === 'image' ? existingImages(content, `${imageKind}.${field.key}`) : undefined}
        />
      ))}
      <p className="text-xs text-gray-400">{t('保存后会立即提交到 GitHub，网站约 1 分钟后更新。')}</p>
    </Modal>
  );
};

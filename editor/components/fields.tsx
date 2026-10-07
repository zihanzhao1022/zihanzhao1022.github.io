import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react';
import { resolveImage } from '../../lib/localImages';
import { ImageChoice } from '../existingImages';
import { isPendingImage, prepareImage, validateImage } from '../images';
import { Column, Field, Option, Values } from '../schemas';
import { BUTTON_SECONDARY } from './Modal';

const INPUT =
  'w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-900 focus:outline-none focus:border-purple-500';
const TEXTAREA_ROWS: Record<string, number> = { textarea: 3, markdown: 3, lines: 5, paragraphs: 10 };

const SelectInput: React.FC<{
  id?: string;
  value: unknown;
  options: Option[];
  required?: boolean;
  onChange: (value: string) => void;
}> = ({ id, value, options, required, onChange }) => {
  const current = typeof value === 'string' ? value : '';
  return (
    <select id={id} className={INPUT} value={current} onChange={(event) => onChange(event.target.value)}>
      {(!required || current === '') && <option value="">{required ? '请选择' : '（无）'}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

const fileName = (url: string): string => url.split('/').pop() || url;

const ImageInput: React.FC<{
  value: unknown;
  onChange: (value: unknown) => void;
  compact?: boolean;
  /** Images already used on the site that can be picked instead of uploading. */
  choices?: ImageChoice[];
}> = ({ value, onChange, compact = false, choices = [] }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const current = typeof value === 'string' ? value : '';
  const src = isPendingImage(value) ? value.previewUrl : resolveImage(current);
  // Picking the image the field already shows would change nothing.
  const canChoose = choices.some((choice) => choice.url !== current);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateImage(file);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      onChange(await prepareImage(file));
      setBrowsing(false);
    } catch {
      setError('图片处理失败，请换一张试试');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const choose = (url: string) => {
    onChange(url);
    setError(null);
    setBrowsing(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`${compact ? 'w-10 h-10' : 'w-24 h-16'} flex-shrink-0 flex items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-300 bg-gray-50`}
        >
          {src ? <img src={src} alt="" className="w-full h-full object-contain" /> : <ImagePlus size={16} className="text-gray-300" />}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className={`${BUTTON_SECONDARY} ${compact ? '!px-2 !py-1 !text-xs' : ''}`}
        >
          {busy ? '处理中…' : src ? '更换' : '上传图片'}
        </button>
        {canChoose && !busy && (
          <button
            type="button"
            aria-expanded={browsing}
            onClick={() => setBrowsing((open) => !open)}
            className={BUTTON_SECONDARY}
          >
            {browsing ? '收起' : '选择已有图片'}
          </button>
        )}
        {src && !busy && (
          <button type="button" onClick={() => onChange('')} className="text-xs text-gray-500 hover:text-red-600">
            移除
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            void pick(event.target.files?.[0]);
          }}
        />
      </div>
      {browsing && (
        <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2 p-2 rounded-md border border-gray-200 bg-gray-50">
          {choices.map((choice) => (
            <button
              key={choice.url}
              type="button"
              title={choice.url}
              onClick={() => choose(choice.url)}
              className={`flex flex-col items-center gap-1 min-w-0 p-1.5 rounded-md border bg-white ${
                choice.url === current ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <span className="flex items-center justify-center w-full h-12 overflow-hidden">
                <img src={resolveImage(choice.url)} alt="" className="max-w-full max-h-full object-contain" />
              </span>
              <span className="w-full truncate text-[10px] text-gray-500">{fileName(choice.url)}</span>
            </button>
          ))}
        </div>
      )}
      {!compact && <p className="mt-1 text-xs text-gray-400">PNG、JPG、WebP 或 GIF，最大 5MB；超过 1600 像素会自动缩小</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

const CellInput: React.FC<{ column: Column; value: unknown; onChange: (value: unknown) => void }> = ({
  column,
  value,
  onChange,
}) => {
  if (column.type === 'image') return <ImageInput value={value} onChange={onChange} compact />;
  if (column.type === 'select') {
    return <SelectInput value={value} options={column.options ?? []} required={column.required} onChange={onChange} />;
  }
  return (
    <input
      aria-label={column.label}
      className={INPUT}
      placeholder={column.placeholder ?? column.label}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

const IconButton: React.FC<{ label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }> = ({
  label,
  disabled,
  onClick,
  children,
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {children}
  </button>
);

const RowsInput: React.FC<{ field: Field; value: unknown; onChange: (value: unknown) => void }> = ({
  field,
  value,
  onChange,
}) => {
  const rows = Array.isArray(value) ? (value as Values[]) : [];
  const columns = field.columns ?? [];
  // Text columns share the free width; selects and images only take what they need.
  const template = columns
    .map((column) => (column.type === 'text' ? 'minmax(0,1fr)' : column.type === 'select' ? '7.5rem' : 'auto'))
    .join(' ');
  const update = (index: number, key: string, cell: unknown) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: cell } : row)));
  const move = (index: number, delta: number) => {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(index + delta, 0, row);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex items-start gap-2 p-2 rounded-md border border-gray-200">
          <div
            className="flex-1 grid gap-2 sm:[grid-template-columns:var(--row-columns)]"
            style={{ '--row-columns': template } as React.CSSProperties}
          >
            {columns.map((column) => (
              <CellInput
                key={column.key}
                column={column}
                value={row[column.key]}
                onChange={(cell) => update(index, column.key, cell)}
              />
            ))}
          </div>
          <div className="flex flex-col">
            <IconButton label="上移" disabled={index === 0} onClick={() => move(index, -1)}>
              <ArrowUp size={14} />
            </IconButton>
            <IconButton label="下移" disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
              <ArrowDown size={14} />
            </IconButton>
            <IconButton label="删除这一行" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
              <Trash2 size={14} />
            </IconButton>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, {}])}
        className="text-xs font-medium text-purple-600 hover:underline"
      >
        + {field.addLabel ?? '添加一行'}
      </button>
    </div>
  );
};

export const FieldControl: React.FC<{
  field: Field;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  /** For image fields: images already used on the site. */
  imageChoices?: ImageChoice[];
}> = ({ field, value, error, onChange, imageChoices }) => {
  const id = `field-${field.key.replace(/\W/g, '-')}`;
  const textValue = typeof value === 'string' ? value : '';
  let control: React.ReactNode;
  switch (field.type) {
    case 'select':
      control = (
        <SelectInput id={id} value={value} options={field.options ?? []} required={field.required} onChange={onChange} />
      );
      break;
    case 'image':
      control = <ImageInput value={value} onChange={onChange} choices={imageChoices} />;
      break;
    case 'rows':
      control = <RowsInput field={field} value={value} onChange={onChange} />;
      break;
    case 'textarea':
    case 'markdown':
    case 'lines':
    case 'paragraphs':
      control = (
        <textarea
          id={id}
          className={`${INPUT} leading-relaxed`}
          rows={field.rows ?? TEXTAREA_ROWS[field.type]}
          placeholder={field.placeholder}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    default:
      control = (
        <input
          id={id}
          className={INPUT}
          inputMode={field.type === 'year' ? 'numeric' : undefined}
          maxLength={field.type === 'year' ? 4 : undefined}
          placeholder={field.placeholder}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }

  return (
    <div className="mb-4">
      <label htmlFor={id} className="block mb-1 text-xs font-medium text-gray-600">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </label>
      {control}
      {field.help && <p className="mt-1 text-xs text-gray-400">{field.help}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

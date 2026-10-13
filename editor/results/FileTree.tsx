import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, File, FileCode, FileImage, Folder, FolderUp, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { PickedFile, pickedFiles } from '../../components/results/droppedFiles';
import { useT } from '../../lib/phrases/results';
import { ATTACHMENT_TYPES, IMAGE_TYPES, extensionOf } from './actions';
import { FileFolder, fileTree, insertionFor } from './attachmentTree';

interface Props {
  /** All the paper's attachments, with those uploaded here. */
  names: string[];
  /** Uploaded here; saved with the block. */
  added: Set<string>;
  /** Marked for deletion; deleted when the block is saved. */
  removed: Set<string>;
  /** Inserts a file's code at the cursor; absent while there is no code to insert into (the visual table editor). */
  onInsert?: (name: string) => void;
  onUpload: (files: PickedFile[]) => void;
  onToggleRemove: (name: string) => void;
  /** A drag with files is over the editor. */
  dropping: boolean;
  disabled: boolean;
  onClose: () => void;
  className?: string;
}

const ICON = 'shrink-0 text-gray-400';

function FileIcon({ name }: { name: string }) {
  const extension = extensionOf(name);
  if (IMAGE_TYPES.includes(extension)) return <FileImage size={14} className={ICON} />;
  if (['.tex', '.sty', '.cls', '.bib', '.bst'].includes(extension)) return <FileCode size={14} className={ICON} />;
  return <File size={14} className={ICON} />;
}

/** The paper's attachments as a folder tree beside the code, like a project's files in Overleaf. */
const FileTree: React.FC<Props> = ({ names, added, removed, onInsert, onUpload, onToggleRemove, dropping, disabled, onClose, className = '' }) => {
  const t = useT();
  const tree = useMemo(() => fileTree(names), [names]);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // React does not know the attribute that lets a file input pick a whole folder.
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  const pick = (list: FileList | null) => {
    if (list && list.length > 0) onUpload(pickedFiles(list));
  };

  const file = (name: string, depth: number) => {
    const code = insertionFor(name);
    const gone = removed.has(name);
    let title: string;
    if (gone) title = t('{name} 会在保存时删除', { name });
    else if (!code) title = t('{name}：.sty、.cls、.bib 等不用插入，导言区和参考文献会用到它们', { name });
    else if (!onInsert) title = t('切换到 LaTeX 编辑后才能插入');
    else title = t('在光标处插入 {code}', { code: code.trim() });
    return (
      <li key={name} className="group flex items-center gap-1 pr-1" style={{ paddingLeft: `${0.5 + depth * 0.875}rem` }}>
        <button
          type="button"
          disabled={disabled || gone || !code || !onInsert}
          onClick={() => code && onInsert?.(name)}
          title={title}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-purple-50 hover:text-purple-700 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-inherit"
        >
          <FileIcon name={name} />
          <span className={`truncate ${gone ? 'text-gray-400 line-through' : ''}`}>{name.split('/').pop()}</span>
          {added.has(name) && <span className="shrink-0 text-[10px] text-emerald-600">{t('新上传')}</span>}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggleRemove(name)}
          aria-label={gone ? t('恢复 {name}', { name }) : t('删除 {name}', { name })}
          title={gone ? t('恢复') : t('保存时删除这个文件')}
          className={`shrink-0 rounded p-1 text-gray-400 hover:text-red-600 focus:opacity-100 ${gone ? '' : 'opacity-0 group-hover:opacity-100'}`}
        >
          {gone ? <RotateCcw size={12} /> : <Trash2 size={12} />}
        </button>
      </li>
    );
  };

  const folder = (item: FileFolder, depth: number): React.ReactNode => {
    const open = !closed.has(item.path);
    return (
      <li key={`dir:${item.path}`}>
        <button
          type="button"
          onClick={() =>
            setClosed((current) => {
              const next = new Set(current);
              if (open) next.add(item.path);
              else next.delete(item.path);
              return next;
            })
          }
          aria-expanded={open}
          className="flex w-full items-center gap-1 rounded py-1 pr-2 text-left text-gray-700 hover:bg-gray-100"
          style={{ paddingLeft: `${0.25 + depth * 0.875}rem` }}
        >
          {open ? <ChevronDown size={12} className={ICON} /> : <ChevronRight size={12} className={ICON} />}
          <Folder size={14} className="shrink-0 text-purple-400" />
          <span className="truncate">{item.name}</span>
        </button>
        {open && <ul>{contents(item, depth + 1)}</ul>}
      </li>
    );
  };

  const contents = (item: FileFolder, depth: number): React.ReactNode => [
    ...item.folders.map((child) => folder(child, depth)),
    ...item.files.map((name) => file(name, depth)),
  ];

  return (
    <aside aria-label={t('文件')} className={`flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50 ${className}`}>
      <div className="flex items-center gap-1 border-b border-gray-200 px-3 py-2">
        <span className="mr-auto text-xs font-medium text-gray-500">{t('文件')}</span>
        <button type="button" disabled={disabled} onClick={() => filesInput.current?.click()} title={t('上传文件')} aria-label={t('上传文件')} className="rounded p-1 text-gray-500 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40">
          <Upload size={14} />
        </button>
        <button type="button" disabled={disabled} onClick={() => folderInput.current?.click()} title={t('上传文件夹')} aria-label={t('上传文件夹')} className="rounded p-1 text-gray-500 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40">
          <FolderUp size={14} />
        </button>
        <button type="button" onClick={onClose} title={t('收起文件')} aria-label={t('收起文件')} className="rounded p-1 text-gray-400 hover:text-gray-700">
          <X size={14} />
        </button>
      </div>
      <div className={`relative min-h-0 flex-1 overflow-y-auto py-1 text-sm ${dropping ? 'bg-purple-50' : ''}`}>
        {dropping && (
          <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/90 p-3 text-center text-sm text-purple-700">
            {t('松开即可上传到附件，保存时一起提交')}
          </div>
        )}
        {names.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400">{t('还没有附件：把文件或文件夹拖到这里，或用上面的按钮上传')}</p>
        ) : (
          <ul>{contents(tree, 0)}</ul>
        )}
      </div>
      <p className="border-t border-gray-200 px-3 py-2 text-xs text-gray-400">
        {t('点图片插入 \\includegraphics，点 .tex 插入 \\input；把文件或文件夹拖进来就能上传，PDF 图最清楚')}
      </p>
      <input ref={filesInput} type="file" multiple accept={ATTACHMENT_TYPES.join(',')} className="hidden" onChange={(event) => { pick(event.target.files); event.target.value = ''; }} />
      <input ref={folderInput} type="file" className="hidden" onChange={(event) => { pick(event.target.files); event.target.value = ''; }} />
    </aside>
  );
};

export default FileTree;

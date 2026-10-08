import React, { useEffect, useRef, useState } from 'react';
import { ClipboardPaste, Loader2, X } from 'lucide-react';
import { ResultPaper } from '../../types';
import { describeSaveError } from '../backend';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../components/Modal';
import { ReadFile, attachmentPath, loadAttachments, putFiles, rebuildWith, withOutputs } from './actions';
import { addBibEntries, bibKeysOf, bibliographyStyle } from './bibtex';
import type { ResultsSave } from './BlockEditor';
import CodeEditor from './CodeEditor';
import { REFERENCES_FILE } from './compile';
import { describeFailure } from './numbering';
import { resultsCommitMessage } from './ops';

interface Props {
  paper: ResultPaper;
  readFile: ReadFile;
  onSave: ResultsSave;
  onClose: () => void;
}

const STARTER = '% 在这里粘贴 BibTeX 条目，或者点"粘贴 BibTeX"。正文里用 \\cite{引用名} 引用。\n';

/** Reads BibTeX from the clipboard; where the browser refuses, asks for it instead. */
export async function readClipboard(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return window.prompt('把 BibTeX 条目粘贴到这里') ?? '';
  }
}

/**
 * A paper's references.bib: offered for creation when the paper has none, then edited here or filled by
 * pasting entries. Saving typesets the "References" again and renumbers the citations.
 */
const ReferencesEditor: React.FC<Props> = ({ paper, readFile, onSave, onClose }) => {
  const exists = (paper.files ?? []).includes(REFERENCES_FILE);
  // null: still loading the file, or not created yet (then `creating` decides).
  const [text, setText] = useState<string | null>(null);
  const [original, setOriginal] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!exists) return undefined;
    let cancelled = false;
    readFile(attachmentPath(paper.id, REFERENCES_FILE))
      .then((bytes) => {
        if (cancelled) return;
        const loaded = new TextDecoder().decode(bytes);
        setText(loaded);
        setOriginal(loaded);
      })
      .catch(() => {
        if (!cancelled) setProblem(`读取 ${REFERENCES_FILE} 失败，请关闭后重试`);
      });
    return () => {
      cancelled = true;
    };
  }, [exists, paper.id, readFile]);

  const create = () => {
    setCreating(true);
    setText(STARTER);
  };

  const paste = async () => {
    if (text === null) return;
    const merge = addBibEntries(text, await readClipboard());
    const keys = [...merge.added, ...merge.skipped];
    if (keys.length === 0) {
      setProblem('剪贴板里没有 BibTeX 条目（应该以 @article{… 这样开头）');
      return;
    }
    setProblem(null);
    setText(merge.text);
    const copied = await navigator.clipboard.writeText(keys.join(',')).then(
      () => true,
      () => false,
    );
    setNotice(
      [
        merge.added.length > 0 ? `已加入 ${merge.added.length} 条，保存后生效` : '',
        merge.skipped.length > 0 ? `${merge.skipped.join('、')} 已经有了` : '',
        copied ? `引用名已复制：${keys.join(',')}` : `引用名：${keys.join(',')}`,
      ]
        .filter(Boolean)
        .join('；'),
    );
  };

  const save = async () => {
    if (text === null || busy.current) return;
    busy.current = true;
    setSaving(true);
    setProblem(null);
    try {
      const data = new TextEncoder().encode(text);
      const uploads = await putFiles(paper.id, { [REFERENCES_FILE]: data });
      const draft: ResultPaper = {
        ...paper,
        files: [...new Set([...(paper.files ?? []), REFERENCES_FILE])],
        fileHashes: { ...paper.fileHashes, ...uploads.hashes },
      };
      const files = { ...(await loadAttachments(paper, readFile)), [REFERENCES_FILE]: data };
      const rebuilt = await rebuildWith(draft, files);
      if (rebuilt.failed) {
        setProblem(describeFailure(paper.blocks, rebuilt.failed));
        return;
      }
      await onSave(
        withOutputs(paper.id, uploads.ops, rebuilt),
        [{ path: attachmentPath(paper.id, REFERENCES_FILE), data }, ...rebuilt.writes],
        rebuilt.deletes,
        resultsCommitMessage(exists ? 'update references of' : 'add references to', paper.title),
        `content: update result "${paper.title}"`,
      );
      onClose();
    } catch (error) {
      setProblem(describeSaveError(error));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const close = () => {
    if (text !== null && text !== original && text !== STARTER && !window.confirm('参考文献还没保存，确定关闭吗？')) return;
    onClose();
  };

  const style = bibliographyStyle(paper);
  const count = text === null ? 0 : bibKeysOf(text).size;

  return (
    <div role="dialog" aria-modal="true" aria-label="参考文献" className="fixed inset-0 z-[100] flex flex-col bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 border-b border-gray-200">
        <span className="font-semibold text-gray-900">参考文献</span>
        <span className="text-sm text-gray-500 truncate max-w-[16rem]">{paper.title}</span>
        <div className="ml-auto flex items-center gap-2">
          {text !== null && (
            <button type="button" disabled={saving} onClick={() => void paste()} className={BUTTON_SECONDARY} title="把复制来的 BibTeX 条目加进来，并把它们的引用名放到剪贴板">
              <ClipboardPaste size={14} />
              粘贴 BibTeX
            </button>
          )}
          <button type="button" disabled={saving} onClick={close} className={BUTTON_SECONDARY}>
            取消
          </button>
          {text !== null && (
            <button type="button" disabled={saving} onClick={() => void save()} className={BUTTON_PRIMARY}>
              {saving ? '保存并重新编译…' : '保存'}
            </button>
          )}
          <button type="button" onClick={close} aria-label="关闭" className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
      </header>
      {problem && (
        <p role="alert" className="px-4 py-2 text-sm text-red-700 border-b border-gray-100">
          {problem}
        </p>
      )}
      {notice && <p className="px-4 py-2 text-sm text-emerald-700 border-b border-gray-100">{notice}</p>}
      {!exists && !creating ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
          <p className="text-gray-700">这篇论文还没有参考文献文件。</p>
          <button type="button" onClick={create} className={BUTTON_PRIMARY}>
            新建 {REFERENCES_FILE}
          </button>
          <p className="max-w-md text-sm text-gray-500">
            新建后，正文里用 \cite 引用的文献会自动排在论文页最后的 References 里，编号在各个块之间连续。
          </p>
        </div>
      ) : text === null ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin mr-2" />
          正在读取 {REFERENCES_FILE}…
        </div>
      ) : (
        <>
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-600">
            {REFERENCES_FILE}：共 {count} 条。引用格式 {style}
            {style === 'plainnat' ? '（作者-年份，导言区用了 natbib）' : style === 'unsrt' ? '（按引用顺序编号）' : '（来自上传的 .bst）'}
            ；在"导言区与附件"上传会议的 .bst 可以换成它的格式。References 只列出正文引用过的文献。
          </div>
          <CodeEditor value={text} onChange={setText} onSave={() => void save()} className="flex-1" />
        </>
      )}
    </div>
  );
};

export default ReferencesEditor;

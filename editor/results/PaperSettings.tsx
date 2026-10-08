import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Play, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import PdfView from '../../components/results/PdfView';
import { pdfPageSize } from '../../components/results/pdfjs';
import { ResultPaper } from '../../types';
import { describeSaveError } from '../backend';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../components/Modal';
import { getTexEngine } from '../tex/engine';
import {
  ATTACHMENT_TYPES,
  ReadFile,
  attachmentName,
  attachmentPath,
  attachmentProblem,
  loadAttachments,
  makeCompileFn,
  preambleOf,
  withOutputs,
} from './actions';
import { ResultsSave } from './BlockEditor';
import CodeEditor from './CodeEditor';
import { BlockCompileResult, compileBlock, describeIssue } from './compile';
import { rebuild } from './numbering';
import { resultsCommitMessage } from './ops';

const SAMPLE = String.raw`\section*{Preview}
The quick brown fox jumps over the lazy dog, and $\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$.
\begin{table}[h]
\centering
\begin{tabular}{lc}
\hline
Method & Score \\
\hline
Sample & 1.0 \\
\hline
\end{tabular}
\caption{A sample table.}
\end{table}`;

interface Props {
  paper: ResultPaper;
  readFile: ReadFile;
  onSave: ResultsSave;
  onClose: () => void;
}

/** A paper's preamble and attachments. Saving recompiles every block with them. */
const PaperSettings: React.FC<Props> = ({ paper, readFile, onSave, onClose }) => {
  const original = preambleOf(paper);
  const [preamble, setPreamble] = useState(original);
  const [stored, setStored] = useState<Record<string, Uint8Array> | null>(null);
  const [added, setAdded] = useState<Record<string, Uint8Array>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [test, setTest] = useState<BlockCompileResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const upload = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadAttachments(paper, readFile)
      .then((loaded) => {
        if (!cancelled) setStored(loaded);
      })
      .catch(() => {
        if (!cancelled) setProblem('读取论文附件失败，请关闭后重试');
      });
    return () => {
      cancelled = true;
    };
  }, [paper, readFile]);

  const files = useMemo(() => {
    if (!stored) return null;
    const all = { ...stored, ...added };
    removed.forEach((name) => delete all[name]);
    return all;
  }, [stored, added, removed]);
  const names = [...new Set([...(paper.files ?? []), ...Object.keys(added)])];
  const dirty = preamble !== original || Object.keys(added).length > 0 || removed.length > 0;

  const close = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm('放弃未保存的修改？')) return;
    onClose();
  }, [saving, dirty, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);

  const runTest = async () => {
    if (!files) return;
    setTesting(true);
    setProblem(null);
    try {
      const engine = await getTexEngine();
      setTest(await compileBlock(engine, { preamble, source: SAMPLE, kind: 'text', counters: {}, labels: {}, files }, pdfPageSize));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'TeX 引擎出错，请重试');
    } finally {
      setTesting(false);
    }
  };

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const next: Record<string, Uint8Array> = {};
    for (const file of Array.from(list)) {
      const reason = attachmentProblem(file);
      if (reason) {
        setProblem(`${file.name}：${reason}`);
        continue;
      }
      next[attachmentName(file.name)] = new Uint8Array(await file.arrayBuffer());
    }
    setAdded((current) => ({ ...current, ...next }));
    setRemoved((current) => current.filter((name) => !(name in next)));
  };

  const save = async () => {
    if (!files) return;
    setSaving(true);
    setProblem(null);
    try {
      const kept = names.filter((name) => !removed.includes(name));
      const draft: ResultPaper = { ...paper, preamble, files: kept };
      const rebuilt = await rebuild(draft, makeCompileFn(await getTexEngine(), preamble, files));
      if (rebuilt.failed) {
        const position = paper.blocks.findIndex((block) => block.id === rebuilt.failed!.blockId) + 1;
        setProblem(`改动后第 ${position} 个块编译失败：${rebuilt.failed.message}`);
        return;
      }
      const writes = [
        ...Object.entries(added).map(([name, data]) => ({ path: attachmentPath(paper.id, name), data })),
        ...rebuilt.writes,
      ];
      const deletes = [
        ...removed.filter((name) => (paper.files ?? []).includes(name)).map((name) => attachmentPath(paper.id, name)),
        ...rebuilt.deletes,
      ];
      await onSave(
        withOutputs(paper.id, [{ kind: 'patchPaper', id: paper.id, fields: { preamble, files: kept } }], rebuilt),
        writes,
        deletes,
        resultsCommitMessage('update preamble of', paper.title),
        `content: update result "${paper.title}"`,
      );
      onClose();
    } catch (error) {
      setProblem(describeSaveError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="导言区与附件" className="fixed inset-0 z-[100] flex flex-col bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 border-b border-gray-200">
        <span className="font-semibold text-gray-900">导言区与附件</span>
        <span className="text-sm text-gray-500 truncate max-w-[16rem]">{paper.title}</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" disabled={saving} onClick={close} className={BUTTON_SECONDARY}>
            取消
          </button>
          <button type="button" disabled={saving || !files} onClick={() => void save()} className={BUTTON_PRIMARY}>
            {saving ? '保存并重新编译…' : '保存'}
          </button>
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
      <div className="flex-1 min-h-0 grid lg:grid-cols-2">
        <section className="min-h-[40vh] lg:min-h-0 flex flex-col border-r border-gray-200">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-600">
            <span>导言区：从 \documentclass 到 \begin{'{document}'} 之前，可以直接粘贴论文的</span>
            <button type="button" onClick={() => setPreamble(original)} className="inline-flex items-center gap-1 hover:text-gray-900" title="恢复为保存前的内容">
              <RotateCcw size={12} />
              还原
            </button>
          </div>
          <CodeEditor value={preamble} onChange={setPreamble} onRun={() => void runTest()} onSave={() => void save()} className="flex-1" />
        </section>
        <section className="min-h-0 overflow-auto bg-gray-50 p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">附件</h3>
              <button
                type="button"
                onClick={() => upload.current?.click()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-purple-200 bg-white text-xs text-purple-700 hover:bg-purple-50"
              >
                <Upload size={12} />
                上传
              </button>
              <input
                ref={upload}
                type="file"
                multiple
                accept={ATTACHMENT_TYPES.join(',')}
                className="hidden"
                onChange={(event) => {
                  void addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </div>
            <p className="mb-2 text-xs text-gray-500">
              会议模板的 .sty/.cls、导言区 \input 的 .tex、图片（PDF/PNG/JPG）。编译时和 main.tex 放在同一目录，不超过 20 MB。
            </p>
            {!stored && <p className="text-xs text-gray-400">正在读取附件…</p>}
            <ul className="space-y-1">
              {names.map((name) => {
                const isRemoved = removed.includes(name);
                return (
                  <li key={name} className="flex items-center gap-2 text-sm">
                    <FileText size={14} className="text-gray-400" />
                    <span className={isRemoved ? 'line-through text-gray-400' : 'text-gray-800'}>{name}</span>
                    {name in added && <span className="text-xs text-emerald-600">新上传</span>}
                    <button
                      type="button"
                      onClick={() =>
                        setRemoved((current) => (isRemoved ? current.filter((item) => item !== name) : [...current, name]))
                      }
                      className="ml-auto text-xs text-gray-500 hover:text-red-600"
                    >
                      {isRemoved ? '恢复' : <Trash2 size={13} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <button type="button" disabled={testing || !files} onClick={() => void runTest()} className={BUTTON_SECONDARY}>
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              测试编译
            </button>
            <p className="mt-1 text-xs text-gray-500">用一段示例文字和表格检查导言区能否编译。保存时这篇论文的所有块都会重新编译。</p>
          </div>
          {test && test.issues.length > 0 && (
            <ul className="space-y-1 text-sm text-red-700">
              {test.issues.map((issue, position) => (
                <li key={`${position}-${issue.message}`}>{describeIssue(issue)}</li>
              ))}
            </ul>
          )}
          {test?.ok && test.pdf && <PdfView data={test.pdf} width={test.width} height={test.height} className="shadow-sm" />}
        </section>
      </div>
    </div>
  );
};

export default PaperSettings;

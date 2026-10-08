import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, Copy, Download, Eye, EyeOff, Loader2, Paperclip, Play, Trash2, Upload, X } from 'lucide-react';
import PdfView from '../../components/results/PdfView';
import { pdfPageSize } from '../../components/results/pdfjs';
import { ResultBlock, ResultBlockKind, ResultPaper } from '../../types';
import { describeSaveError } from '../backend';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../components/Modal';
import { getTexEngine } from '../tex/engine';
import {
  BLOCK_TEMPLATES,
  IMAGE_TYPES,
  ReadFile,
  attachmentName,
  attachmentPath,
  attachmentProblem,
  extensionOf,
  loadAttachments,
  newBlockId,
  preambleOf,
  putFiles,
  rebuildWith,
  withOutputs,
} from './actions';
import { addBibEntries } from './bibtex';
import { FileWrite } from './backend';
import CodeEditor, { CodeEditorHandle } from './CodeEditor';
import { BlockCompileResult, REFERENCES_FILE, describeIssue } from './compile';
import { blockContext, describeFailure } from './numbering';
import { ResultsOp, resultsCommitMessage } from './ops';
import { createBlockPreview } from './preview';
import { exportTex, preambleNames } from './texNames';

export type ResultsSave = (op: ResultsOp, writes: FileWrite[], deletes: string[], message: string, publicMessage: string) => Promise<void>;

const KIND_LABEL: Record<ResultBlockKind, string> = { text: '文字', figure: '图', table: '表格' };
const COMPILE_DELAY_MS = 1000;

interface Compiled {
  result: BlockCompileResult;
  source: string;
  preview: ReturnType<typeof createBlockPreview>;
  ms: number;
}

interface Props {
  paper: ResultPaper;
  /** The block to edit; without it a new block of `blockKind` is added at the end. */
  blockId?: string;
  blockKind?: ResultBlockKind;
  readFile: ReadFile;
  onSave: ResultsSave;
  onClose: () => void;
}

/** Full-screen LaTeX editor for one block: code on the left, the compiled PDF on the right. */
const BlockEditor: React.FC<Props> = ({ paper, blockId, blockKind = 'text', readFile, onSave, onClose }) => {
  const existing = blockId === undefined ? undefined : paper.blocks.find((item) => item.id === blockId);
  const [block] = useState<ResultBlock>(() => existing ?? { id: newBlockId(), kind: blockKind, source: BLOCK_TEMPLATES[blockKind] });
  const isNew = existing === undefined;
  const original = block.source ?? '';
  const citationScope = `preview:${paper.id}:${block.id}`;
  const [source, setSource] = useState(original);
  const [stored, setStored] = useState<Record<string, Uint8Array> | null>(null);
  const [added, setAdded] = useState<Record<string, Uint8Array>>({});
  const [compiled, setCompiled] = useState<Compiled | null>(null);
  const [lastPdf, setLastPdf] = useState<BlockCompileResult | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<'code' | 'preview'>('code');
  const editor = useRef<CodeEditorHandle>(null);
  const latest = useRef(0);
  const busy = useRef(false);
  const upload = useRef<HTMLInputElement>(null);

  const preamble = preambleOf(paper);
  const names = useMemo(() => preambleNames(preamble), [preamble]);
  const files = useMemo(() => (stored ? { ...stored, ...added } : null), [stored, added]);
  const index = isNew ? paper.blocks.length : paper.blocks.findIndex((item) => item.id === block.id);
  const context = useMemo(
    () => blockContext(isNew ? [...paper.blocks, block] : paper.blocks, index, paper.references?.citations),
    [paper.blocks, paper.references, block, index, isNew],
  );
  const labels = useMemo(() => Object.keys(context.labels).sort(), [context.labels]);
  const preview = useMemo(() => (files ? createBlockPreview(paper, block, files, pdfPageSize) : null), [paper, block, files]);
  const dirty = source !== original || Object.keys(added).length > 0;

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

  const compile = useCallback(
    async (text: string): Promise<Compiled | null> => {
      if (!preview) return null;
      const ticket = ++latest.current;
      setCompiling(true);
      try {
        const engine = await getTexEngine();
        const started = performance.now();
        const result = await preview(engine, text);
        const next = { result, source: text, preview, ms: Math.round(performance.now() - started) };
        if (ticket === latest.current) {
          setCompiled(next);
          if (result.ok) setLastPdf(result);
          setProblem(null);
        }
        return next;
      } catch (error) {
        if (ticket === latest.current) setProblem(error instanceof Error ? error.message : 'TeX 引擎出错，请重试');
        return null;
      } finally {
        if (ticket === latest.current) setCompiling(false);
      }
    },
    [preview],
  );

  // Compile a moment after typing stops, and as soon as the attachments are in.
  useEffect(() => {
    if (!files) return undefined;
    const timer = setTimeout(() => void compile(source), compiled ? COMPILE_DELAY_MS : 0);
    return () => clearTimeout(timer);
    // `compiled` only decides the first delay; recompiling when it changes would loop.
  }, [source, files, compile]);

  const close = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm('放弃未保存的修改？')) return;
    onClose();
  }, [saving, dirty, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      // CodeMirror handles Escape itself when it closes a completion list or the search panel.
      if (event.key === 'Escape' && !event.defaultPrevented) close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);

  const publicMessage = `content: update result "${paper.title}"`;

  // One save, delete or hide at a time, even when Ctrl/Cmd+S is pressed again before the state updates.
  const run = async (work: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setProblem(null);
    try {
      await work();
    } catch (error) {
      setProblem(describeSaveError(error));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const save = () =>
    run(async () => {
      if (!files) return;
      const current = compiled && compiled.source === source && compiled.preview === preview ? compiled : await compile(source);
      if (!current) return;
      if (!current.result.ok) {
        setProblem('编译有错误，修好后才能保存');
        setTab('preview');
        return;
      }
      const nextBlock: ResultBlock = { ...block, source };
      const uploads = await putFiles(paper.id, added);
      const draft: ResultPaper = {
        ...paper,
        files: [...new Set([...(paper.files ?? []), ...Object.keys(added)])],
        fileHashes: { ...paper.fileHashes, ...uploads.hashes },
        blocks: isNew ? [...paper.blocks, nextBlock] : paper.blocks.map((item) => (item.id === block.id ? nextBlock : item)),
      };
      const rebuilt = await rebuildWith(draft, files);
      if (rebuilt.failed) {
        setProblem(describeFailure(draft.blocks, rebuilt.failed));
        return;
      }
      const ops: ResultsOp[] = [...uploads.ops, { kind: 'putBlock', paperId: paper.id, block: nextBlock }];
      const writes: FileWrite[] = [
        ...Object.entries(added).map(([name, data]) => ({ path: attachmentPath(paper.id, name), data })),
        ...rebuilt.writes,
      ];
      await onSave(
        withOutputs(paper.id, ops, rebuilt),
        writes,
        rebuilt.deletes,
        resultsCommitMessage(isNew ? 'add block to' : 'update block in', paper.title),
        publicMessage,
      );
      onClose();
    });

  const remove = () => {
    if (!files || !window.confirm('确定删除这个块吗？')) return;
    void run(async () => {
      const draft: ResultPaper = { ...paper, blocks: paper.blocks.filter((item) => item.id !== block.id) };
      const rebuilt = await rebuildWith(draft, files);
      if (rebuilt.failed) {
        setProblem(`${describeFailure(draft.blocks, rebuilt.failed, '删除后')}。先修好再删除。`);
        return;
      }
      const deletes = [...(block.output ? [block.output.pdf] : []), ...rebuilt.deletes];
      await onSave(
        withOutputs(paper.id, [{ kind: 'deleteBlock', paperId: paper.id, blockId: block.id }], rebuilt),
        rebuilt.writes,
        deletes,
        resultsCommitMessage('delete block in', paper.title),
        publicMessage,
      );
      onClose();
    });
  };

  const toggleHidden = () => {
    if (dirty && !window.confirm('放弃未保存的修改？')) return;
    if (block.hidden && !paper.hidden && !window.confirm('这篇论文已公开，取消隐藏后这个块会发布到网站。确定吗？')) return;
    void run(async () => {
      await onSave(
        { kind: 'setBlockHidden', paperId: paper.id, blockId: block.id, hidden: !block.hidden },
        [],
        [],
        resultsCommitMessage(block.hidden ? 'unhide block in' : 'hide block in', paper.title),
        publicMessage,
      );
      onClose();
    });
  };

  const copyTex = async () => {
    try {
      await navigator.clipboard.writeText(exportTex(source));
      setNotice('LaTeX 已复制');
    } catch {
      setNotice('复制失败，请改用"下载"');
    }
  };

  const downloadTex = () => {
    const name = /\\label\{([^}]+)\}/.exec(source)?.[1]?.replace(/[^A-Za-z0-9_-]+/g, '-') || block.id;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([exportTex(source)], { type: 'text/x-tex' }));
    link.download = `${name}.tex`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  /**
   * Adds BibTeX entries copied from elsewhere (Google Scholar, DBLP…) to the paper's references.bib, creating it
   * if needed, and puts their citation keys on the clipboard for \cite{…}. Saved at once, apart from the block.
   */
  const pasteBib = () =>
    run(async () => {
      if (!files) return;
      let pasted = '';
      try {
        pasted = await navigator.clipboard.readText();
      } catch {
        pasted = window.prompt('把 BibTeX 条目粘贴到这里') ?? '';
      }
      const existing = files[REFERENCES_FILE] ? new TextDecoder().decode(files[REFERENCES_FILE]) : '';
      const merge = addBibEntries(existing, pasted);
      const keys = [...merge.added, ...merge.skipped];
      if (keys.length === 0) {
        setProblem('剪贴板里没有 BibTeX 条目（应该以 @article{… 这样开头）');
        return;
      }
      const created = !(paper.files ?? []).includes(REFERENCES_FILE);
      if (created && !window.confirm(`这篇论文还没有参考文献文件，要新建 ${REFERENCES_FILE} 并加入这些条目吗？`)) return;
      if (merge.added.length > 0) {
        const data = new TextEncoder().encode(merge.text);
        const uploads = await putFiles(paper.id, { [REFERENCES_FILE]: data });
        await onSave(
          uploads.ops[0],
          [{ path: attachmentPath(paper.id, REFERENCES_FILE), data }],
          [],
          resultsCommitMessage('add references to', paper.title),
          publicMessage,
        );
        setStored((current) => ({ ...(current ?? {}), [REFERENCES_FILE]: data }));
      }
      const copied = await navigator.clipboard.writeText(keys.join(',')).then(
        () => true,
        () => false,
      );
      const parts = [
        merge.added.length > 0 ? `已加入 ${merge.added.length} 条文献${created ? `（新建了 ${REFERENCES_FILE}）` : ''}` : '',
        merge.skipped.length > 0 ? `${merge.skipped.join('、')} 已经在参考文献里` : '',
        copied ? `引用名已复制：${keys.join(',')}` : `引用名：${keys.join(',')}`,
      ];
      setNotice(`${parts.filter(Boolean).join('；')}。在正文中引用后，预览会自动更新。`);
    });

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const next: Record<string, Uint8Array> = {};
    for (const file of Array.from(list)) {
      const reason = attachmentProblem(file);
      if (reason) {
        setProblem(`${file.name}：${reason}`);
        continue;
      }
      const data = new Uint8Array(await file.arrayBuffer());
      next[await attachmentName(file.name, data)] = data;
    }
    setAdded((current) => ({ ...current, ...next }));
  };

  const images = files ? Object.keys(files).filter((name) => IMAGE_TYPES.includes(extensionOf(name))) : [];
  const shown = compiled?.result;
  const sourceProblems = (shown?.issues ?? [])
    .filter((issue) => issue.area === 'source' && issue.line !== undefined)
    .map((issue) => ({ line: issue.line!, message: issue.message }));

  let status: React.ReactNode = null;
  if (!files) status = '正在读取附件…';
  else if (compiling) status = (
    <span className="inline-flex items-center gap-1">
      <Loader2 size={12} className="animate-spin" />
      编译中…
    </span>
  );
  else if (shown?.ok) status = <span className="text-emerald-600">已编译 · {compiled!.ms} ms</span>;
  else if (shown) status = <span className="text-red-600">{shown.issues.length} 个错误</span>;

  return (
    <div role="dialog" aria-modal="true" aria-label={`${KIND_LABEL[block.kind]}编辑器`} className="fixed inset-0 z-[100] flex flex-col bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 border-b border-gray-200">
        <span className="font-semibold text-gray-900">
          {isNew ? '添加' : '编辑'}
          {KIND_LABEL[block.kind]}
        </span>
        <span className="text-sm text-gray-500 truncate max-w-[16rem]">{paper.title}</span>
        <span className="text-xs text-gray-500">{status}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void compile(source)} className={BUTTON_SECONDARY} title="立即编译（Ctrl/Cmd+Enter）">
            <Play size={14} />
            编译
          </button>
          <button type="button" onClick={() => void copyTex()} className={BUTTON_SECONDARY} title="复制 LaTeX 代码（开头注明需要的宏包）">
            <Copy size={14} />
            复制 LaTeX
          </button>
          <button
            type="button"
            disabled={saving || !files}
            onClick={() => void pasteBib()}
            className={BUTTON_SECONDARY}
            title="把复制来的 BibTeX 条目加入 references.bib，并把它们的引用名放到剪贴板"
          >
            <ClipboardPaste size={14} />
            粘贴 BibTeX
          </button>
          <button type="button" onClick={downloadTex} className={BUTTON_SECONDARY} title="下载为 .tex 文件">
            <Download size={14} />
          </button>
          {!isNew && (
            <button type="button" disabled={saving} onClick={toggleHidden} className={BUTTON_SECONDARY}>
              {block.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {block.hidden ? '取消隐藏' : '隐藏'}
            </button>
          )}
          {!isNew && (
            <button type="button" disabled={saving} onClick={remove} className={`${BUTTON_SECONDARY} text-red-600`}>
              <Trash2 size={14} />
              删除
            </button>
          )}
          <button type="button" disabled={saving} onClick={close} className={BUTTON_SECONDARY}>
            取消
          </button>
          <button type="button" disabled={saving || !files} onClick={() => void save()} className={BUTTON_PRIMARY} title="保存（Ctrl/Cmd+S）">
            {saving ? '保存中…' : '保存'}
          </button>
          <button type="button" onClick={close} aria-label="关闭" className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
      </header>
      {(problem || notice || !paper.hidden) && (
        <div className="px-4 py-2 space-y-1 text-sm border-b border-gray-100">
          {problem && (
            <p role="alert" className="text-red-700">
              {problem}
            </p>
          )}
          {notice && <p className="text-emerald-700">{notice}</p>}
          {!paper.hidden && !block.hidden && <p className="text-amber-700">这篇论文已公开，保存后访客就能看到这个块。</p>}
        </div>
      )}
      <div className="flex lg:hidden border-b border-gray-200 text-sm">
        {(['code', 'preview'] as const).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={`flex-1 py-2 ${tab === name ? 'text-purple-700 border-b-2 border-purple-600' : 'text-gray-500'}`}
          >
            {name === 'code' ? '代码' : '预览'}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 grid lg:grid-cols-2">
        <section className={`min-h-0 flex-col border-r border-gray-200 ${tab === 'code' ? 'flex' : 'hidden lg:flex'}`}>
          {block.kind === 'figure' && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs">
              <Paperclip size={14} className="text-gray-400" />
              {images.length === 0 && <span className="text-gray-500">还没有图片：上传 PDF、PNG 或 JPG（不超过 20 MB）</span>}
              {images.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => editor.current?.insert(`\\includegraphics[width=\\linewidth]{${name}}\n`)}
                  className="px-2 py-1 rounded border border-gray-300 bg-white hover:border-purple-300 hover:text-purple-700"
                  title="在光标处插入 \includegraphics"
                >
                  插入 {name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => upload.current?.click()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-purple-200 bg-white text-purple-700 hover:bg-purple-50"
              >
                <Upload size={12} />
                上传图片
              </button>
              <input
                ref={upload}
                type="file"
                multiple
                accept={IMAGE_TYPES.join(',')}
                className="hidden"
                onChange={(event) => {
                  void addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </div>
          )}
          <CodeEditor
            ref={editor}
            value={source}
            onChange={setSource}
            problems={sourceProblems}
            macros={names.macros}
            colors={names.colors}
            labels={labels}
            onRun={() => void compile(source)}
            onSave={() => void save()}
            className="flex-1"
          />
        </section>
        <section className={`min-h-0 overflow-auto bg-gray-50 p-4 space-y-3 ${tab === 'preview' ? 'block' : 'hidden lg:block'}`}>
          {shown && shown.issues.length > 0 && (
            <ul className="space-y-1 text-sm">
              {shown.issues.map((issue, position) => (
                <li key={`${position}-${issue.message}`}>
                  <button
                    type="button"
                    disabled={issue.area !== 'source' || issue.line === undefined}
                    onClick={() => {
                      setTab('code');
                      editor.current?.goToLine(issue.line!);
                    }}
                    className="text-left text-red-700 hover:underline disabled:no-underline disabled:cursor-default"
                  >
                    {describeIssue(issue)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lastPdf?.pdf ? (
            <div className={shown && !shown.ok ? 'opacity-40' : undefined}>
              <PdfView data={lastPdf.pdf} width={lastPdf.width} height={lastPdf.height} citationScope={citationScope} className="shadow-sm" />
              {lastPdf.references && (
                <div className="mt-8 border-t border-gray-200 pt-4">
                  <PdfView {...lastPdf.references} data={lastPdf.references.pdf} citationScope={citationScope} citationTargets className="shadow-sm" />
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-gray-400">{files ? '编译后在这里显示' : '正在读取附件…'}</div>
          )}
          {shown && shown.warnings.length > 0 && (
            <details className="text-xs text-amber-700">
              <summary className="cursor-pointer">{shown.warnings.length} 条警告</summary>
              <ul className="mt-1 space-y-1">
                {shown.warnings.map((warning, position) => (
                  <li key={`${position}-${warning}`}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
          {shown && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">编译日志</summary>
              <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap">{shown.log}</pre>
            </details>
          )}
        </section>
      </div>
    </div>
  );
};

export default BlockEditor;

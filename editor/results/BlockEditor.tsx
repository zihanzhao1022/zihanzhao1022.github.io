import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, Copy, Download, Eye, EyeOff, FolderTree, Loader2, Play, Redo2, Trash2, Undo2, X } from 'lucide-react';
import PdfView from '../../components/results/PdfView';
import { pdfPageSize } from '../../components/results/pdfjs';
import { N_, useLang, useMessage } from '../../lib/i18n';
import { useT } from '../../lib/phrases/results';
import { FloatKind, PdfBlockKind, ResultBlock, ResultBlockKind, ResultPaper } from '../../types';
import { describeSaveError } from '../backend';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../components/Modal';
import { getTexEngine } from '../tex/engine';
import {
  BLOCK_TEMPLATES,
  ReadFile,
  SHARP_WIDTH,
  attachmentPath,
  loadAttachments,
  newBlockId,
  pixelWidth,
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
import { ResultsOp, applyResultsOp, resultsCommitMessage } from './ops';
import { createBlockPreview } from './preview';
import { exportTex, preambleNames } from './texNames';
import TableVisualEditor from './table/TableVisualEditor';
import { convertedBlock, filesKeptVersionsUse } from './convert';
import FileTree from './FileTree';
import { insertionFor } from './attachmentTree';
import { planUpload } from './uploads';
import { MAX_ENTRIES, PickedFile, TooManyFiles, carriesFiles, droppedFiles } from '../../components/results/droppedFiles';
import { createTable } from './table/model';
import { parseTable, serializeTable } from './table/latex';

export type ResultsSave = (op: ResultsOp, writes: FileWrite[], deletes: string[], message: string, publicMessage: string) => Promise<void>;

/** Each kind's name, and the editor's title when adding or editing one. */
const KIND: Record<ResultBlockKind, { label: string; add: string; edit: string }> = {
  text: { label: N_('文字'), add: N_('添加文字'), edit: N_('编辑文字') },
  figure: { label: N_('图'), add: N_('添加图'), edit: N_('编辑图') },
  table: { label: N_('表格'), add: N_('添加表格'), edit: N_('编辑表格') },
};
const COMPILE_DELAY_MS = 1000;

interface Compiled {
  result: BlockCompileResult;
  source: string;
  preview: ReturnType<typeof createBlockPreview>;
  ms: number;
}

interface Props {
  paper: ResultPaper;
  /** The block to edit; without it a new block of `blockKind` is added. */
  blockId?: string;
  blockKind?: PdfBlockKind;
  /** Insert a new block below this one; omit to append. */
  afterBlockId?: string;
  /** Turn the figure or table into the other kind (see convertedBlock); saving changes its kind. */
  convertTo?: FloatKind;
  readFile: ReadFile;
  onSave: ResultsSave;
  onClose: () => void;
}

/** Full-screen LaTeX editor for one block: code on the left, the compiled PDF on the right. */
const BlockEditor: React.FC<Props> = ({ paper, blockId, blockKind = 'text', afterBlockId, convertTo, readFile, onSave, onClose }) => {
  const t = useT();
  const existing = blockId === undefined ? undefined : paper.blocks.find((item) => item.id === blockId);
  const [block] = useState<ResultBlock>(() => {
    if (existing && convertTo && convertTo !== existing.kind) return convertedBlock(existing, convertTo);
    return existing ?? {
      id: newBlockId(), kind: blockKind,
      source: blockKind === 'table' ? serializeTable(createTable()) : BLOCK_TEMPLATES[blockKind](),
    };
  });
  const isNew = existing === undefined;
  /** The block keeps its place, hidden or not, and its comments; only its kind and code change. */
  const converting = existing !== undefined && existing.kind !== block.kind;
  /** It goes back to the version kept from an earlier turn, rather than starting that kind over. */
  const restoring = converting && existing.alternate?.kind === block.kind;
  const original = block.source ?? '';
  const citationScope = `preview:${paper.id}:${block.id}`;
  const [source, setSource] = useState(original);
  const [stored, setStored] = useState<Record<string, Uint8Array> | null>(null);
  const [added, setAdded] = useState<Record<string, Uint8Array>>({});
  const [compiled, setCompiled] = useState<Compiled | null>(null);
  const [lastPdf, setLastPdf] = useState<BlockCompileResult | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [problem, setProblem] = useMessage();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useMessage();
  /** Images uploaded here that are too small to look sharp, with their widths in pixels. */
  const [soft, setSoft] = useState<{ name: string; width: number }[]>([]);
  /** Files the last upload left out; kept apart from the compile's problems, which each compile replaces. */
  const [leftOut, setLeftOut] = useMessage();
  /** Attachments marked for deletion in the file tree; deleted when the block is saved. */
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [showFiles, setShowFiles] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);
  /** A drag with files is over the editor. */
  const [dropping, setDropping] = useState(false);
  const [tab, setTab] = useState<'code' | 'preview'>('code');
  const [tableMode, setTableMode] = useState<'visual' | 'latex'>(() =>
    block.kind === 'table' && parseTable(original, preambleOf(paper)).ok ? 'visual' : 'latex',
  );
  const [targetLine, setTargetLine] = useState<number | null>(null);
  const tableUndo = useRef<string[]>([]);
  const tableRedo = useRef<string[]>([]);
  const editor = useRef<CodeEditorHandle>(null);
  const latest = useRef(0);
  const busy = useRef(false);

  const preamble = preambleOf(paper);
  const lang = useLang();
  // The parse explains in the interface language why a table cannot be edited visually, so it follows the switch.
  const table = useMemo(() => block.kind === 'table' ? parseTable(source, preamble) : null, [block.kind, source, preamble, lang]);
  const names = useMemo(() => preambleNames(preamble), [preamble]);
  const files = useMemo(() => {
    if (!stored) return null;
    const all = { ...stored, ...added };
    removed.forEach((name) => delete all[name]);
    return all;
  }, [stored, added, removed]);
  /** What the file tree lists: the paper's attachments and those uploaded here. */
  const fileNames = useMemo(() => [...new Set([...(paper.files ?? []), ...Object.keys(added)])], [paper.files, added]);
  const addedNames = useMemo(() => new Set(Object.keys(added)), [added]);
  const blockOp = useMemo<Extract<ResultsOp, { kind: 'putBlock' }>>(() => {
    const anchor = afterBlockId === undefined ? -1 : paper.blocks.findIndex((item) => item.id === afterBlockId);
    return { kind: 'putBlock', paperId: paper.id, block, ...(isNew && anchor >= 0 ? { at: anchor + 1 } : {}) };
  }, [paper.id, paper.blocks, block, afterBlockId, isNew]);
  // Use the insertion order for preview, counters and saving, including hidden blocks.
  const draftPaper = useMemo(() => applyResultsOp([paper], blockOp)[0], [paper, blockOp]);
  const index = draftPaper.blocks.findIndex((item) => item.id === block.id);
  const context = useMemo(
    () => blockContext(draftPaper.blocks, index, paper.references?.citations),
    [draftPaper.blocks, paper.references, index],
  );
  const labels = useMemo(() => Object.keys(context.labels).sort(), [context.labels]);
  const preview = useMemo(() => (files ? createBlockPreview(draftPaper, block, files, pdfPageSize) : null), [draftPaper, block, files]);
  const dirty = source !== original || Object.keys(added).length > 0 || removed.size > 0;

  const changeSource = (text: string) => {
    if (text === source) return;
    if (block.kind === 'table') {
      tableUndo.current = [...tableUndo.current.slice(-199), source];
      tableRedo.current = [];
    }
    setSource(text);
  };
  const restoreTable = (redo = false) => {
    if (saving) return;
    const from = redo ? tableRedo : tableUndo;
    const to = redo ? tableUndo : tableRedo;
    const previous = from.current.pop();
    if (previous === undefined) return;
    to.current.push(source);
    setSource(previous);
  };

  useEffect(() => {
    if (targetLine === null || (block.kind === 'table' && tableMode !== 'latex')) return;
    editor.current?.goToLine(targetLine);
    setTargetLine(null);
  }, [targetLine, tableMode, block.kind]);

  useEffect(() => {
    let cancelled = false;
    loadAttachments(paper, readFile)
      .then((loaded) => {
        if (!cancelled) setStored(loaded);
      })
      .catch(() => {
        if (!cancelled) setProblem(() => t('读取论文附件失败，请关闭后重试'));
      });
    return () => {
      cancelled = true;
    };
  }, [paper, readFile]);

  const compile = useCallback(
    async (text: string): Promise<Compiled | null> => {
      // An empty block has nothing to show; TeX would only complain that there is no page.
      if (!preview || !text.trim()) return null;
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
        if (ticket === latest.current) setProblem(() => error instanceof Error ? error.message : t('TeX 引擎出错，请重试'));
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
    if (dirty && !window.confirm(t('放弃未保存的修改？'))) return;
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
      setProblem(() => describeSaveError(error));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const save = () =>
    run(async () => {
      if (!files) return;
      if (!source.trim()) {
        setProblem(() => t('请先输入内容'));
        return;
      }
      const current = compiled && compiled.source === source && compiled.preview === preview ? compiled : await compile(source);
      if (!current) return;
      if (!current.result.ok) {
        setProblem(() => t('编译有错误，修好后才能保存'));
        setTab('preview');
        return;
      }
      // Files marked for deletion that the paper has; the compiles below run without them.
      const gone = [...removed].filter((name) => (paper.files ?? []).includes(name));
      const needed = filesKeptVersionsUse(paper.blocks, gone);
      if (needed.length > 0) {
        setProblem(() => t('第 {n} 个块存下的另一个版本还要用 {name}，不能移除', needed[0]));
        return;
      }
      const nextBlock: ResultBlock = { ...block, source };
      const putBlock: ResultsOp = { ...blockOp, block: nextBlock };
      const uploads = await putFiles(paper.id, added);
      const ops: ResultsOp[] = [...uploads.ops, ...gone.map((name): ResultsOp => ({ kind: 'removeFile', paperId: paper.id, name })), putBlock];
      const draft = ops.reduce<ResultPaper[]>((papers, op) => applyResultsOp(papers, op), [paper])[0];
      const rebuilt = await rebuildWith(draft, files);
      const failed = rebuilt.failed;
      if (failed) {
        setProblem(() => describeFailure(draft.blocks, failed));
        return;
      }
      const writes: FileWrite[] = [
        ...Object.entries(added).map(([name, data]) => ({ path: attachmentPath(paper.id, name), data })),
        ...rebuilt.writes,
      ];
      await onSave(
        withOutputs(paper.id, ops, rebuilt),
        writes,
        [...gone.map((name) => attachmentPath(paper.id, name)), ...rebuilt.deletes],
        resultsCommitMessage(converting ? 'convert block in' : isNew ? 'add block to' : 'update block in', paper.title),
        publicMessage,
      );
      onClose();
    });

  const remove = () => {
    if (!files || !window.confirm(t('确定删除这个块吗？'))) return;
    void run(async () => {
      const draft: ResultPaper = { ...paper, blocks: paper.blocks.filter((item) => item.id !== block.id) };
      const rebuilt = await rebuildWith(draft, files);
      const failed = rebuilt.failed;
      if (failed) {
        setProblem(() => t('{problem}。先修好再删除。', { problem: describeFailure(draft.blocks, failed, 'delete') }));
        return;
      }
      const deletes = [...[block.output, block.alternate?.output].flatMap((output) => (output ? [output.pdf] : [])), ...rebuilt.deletes];
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
    if (dirty && !window.confirm(t('放弃未保存的修改？'))) return;
    if (block.hidden && !paper.hidden && !window.confirm(t('这篇论文已公开，取消隐藏后这个块会发布到网站。确定吗？'))) return;
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
      setNotice(() => t('LaTeX 已复制'));
    } catch {
      setNotice(() => t('复制失败，请改用"下载"'));
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
        pasted = window.prompt(t('把 BibTeX 条目粘贴到这里')) ?? '';
      }
      const existing = files[REFERENCES_FILE] ? new TextDecoder().decode(files[REFERENCES_FILE]) : '';
      const merge = addBibEntries(existing, pasted);
      const keys = [...merge.added, ...merge.skipped];
      if (keys.length === 0) {
        setProblem(() => t('剪贴板里没有 BibTeX 条目（应该以 @article{… 这样开头）'));
        return;
      }
      const created = !(paper.files ?? []).includes(REFERENCES_FILE);
      if (created && !window.confirm(t('这篇论文还没有参考文献文件，要新建 {file} 并加入这些条目吗？', { file: REFERENCES_FILE }))) return;
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
      const entries = { n: merge.added.length, file: REFERENCES_FILE };
      const parts = [
        merge.added.length > 0 ? (created ? t('已加入 {n} 条文献（新建了 {file}）', entries) : t('已加入 {n} 条文献', entries)) : '',
        merge.skipped.length > 0 ? t('{keys} 已经在参考文献里', { keys: merge.skipped.join(t('、')) }) : '',
        copied ? t('引用名已复制：{keys}', { keys: keys.join(',') }) : t('引用名：{keys}', { keys: keys.join(',') }),
      ];
      setNotice(() => t('{parts}。在正文中引用后，预览会自动更新。', { parts: parts.filter(Boolean).join(t('；')) }));
    });

  /** Adds files picked or dropped in the file tree; they are uploaded with the block. */
  const addPicked = async (picked: PickedFile[]) => {
    const plan = await planUpload(picked, fileNames);
    const names = Object.keys(plan.files);
    const skipped = [...plan.skipped.type, ...plan.skipped.size, ...plan.skipped.count];
    if (plan.replaced.length > 0 && !window.confirm(t('会覆盖这些同名文件：{names}。继续吗？', { names: plan.replaced.join(t('、')) }))) return;
    const listed = `${skipped.slice(0, 5).join(t('、'))}${skipped.length > 5 ? '…' : ''}`;
    setLeftOut(skipped.length > 0 ? () => t('跳过了 {n} 个编译用不到或超过 20 MB 的文件：{names}', { n: skipped.length, names: listed }) : null);
    if (names.length === 0) return;
    const small: { name: string; width: number }[] = [];
    for (const name of names) {
      const width = await pixelWidth(name, plan.files[name]);
      if (width !== null && width < SHARP_WIDTH) small.push({ name, width });
    }
    setAdded((current) => ({ ...current, ...plan.files }));
    setRemoved((current) => new Set([...current].filter((name) => !(name in plan.files))));
    setSoft((current) => [...current.filter((image) => !(image.name in plan.files)), ...small]);
  };

  const toggleRemove = (name: string) => {
    if (name in added) {
      // Uploaded here: it is simply not uploaded.
      setAdded(({ [name]: _dropped, ...rest }) => rest);
      setSoft((current) => current.filter((image) => image.name !== name));
      return;
    }
    setRemoved((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const insertFile = (name: string) => {
    const code = insertionFor(name);
    if (code) editor.current?.insert(code);
  };
  // The visual table editor has no cursor to insert at.
  const canInsert = !(block.kind === 'table' && tableMode === 'visual');

  // Files and folders dropped anywhere on the editor go to the file tree; the page behind must not get them.
  const dragHandlers = {
    onDragEnterCapture: (event: React.DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDropping(true);
      setShowFiles(true);
    },
    onDragOverCapture: (event: React.DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = saving || !files ? 'none' : 'copy';
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
    },
    onDropCapture: (event: React.DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setDropping(false);
      if (saving || !files) return;
      droppedFiles(event.dataTransfer).then(
        (picked) => void addPicked(picked),
        (error: unknown) => {
          if (error instanceof TooManyFiles) setProblem(() => t('拖进来的文件太多了（超过 {n} 个），请只拖需要的文件或文件夹', { n: MAX_ENTRIES }));
        },
      );
    },
  };
  const shown = compiled?.result;
  const sourceProblems = (shown?.issues ?? [])
    .filter((issue) => issue.area === 'source' && issue.line !== undefined)
    .map((issue) => ({ line: issue.line!, message: issue.message }));

  let status: React.ReactNode = null;
  if (!files) status = t('正在读取附件…');
  else if (compiling) status = (
    <span className="inline-flex items-center gap-1">
      <Loader2 size={12} className="animate-spin" />
      {t('编译中…')}
    </span>
  );
  else if (shown?.ok) status = <span className="text-emerald-600">{t('已编译 · {ms} ms', { ms: compiled!.ms })}</span>;
  else if (shown) status = <span className="text-red-600">{t('{n} 个错误', { n: shown.issues.length })}</span>;

  return (
    <div role="dialog" aria-modal="true" aria-label={t('{kind}编辑器', { kind: t(KIND[block.kind].label) })} className="fixed inset-0 z-[100] flex flex-col bg-white"
      {...dragHandlers}
      onKeyDown={(event) => {
        if (block.kind !== 'table' || tableMode !== 'visual' || !(event.metaKey || event.ctrlKey)) return;
        if (event.key.toLowerCase() === 's') { event.preventDefault(); if (files) void save(); }
        if (event.key === 'Enter') { event.preventDefault(); void compile(source); }
        if (event.key.toLowerCase() === 'z') { event.preventDefault(); restoreTable(event.shiftKey); }
      }}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setShowFiles((open) => !open)}
          aria-pressed={showFiles}
          aria-label={showFiles ? t('收起文件') : t('显示文件')}
          title={showFiles ? t('收起文件') : t('显示文件')}
          className={`-ml-1 rounded p-1 ${showFiles ? 'bg-purple-50 text-purple-700' : 'text-gray-500 hover:text-purple-700'}`}
        >
          <FolderTree size={18} />
        </button>
        <span className="font-semibold text-gray-900">
          {converting ? (block.kind === 'table' ? t('把图转换成表格') : t('把表格转换成图')) : t(isNew ? KIND[block.kind].add : KIND[block.kind].edit)}
        </span>
        <span className="text-sm text-gray-500 truncate max-w-[16rem]">{paper.title}</span>
        <span className="text-xs text-gray-500">{status}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void compile(source)} className={BUTTON_SECONDARY} title={t('立即编译（Ctrl/Cmd+Enter）')}>
            <Play size={14} />
            {t('编译')}
          </button>
          <button type="button" onClick={() => void copyTex()} className={BUTTON_SECONDARY} title={t('复制 LaTeX 代码（开头注明需要的宏包）')}>
            <Copy size={14} />
            {t('复制 LaTeX')}
          </button>
          <button
            type="button"
            disabled={saving || !files}
            onClick={() => void pasteBib()}
            className={BUTTON_SECONDARY}
            title={t('把复制来的 BibTeX 条目加入 references.bib，并把它们的引用名放到剪贴板')}
          >
            <ClipboardPaste size={14} />
            {t('粘贴 BibTeX')}
          </button>
          <button type="button" onClick={downloadTex} className={BUTTON_SECONDARY} title={t('下载为 .tex 文件')}>
            <Download size={14} />
          </button>
          {!isNew && (
            <button type="button" disabled={saving} onClick={toggleHidden} className={BUTTON_SECONDARY}>
              {block.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {block.hidden ? t('取消隐藏') : t('隐藏')}
            </button>
          )}
          {!isNew && (
            <button type="button" disabled={saving} onClick={remove} className={`${BUTTON_SECONDARY} text-red-600`}>
              <Trash2 size={14} />
              {t('删除')}
            </button>
          )}
          <button type="button" disabled={saving} onClick={close} className={BUTTON_SECONDARY}>
            {t('取消')}
          </button>
          <button type="button" disabled={saving || !files} onClick={() => void save()} className={BUTTON_PRIMARY} title={t('保存（Ctrl/Cmd+S）')}>
            {saving ? t('保存中…') : t('保存')}
          </button>
          <button type="button" onClick={close} aria-label={t('关闭')} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
      </header>
      {(problem || notice || converting || soft.length > 0 || leftOut || !paper.hidden) && (
        <div className="px-4 py-2 space-y-1 text-sm border-b border-gray-100">
          {converting && (
            <p className="text-purple-700">
              {restoring
                ? block.kind === 'table'
                  ? t('这是之前存下的表格，保存后换成它；现在的图也会存下，随时可以换回来。取消则保持原样。')
                  : t('这是之前存下的图，保存后换成它；现在的表格也会存下，随时可以换回来。取消则保持原样。')
                : block.kind === 'table'
                  ? t('第一次转为表格：在这里填表格，图题和引用名已保留。保存后原来的图会存下，随时可以换回来；取消则保持原样。')
                  : t('第一次转为图：在左边的文件里上传图片，点它就能加进代码，图题和引用名已保留。保存后原来的表格会存下，随时可以换回来；取消则保持原样。')}
            </p>
          )}
          {problem && (
            <p role="alert" className="text-red-700">
              {problem}
            </p>
          )}
          {notice && <p className="text-emerald-700">{notice}</p>}
          {leftOut && <p className="text-amber-700">{leftOut}</p>}
          {soft.map((image) => (
            <p key={image.name} className="text-amber-700">
              {t('{name} 只有 {width} 像素宽，在网页上会发糊；有 PDF 版本的话建议换成 PDF。', image)}
            </p>
          ))}
          {!paper.hidden && !block.hidden && <p className="text-amber-700">{t('这篇论文已公开，保存后访客就能看到这个块。')}</p>}
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
            {name === 'code' ? (block.kind === 'table' ? t('编辑') : t('代码')) : t('预览')}
          </button>
        ))}
      </div>
      <div className="relative flex flex-1 min-h-0">
      {showFiles && (
        <FileTree
          names={fileNames}
          added={addedNames}
          removed={removed}
          onInsert={canInsert ? insertFile : undefined}
          onUpload={(picked) => void addPicked(picked)}
          onToggleRemove={toggleRemove}
          dropping={dropping}
          disabled={saving || !files}
          onClose={() => setShowFiles(false)}
          className="absolute inset-y-0 left-0 z-20 shadow-xl lg:static lg:z-auto lg:shadow-none"
        />
      )}
      <div className={`flex-1 min-w-0 min-h-0 grid ${block.kind === 'table' && tableMode === 'visual' ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : 'lg:grid-cols-2'}`}>
        <section className={`min-h-0 min-w-0 flex-col border-r border-gray-200 ${tab === 'code' ? 'flex' : 'hidden lg:flex'}`}>
          {block.kind === 'table' && (
            <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-200 bg-white">
              <div className="inline-flex rounded-lg bg-purple-50 p-1 gap-1" role="group" aria-label={t('表格编辑方式')}>
                {(['visual', 'latex'] as const).map((mode) => (
                  <button key={mode} type="button" aria-pressed={tableMode === mode} onClick={() => setTableMode(mode)}
                    className={`rounded-md px-3 py-1.5 text-sm ${tableMode === mode ? 'bg-white text-purple-700 shadow-sm font-medium' : 'text-gray-500 hover:text-purple-700'}`}>
                    {mode === 'visual' ? t('可视化') : 'LaTeX'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button type="button" aria-label={t('撤销表格修改')} title={t('撤销')} disabled={saving || !tableUndo.current.length} onClick={() => restoreTable()}
                  className="p-1.5 rounded text-gray-500 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-30"><Undo2 size={16} /></button>
                <button type="button" aria-label={t('重做表格修改')} title={t('重做')} disabled={saving || !tableRedo.current.length} onClick={() => restoreTable(true)}
                  className="p-1.5 rounded text-gray-500 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-30"><Redo2 size={16} /></button>
              </div>
              <span className="text-xs text-gray-400 ml-auto hidden sm:inline">{t('自动更新预览')}</span>
            </div>
          )}
          {block.kind === 'table' && tableMode === 'visual' ? (
            table?.ok ? <TableVisualEditor value={table.table} onChange={(next) => changeSource(serializeTable(next))} disabled={saving} /> : (
              <div className="m-5 rounded-xl border border-purple-100 bg-purple-50/50 p-5 text-sm text-gray-600 space-y-3">
                <p className="font-medium text-gray-900">{t('这张表格需要使用 LaTeX 编辑')}</p>
                <p>{table && !table.ok ? table.reason : t('暂时无法读取表格结构。')}</p>
                <p>{t('原代码已保留，不会自动替换或丢失内容。')}</p>
                <button type="button" className={BUTTON_SECONDARY} onClick={() => setTableMode('latex')}>{t('返回 LaTeX 编辑')}</button>
              </div>
            )
          ) : <CodeEditor
            ref={editor}
            value={source}
            onChange={changeSource}
            problems={sourceProblems}
            macros={names.macros}
            colors={names.colors}
            labels={labels}
            placeholder={block.kind === 'text' ? t('在这里写文字，数学公式照常可用：$E = mc^2$') : undefined}
            onRun={() => void compile(source)}
            onSave={() => void save()}
            className="flex-1"
          />}
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
                      setTableMode('latex');
                      setTargetLine(issue.line!);
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
            <div className="py-20 text-center text-sm text-gray-400">{files ? t('编译后在这里显示') : t('正在读取附件…')}</div>
          )}
          {shown && shown.warnings.length > 0 && (
            <details className="text-xs text-amber-700">
              <summary className="cursor-pointer">{t('{n} 条警告', { n: shown.warnings.length })}</summary>
              <ul className="mt-1 space-y-1">
                {shown.warnings.map((warning, position) => (
                  <li key={`${position}-${warning}`}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
          {shown && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">{t('编译日志')}</summary>
              <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap">{shown.log}</pre>
            </details>
          )}
        </section>
      </div>
      </div>
    </div>
  );
};

export default BlockEditor;

import React, { useRef, useState } from 'react';
import { useMessage } from '../../lib/i18n';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { headingText, startsAppendix } from '../../lib/headings';
import { useT } from '../../lib/phrases/results';
import { HeadingLevel, ResultBlock, ResultHeading, ResultPaper } from '../../types';
import { describeSaveError } from '../backend';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Modal } from '../components/Modal';
import { ReadFile, loadAttachments, newBlockId, rebuildWith, withOutputs } from './actions';
import type { ResultsSave } from './BlockEditor';
import { describeFailure } from './numbering';
import { ResultsOp, applyResultsOp, resultsCommitMessage } from './ops';

const LEVELS: { level: HeadingLevel; text: string }[] = [
  { level: 'section', text: 'section' },
  { level: 'subsection', text: 'subsection' },
  { level: 'subsubsection', text: 'subsubsection' },
  { level: 'paragraph', text: 'paragraph' },
];
const LABEL = /^[A-Za-z0-9:_.-]+$/;
const MAX_TITLE = 200;

interface Props {
  paper: ResultPaper;
  /** The heading to edit; without it a new one is added. */
  blockId?: string;
  /** Insert a new heading below this block; omit to append. */
  afterBlockId?: string;
  readFile: ReadFile;
  onSave: ResultsSave;
  onClose: () => void;
}

/** A results page's section heading: level, numbering, title, the label \ref uses, and where the appendix starts. */
const HeadingEditor: React.FC<Props> = ({ paper, blockId, afterBlockId, readFile, onSave, onClose }) => {
  const t = useT();
  const existing = blockId === undefined ? undefined : paper.blocks.find((item) => item.id === blockId);
  const [id] = useState(() => existing?.id ?? newBlockId());
  const initial = existing?.heading;
  const [level, setLevel] = useState<HeadingLevel>(initial?.level ?? 'section');
  const [numbered, setNumbered] = useState(initial ? !initial.starred : true);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [appendix, setAppendix] = useState(initial?.appendix === true);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useMessage();
  const busy = useRef(false);
  const isNew = existing === undefined;
  // The appendix starts once; another heading may already start it.
  const appendixAt = paper.blocks.find((block) => block.id !== id && startsAppendix(block));
  const publicMessage = `content: update result "${paper.title}"`;

  const heading = (): ResultHeading => ({
    level,
    title: title.replace(/\s+/g, ' ').trim(),
    ...(numbered ? {} : { starred: true }),
    ...(numbered && label.trim() ? { label: label.trim() } : {}),
    ...(level === 'section' && appendix && !appendixAt ? { appendix: true } : {}),
  });

  const chooseLevel = (next: HeadingLevel) => {
    setLevel(next);
    // LaTeX's article does not number \paragraph; numbering it needs a deeper secnumdepth.
    if (isNew) setNumbered(next !== 'paragraph');
  };

  // One save, delete or hide at a time.
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

  const save = () => {
    const next = heading();
    if (!next.title) return setProblem(() => t('请填写标题'));
    if (next.title.length > MAX_TITLE) return setProblem(() => t('标题最长 {n} 字', { n: MAX_TITLE }));
    if (next.label && !LABEL.test(next.label)) return setProblem(() => t('引用名只能用字母、数字和 : _ - .'));
    void run(async () => {
      const block: ResultBlock = { id, kind: 'heading', heading: next };
      const anchor = afterBlockId === undefined ? -1 : paper.blocks.findIndex((item) => item.id === afterBlockId);
      const putBlock: ResultsOp = { kind: 'putBlock', paperId: paper.id, block, ...(isNew && anchor >= 0 ? { at: anchor + 1 } : {}) };
      const draft = applyResultsOp([paper], putBlock)[0];
      const rebuilt = await rebuildWith(draft, await loadAttachments(paper, readFile));
      const failed = rebuilt.failed;
      if (failed) {
        setProblem(() => describeFailure(draft.blocks, failed));
        return;
      }
      await onSave(
        withOutputs(paper.id, [putBlock], rebuilt),
        rebuilt.writes,
        rebuilt.deletes,
        resultsCommitMessage(isNew ? 'add heading to' : 'update heading in', paper.title),
        publicMessage,
      );
      onClose();
    });
  };

  const remove = () => {
    if (!existing || !window.confirm(t('确定删除小节标题"{title}"吗？', { title: headingText(existing.heading?.title ?? '') }))) return;
    void run(async () => {
      const draft: ResultPaper = { ...paper, blocks: paper.blocks.filter((item) => item.id !== id) };
      const rebuilt = await rebuildWith(draft, await loadAttachments(paper, readFile));
      const failed = rebuilt.failed;
      if (failed) {
        setProblem(() => t('{problem}。先修好再删除。', { problem: describeFailure(draft.blocks, failed, 'delete') }));
        return;
      }
      await onSave(
        withOutputs(paper.id, [{ kind: 'deleteBlock', paperId: paper.id, blockId: id }], rebuilt),
        rebuilt.writes,
        rebuilt.deletes,
        resultsCommitMessage('delete heading in', paper.title),
        publicMessage,
      );
      onClose();
    });
  };

  const toggleHidden = () => {
    if (!existing) return;
    if (existing.hidden && !paper.hidden && !window.confirm(t('这篇论文已公开，取消隐藏后这个小节标题会发布到网站。确定吗？'))) return;
    void run(async () => {
      await onSave(
        { kind: 'setBlockHidden', paperId: paper.id, blockId: id, hidden: !existing.hidden },
        [],
        [],
        resultsCommitMessage(existing.hidden ? 'unhide heading in' : 'hide heading in', paper.title),
        publicMessage,
      );
      onClose();
    });
  };

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-2">
      {existing && (
        <>
          <button type="button" disabled={saving} onClick={remove} className={BUTTON_SECONDARY}>
            <Trash2 size={14} />
            {t('删除')}
          </button>
          <button type="button" disabled={saving} onClick={toggleHidden} className={BUTTON_SECONDARY}>
            {existing.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
            {existing.hidden ? t('取消隐藏') : t('隐藏')}
          </button>
        </>
      )}
      <div className="ml-auto flex gap-2">
        <button type="button" disabled={saving} onClick={onClose} className={BUTTON_SECONDARY}>
          {t('取消')}
        </button>
        <button type="button" disabled={saving} onClick={save} className={BUTTON_PRIMARY}>
          {saving ? t('编译并保存中…') : t('保存')}
        </button>
      </div>
    </div>
  );

  return (
    <Modal title={isNew ? t('添加小节标题') : t('编辑小节标题')} onClose={() => !saving && onClose()} footer={footer}>
      <div className="space-y-4 text-sm">
        <fieldset>
          <legend className="mb-1 font-medium text-gray-700">{t('等级')}</legend>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((item) => (
              <label
                key={item.level}
                className={`cursor-pointer rounded-md border px-3 py-1.5 font-mono text-xs ${level === item.level ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                <input type="radio" name="heading-level" value={item.level} checked={level === item.level} onChange={() => chooseLevel(item.level)} className="sr-only" />
                \{item.text}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-1 block font-medium text-gray-700">{t('标题')}</span>
          <input
            type="text"
            value={title}
            maxLength={MAX_TITLE}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save();
            }}
            placeholder={t('例如：Experiments')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none"
          />
          <span className="mt-1 block text-xs text-gray-400">{t('按 LaTeX 原样导出；网页上 \\& \\% \\_ 这类转义会显示成符号。')}</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={numbered} onChange={(event) => setNumbered(event.target.checked)} />
          <span className="text-gray-700">{t('编号')}</span>
          <span className="text-xs text-gray-400">{t('不编号就是 \\{level}*；编号以 LaTeX 实际给出的为准', { level })}</span>
        </label>
        {numbered && (
          <label className="block">
            <span className="mb-1 block font-medium text-gray-700">
              {t('引用名')} <span className="font-normal text-gray-400">{t('（可选，块里用 \\ref 引用）')}</span>
            </span>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t('例如：sec:experiments')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono focus:border-purple-500 focus:outline-none"
            />
          </label>
        )}
        {level === 'section' && (
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={appendix && !appendixAt} disabled={appendixAt !== undefined} onChange={(event) => setAppendix(event.target.checked)} className="mt-0.5" />
            <span className={appendixAt ? 'text-gray-400' : 'text-gray-700'}>
              {t('附录从这里开始')}
              <span className="block text-xs text-gray-400">
                {appendixAt
                  ? t('附录已经从"{title}"开始', { title: headingText(appendixAt.heading?.title ?? '') })
                  : t('这里写入 \\appendix：这一节和后面的节编号为 A、B…，小节为 A.1、A.2…')}
              </span>
            </span>
          </label>
        )}
        {problem && (
          <p role="alert" className="text-sm text-red-600">
            {problem}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default HeadingEditor;

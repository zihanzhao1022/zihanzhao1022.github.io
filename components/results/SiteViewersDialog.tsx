import React, { useState } from 'react';
import { X } from 'lucide-react';

const LOGIN = /^@?[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;

interface Props {
  names: string[];
  onSave: (names: string[]) => Promise<void>;
  onClose: () => void;
}

/** The owner's list of GitHub users who may view every paper of the results pages. */
const SiteViewersDialog: React.FC<Props> = ({ names, onSave, onClose }) => {
  const [text, setText] = useState(names.join('\n'));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const save = async () => {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const wrong = lines.find((line) => !LOGIN.test(line));
    if (wrong) {
      setProblem(`"${wrong}" 不是 GitHub 用户名：每行一个，只能包含字母、数字和连字符`);
      return;
    }
    const unique = lines
      .map((line) => line.replace(/^@/, ''))
      .filter((name, index, all) => all.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index);
    setSaving(true);
    setProblem(null);
    try {
      await onSave(unique);
      onClose();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="可以查看全部论文的人" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">可以查看全部论文的人</h2>
          <button type="button" onClick={onClose} aria-label="关闭" className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-sm text-gray-600">
          每行一个 GitHub 用户名。他们用 GitHub 登录后能看到这里所有的论文（只看到可见块的结果，看不到 LaTeX 代码），包括以后新建的。只想共享某一篇，就在那篇的"编辑论文信息"里填。
        </p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          placeholder={'alice\nbob'}
          className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-purple-500 focus:outline-none"
        />
        {problem && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {problem}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SiteViewersDialog;

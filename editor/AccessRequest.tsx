import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AccessDenied, requestAccess } from './auth';

/** Shown to someone whose GitHub account has no access yet: they can ask the owner, with a short note. */
const AccessRequest: React.FC<{ denied: AccessDenied; onClose: () => void }> = ({ denied, onClose }) => {
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  const send = async () => {
    setState('sending');
    setProblem(null);
    try {
      await requestAccess(denied.token, note);
      setState('sent');
    } catch (error) {
      setProblem(error instanceof Error ? error.message : '申请没有发出去，请稍后重试');
      setState('idle');
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="申请访问" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">申请访问论文结果</h2>
          <button type="button" onClick={onClose} aria-label="关闭" className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        {state === 'sent' ? (
          <>
            <p className="text-sm text-gray-700">申请已发给作者。作者同意后，重新点一次登录就能看到论文结果。</p>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={onClose} className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700">
                好的
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600">
              GitHub 账号 <span className="font-medium text-gray-900">@{denied.login}</span> 还没有访问权限。可以向作者申请，附一句话说明你是谁：
            </p>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={300}
              rows={3}
              placeholder="例如：我是这篇论文的合作者 ××"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
            />
            {problem && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {problem}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                取消
              </button>
              <button
                type="button"
                disabled={state === 'sending'}
                onClick={() => void send()}
                className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
              >
                {state === 'sending' ? '发送中…' : '发送申请'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AccessRequest;

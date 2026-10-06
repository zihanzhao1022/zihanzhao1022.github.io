import React from 'react';
import { ExternalLink, Loader2, LogOut } from 'lucide-react';
import { Session } from '../../lib/session';
import { DeployStatus } from '../backend';

export type LoadState = 'loading' | 'ready' | 'error';

const Status: React.FC<{ loadState: LoadState; deploy: DeployStatus | null }> = ({ loadState, deploy }) => {
  if (loadState === 'loading') {
    return (
      <span className="flex items-center gap-1 text-gray-400">
        <Loader2 size={12} className="animate-spin" />
        正在读取最新内容…
      </span>
    );
  }
  if (loadState === 'error') return <span className="text-red-400">读取最新内容失败，请刷新页面重试</span>;
  if (!deploy) return null;
  if (deploy.state === 'pending') {
    return (
      <span className="flex items-center gap-1 text-amber-300">
        <Loader2 size={12} className="animate-spin" />
        已保存，正在部署…
      </span>
    );
  }
  if (deploy.state === 'success') return <span className="text-emerald-400">已上线</span>;
  const message = deploy.state === 'failure' ? '部署失败' : '部署状态未知';
  return deploy.url ? (
    <a href={deploy.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-red-400 hover:underline">
      {message}，查看日志
      <ExternalLink size={12} />
    </a>
  ) : (
    <span className="text-red-400">{message}</span>
  );
};

interface Props {
  session: Session;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  loadState: LoadState;
  deploy: DeployStatus | null;
  onLogout: () => void;
}

export const AdminBar: React.FC<Props> = ({ session, enabled, onToggle, loadState, deploy, onLogout }) => (
  <div className="bg-gray-900 text-xs text-gray-300">
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="flex items-center gap-2">
        {session.avatarUrl ? (
          <img src={session.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
        ) : (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-[10px] font-semibold text-white">
            {session.login.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="font-medium text-white">{session.login}</span>
      </span>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={`relative w-8 h-4 rounded-full transition-colors ${enabled ? 'bg-purple-500' : 'bg-gray-600'}`}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${enabled ? 'left-[18px]' : 'left-0.5'}`}
          />
        </button>
        编辑模式
      </label>
      <span className="ml-auto">
        <Status loadState={loadState} deploy={deploy} />
      </span>
      <button type="button" onClick={onLogout} className="flex items-center gap-1 text-gray-400 hover:text-white">
        <LogOut size={12} />
        退出
      </button>
    </div>
  </div>
);

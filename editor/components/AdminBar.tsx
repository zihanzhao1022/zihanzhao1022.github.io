import React, { useState } from 'react';
import { ExternalLink, Loader2, LogOut, Users } from 'lucide-react';
import { PresenceValue, avatarUrl } from '../../components/presence';
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

/** "just now", "5 分钟前", "3 小时前", "2 天前". */
function ago(at: number, now = Date.now()): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} 小时前`;
  return `${Math.floor(minutes / (24 * 60))} 天前`;
}

/** Who is signed in right now and who came by this week; only the owner gets these lists. */
const Online: React.FC<{ presence: PresenceValue; paperOf: (id: string) => { title: string; slug: string } | undefined }> = ({ presence, paperOf }) => {
  const [open, setOpen] = useState(false);
  const others = (presence.online ?? []).filter((user) => user.login !== presence.me?.login);
  const recent = (presence.recent ?? []).filter((visit) => visit.login !== presence.me?.login);
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex items-center gap-1 text-gray-300 hover:text-white">
        <Users size={12} />
        在线 {others.length}
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-[60] w-72 rounded-lg bg-white p-3 text-xs text-gray-700 shadow-lg ring-1 ring-gray-200">
          <p className="mb-2 font-semibold text-gray-900">现在在线</p>
          {others.length === 0 && <p className="mb-2 text-gray-400">除了你没有别人</p>}
          <ul className="mb-3 space-y-2">
            {others.map((user) => (
              <li key={user.login} className="flex items-start gap-2">
                <img src={avatarUrl(user.id)} alt="" className="mt-0.5 w-5 h-5 rounded-full bg-gray-200" />
                <span>
                  <span className="font-medium">@{user.login}</span>
                  <span className="block text-gray-500">
                    {user.papers.length === 0
                      ? '在网站上'
                      : user.papers.map((id, index) => {
                          const paper = paperOf(id);
                          return (
                            <React.Fragment key={id}>
                              {index > 0 && '、'}
                              正在看{' '}
                              {paper ? (
                                <a href={`#/results/${paper.slug}`} className="text-purple-700 hover:underline">
                                  {paper.title}
                                </a>
                              ) : (
                                '一篇论文'
                              )}
                            </React.Fragment>
                          );
                        })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mb-2 font-semibold text-gray-900">最近 7 天来过</p>
          {recent.length === 0 && <p className="text-gray-400">还没有</p>}
          <ul className="space-y-1.5">
            {recent.map((visit) => (
              <li key={visit.login} className="flex items-center gap-2">
                <img src={avatarUrl(visit.id)} alt="" className="w-4 h-4 rounded-full bg-gray-200" />
                <span className="font-medium">@{visit.login}</span>
                <span className="ml-auto text-gray-400">{ago(visit.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
};

interface Props {
  session: Session;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  loadState: LoadState;
  deploy: DeployStatus | null;
  onLogout: () => void;
  presence?: PresenceValue | null;
  paperOf?: (id: string) => { title: string; slug: string } | undefined;
}

export const AdminBar: React.FC<Props> = ({ session, enabled, onToggle, loadState, deploy, onLogout, presence, paperOf = () => undefined }) => (
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
      {presence?.online && <Online presence={presence} paperOf={paperOf} />}
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

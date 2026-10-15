import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useT } from '../lib/phrases/app';
import { Account } from './accounts';

/**
 * After the first sign-in: choose the repository Galley keeps the account's papers in. The real service sends
 * the account to GitHub to install the Galley app on that repository; the prototype only remembers the choice.
 */
const Setup: React.FC<{ account: Account; onConnect: (repo: string) => void }> = ({ account, onConnect }) => {
  const t = useT();
  const repos = [
    { name: `${account.login}/results`, note: t('新建一个空仓库，推荐') },
    { name: `${account.login}/paper-drafts`, note: t('已有的私有仓库') },
    { name: `${account.login}/notes`, note: t('已有的私有仓库') },
  ];
  const [chosen, setChosen] = useState(repos[0].name);
  return (
    <div className="mx-auto max-w-xl py-14">
      <h1 className="font-serif-display text-3xl text-gray-900">{t('选一个仓库存放你的论文结果')}</h1>
      <p className="mt-4 leading-relaxed text-gray-600">
        {t('Galley 把论文结果存在你选的 GitHub 私有仓库里：一个 results.json 和编译好的 PDF。它只能读写这一个仓库，你的其他仓库它看不到。')}
      </p>
      <fieldset className="mt-8 space-y-2">
        <legend className="sr-only">{t('仓库')}</legend>
        {repos.map((repo) => (
          <label
            key={repo.name}
            className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 ${chosen === repo.name ? 'border-violet-500 bg-violet-50/50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <input type="radio" name="repo" value={repo.name} checked={chosen === repo.name} onChange={() => setChosen(repo.name)} className="accent-violet-700" />
            <Lock size={14} className="text-gray-400" />
            <span className="flex-1 font-medium text-gray-900">{repo.name}</span>
            <span className="text-sm text-gray-500">{repo.note}</span>
          </label>
        ))}
      </fieldset>
      <button type="button" onClick={() => onConnect(chosen)} className="mt-8 rounded-md bg-violet-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-800">
        {t('连接这个仓库')}
      </button>
      <p className="mt-4 text-sm text-gray-500">{t('正式版会跳到 GitHub，让你确认把 Galley 装到这个仓库上；原型里点一下就算连接好了。')}</p>
    </div>
  );
};

export default Setup;

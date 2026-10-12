import React from 'react';
import { Lock } from 'lucide-react';
import { useT } from '../lib/phrases/site';
import { useEditMode } from './EditMode';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const { canLogin, loggedIn, login } = useEditMode();
  const t = useT();
  return (
    <footer className="w-full bg-gray-900 text-gray-400 py-6 text-center text-xs mt-20">
      <p>
        {t('© {year} Zihan ZHAO 版权所有。基于 React 构建，托管于 GitHub Pages。', { year: currentYear })}
        {canLogin && !loggedIn && (
          <button
            type="button"
            onClick={login}
            title={t('管理员登录')}
            aria-label={t('管理员登录')}
            className="ml-2 align-middle text-white/90 hover:text-white transition-colors"
          >
            <Lock size={11} />
          </button>
        )}
      </p>
    </footer>
  );
};

export default Footer;

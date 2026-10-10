import React from 'react';
import { Lock } from 'lucide-react';
import { useEditMode } from './EditMode';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const { canLogin, loggedIn, login } = useEditMode();
  return (
    <footer className="w-full bg-gray-900 text-gray-400 py-6 text-center text-xs mt-20">
      <p>
        © Copyright {currentYear} Zihan ZHAO. Powered by React. Hosted by GitHub Pages.
        {canLogin && !loggedIn && (
          <button
            type="button"
            onClick={login}
            title="管理员登录"
            aria-label="管理员登录"
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

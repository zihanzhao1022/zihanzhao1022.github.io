import React from 'react';
import { Github } from 'lucide-react';
import { useEditMode } from '../EditMode';

/** Shown on a results address to someone signed out: they may have been sent a link to a paper shared with them. */
const LoginPrompt: React.FC = () => {
  const { canLogin, login } = useEditMode();
  return (
    <div className="animate-fade-in py-20 text-center">
      <p className="text-gray-700 mb-1">Sign in with GitHub to see the results shared with you.</p>
      <p className="text-sm text-gray-500 mb-6">登录 GitHub 后查看作者共享给你的论文结果。</p>
      {canLogin && (
        <button
          type="button"
          onClick={login}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-sm text-white hover:bg-gray-700"
        >
          <Github size={16} />
          Sign in with GitHub
        </button>
      )}
    </div>
  );
};

export default LoginPrompt;

import React from 'react';
import { LANGS, setLang, useLang } from '../lib/i18n';

/** Switches the interface between Chinese, Japanese and English; the choice is remembered in this browser. */
const LangSwitch: React.FC<{ dark?: boolean; className?: string }> = ({ dark = false, className = '' }) => {
  const current = useLang();
  return (
    <div role="group" aria-label="Language / 语言 / 言語" className={`inline-flex items-center rounded-full border text-xs ${dark ? 'border-white/20' : 'border-gray-200'} ${className}`}>
      {LANGS.map(({ lang, label, name }) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          title={name}
          aria-pressed={current === lang}
          onClick={() => setLang(lang)}
          className={`px-2 py-0.5 first:rounded-l-full last:rounded-r-full ${
            current === lang ? (dark ? 'bg-white/20 text-white' : 'bg-gray-900 text-white') : dark ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default LangSwitch;

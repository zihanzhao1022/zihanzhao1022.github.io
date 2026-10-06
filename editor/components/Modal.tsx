import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export const BUTTON_PRIMARY =
  'inline-flex items-center gap-1 px-4 py-2 rounded-md bg-gray-900 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50';
export const BUTTON_SECONDARY =
  'inline-flex items-center gap-1 px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';

interface ModalProps {
  title: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/** Full screen on phones, a centred dialog elsewhere. Escape and the backdrop call onClose. */
export const Modal: React.FC<ModalProps> = ({ title, onClose, footer, children }) => {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center bg-black/40 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close.current();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex flex-col w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-xl bg-white sm:rounded-xl shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={() => close.current()}
            aria-label="关闭"
            className="p-1 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100">{footer}</div>
      </div>
    </div>
  );
};

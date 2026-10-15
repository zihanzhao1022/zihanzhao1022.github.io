import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** What the button is called for screen readers and in its tooltip. */
  label: string;
  trigger: React.ReactNode;
  className?: string;
  /** Which edge of the button the menu lines up with. */
  align?: 'left' | 'right';
  children: (close: () => void) => React.ReactNode;
}

const GAP = 4;
const EDGE = 8;

/**
 * A small menu by its button: under it, or over it when there is no room below. It is drawn over the whole page,
 * so a scrolling sidebar or the next row never covers it; a click outside, Esc, scrolling or resizing closes it.
 */
const Menu: React.FC<Props> = ({ label, trigger, className = '', align = 'right', children }) => {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !button.current || !panel.current) {
      setPlace(null);
      return;
    }
    const at = button.current.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = panel.current;
    const up = at.bottom + GAP + height > window.innerHeight - EDGE && at.top - GAP - height > EDGE;
    const left = Math.max(EDGE, Math.min(align === 'right' ? at.right - width : at.left, window.innerWidth - width - EDGE));
    setPlace({ top: up ? at.top - GAP - height : at.bottom + GAP, left, up });
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!button.current?.contains(target) && !panel.current?.contains(target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      button.current?.focus();
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={className}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
            style={place ? { top: place.top, left: place.left } : { top: 0, left: 0, visibility: 'hidden' }}
            className={`galley-pop fixed z-[60] min-w-[12rem] max-w-[18rem] overflow-hidden rounded-xl border border-black/[0.06] bg-white/90 py-1 text-sm shadow-[0_12px_32px_-12px_rgba(0,0,0,0.28),0_2px_6px_-2px_rgba(0,0,0,0.08)] backdrop-blur-xl backdrop-saturate-150 ${
              place?.up ? (align === 'right' ? 'origin-bottom-right' : 'origin-bottom-left') : align === 'right' ? 'origin-top-right' : 'origin-top-left'
            }`}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
};

/** A row of a menu. */
export const MenuItem: React.FC<{ onSelect: () => void; children: React.ReactNode; danger?: boolean; checked?: boolean }> = ({ onSelect, children, danger = false, checked }) => (
  <button
    type="button"
    role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
    aria-checked={checked}
    onClick={onSelect}
    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-100 hover:bg-black/[0.05] ${danger ? 'text-red-600' : 'text-gray-800'}`}
  >
    {children}
  </button>
);

export const MenuLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="px-3 pb-1 pt-2 text-xs text-gray-400">{children}</p>;

export default Menu;

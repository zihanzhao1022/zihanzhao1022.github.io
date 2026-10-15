import React from 'react';

/**
 * The product's name, in one place: a lemma is a smaller result proved on the way to a theorem, as experiment
 * results are on the way to a paper. Phrases name it through `{name}`.
 */
export const NAME = 'Lemma';

/** A page of text ending in the tombstone (∎) LaTeX sets at the end of a proof. */
export const Mark: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <rect x="4.5" y="2.5" width="15" height="19" rx="2" fill="white" stroke="#18181b" strokeWidth="1.5" />
    <path d="M8 7.5h8M8 11h8M8 14.5h3.5" stroke="#a1a1aa" strokeWidth="1.4" strokeLinecap="round" />
    <rect x="13.2" y="12.9" width="3.2" height="3.2" rx="0.3" fill="#6d28d9" />
  </svg>
);

/** The name set like a theorem's head in a LaTeX paper: bold upright serif. */
export const Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`flex items-center gap-2 ${className}`}>
    <Mark />
    <span className="font-serif-display text-xl font-bold tracking-tight">{NAME}</span>
  </span>
);

/** The QED tombstone that ends a headline, about as tall as a lowercase letter and on the baseline, as LaTeX sets it. */
export const Tombstone: React.FC = () => (
  <span aria-hidden="true" className="ml-[0.12em] inline-block h-[0.4em] w-[0.4em] rounded-[0.03em] bg-violet-700 align-baseline" />
);

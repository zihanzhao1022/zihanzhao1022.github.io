import React from 'react';

/**
 * The product's name, in one place: a lemma is a smaller result proved on the way to a theorem, as experiment
 * results are on the way to a paper. Phrases name it through `{name}`.
 */
export const NAME = 'Lemma';

const SERIF = "'Source Serif 4', 'Source Serif Pro', Georgia, serif";

/** The app's mark: an L with a small E raised into its corner, the way the LaTeX logo tucks its A in after the L. */
export const Mark: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <rect x="1" y="1" width="62" height="62" rx="15" fill="white" stroke="#e4e4e7" strokeWidth="2" />
    <text x="14" y="46" fontFamily={SERIF} fontWeight="700" fontSize="36" fill="#1d1d1f">
      L
    </text>
    <text x="29" y="35" fontFamily={SERIF} fontWeight="700" fontSize="24" fill="#6d28d9">
      E
    </text>
  </svg>
);

/** The name set like the TeX and LaTeX logos, its letters stepping off the baseline (see .lemma-wordmark). */
export const Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`flex items-center gap-2 ${className}`}>
    <Mark />
    <span className="lemma-wordmark text-xl" aria-hidden="true">
      <span>L</span>
      <span className="up e">E</span>
      <span className="rise">M</span>
      <span className="down">M</span>
      <span className="up a">A</span>
    </span>
  </span>
);

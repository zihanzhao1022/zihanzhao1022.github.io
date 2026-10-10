import React from 'react';
import { headingText } from '../../lib/headings';
import { ResultBlock } from '../../types';
import { destinationId } from './pdfDestinations';

const TAG = { section: 'h2', subsection: 'h3', subsubsection: 'h4', paragraph: 'h5' } as const;
const SIZE = { section: 'text-2xl', subsection: 'text-xl', subsubsection: 'text-lg', paragraph: 'text-base' } as const;

/** A section heading as HTML, numbered as LaTeX numbered it; \ref links from the blocks jump here. */
const HeadingView: React.FC<{ paperId: string; block: ResultBlock }> = ({ paperId, block }) => {
  const heading = block.heading;
  if (!heading) return null;
  const Tag = TAG[heading.level];
  const { number, anchor } = block.numbering ?? {};
  return (
    <Tag
      id={anchor ? destinationId(paperId, anchor) : undefined}
      tabIndex={anchor ? -1 : undefined}
      className={`${SIZE[heading.level]} font-medium text-gray-900 scroll-mt-24 rounded outline-none focus:bg-purple-50`}
    >
      {number && <span className="mr-3 tabular-nums">{number}</span>}
      {headingText(heading.title)}
    </Tag>
  );
};

export default HeadingView;

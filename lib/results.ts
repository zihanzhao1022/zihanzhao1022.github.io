import { ResultBlock, ResultPaper } from '../types';

/** The paper whose page is #/results/<slug>. */
export const findPaper = (papers: ResultPaper[], slug: string | undefined): ResultPaper | undefined =>
  slug === undefined ? undefined : papers.find((paper) => paper.slug === slug);

/** Route of a paper's page. */
export const paperPath = (paper: Pick<ResultPaper, 'slug'>): string => `/results/${paper.slug}`;

/** Published files (results/<id>/...) are served from the site's public/ folder. */
export const publicFilePath = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

/** Blocks to show: everything while editing (hidden ones get marked), only visible ones otherwise. */
export const shownBlocks = (blocks: ResultBlock[], editing: boolean): ResultBlock[] =>
  editing ? blocks : blocks.filter((block) => !block.hidden);

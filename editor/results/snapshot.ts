import { ResultPaper } from '../../types';

/** Where the site keeps the published snapshot. */
export const SNAPSHOT_PATH = 'content/results.json';
/** Published files live under public/ in the site's repository, at the same relative path as in the private one. */
export const PUBLIC_FILES_PREFIX = 'public/results/';

export const publicPath = (path: string): string => `public/${path}`;

export const hasPublished = (papers: ResultPaper[]): boolean => papers.some((paper) => !paper.hidden);

/**
 * What visitors get: published papers with their visible, compiled blocks. No LaTeX source, preamble or
 * attachments (comments in a source may hold unpublished numbers), and none of the compile bookkeeping.
 */
export function buildSnapshot(papers: ResultPaper[]): ResultPaper[] {
  return papers
    .filter((paper) => !paper.hidden)
    .map((paper) => ({
      id: paper.id,
      slug: paper.slug,
      title: paper.title,
      authors: paper.authors,
      ...(paper.venue === undefined ? {} : { venue: paper.venue }),
      ...(paper.year === undefined ? {} : { year: paper.year }),
      ...(paper.summary === undefined ? {} : { summary: paper.summary }),
      blocks: paper.blocks
        .filter((block) => !block.hidden && block.output)
        .map((block) => ({
          id: block.id,
          kind: block.kind,
          output: { pdf: block.output!.pdf, width: block.output!.width, height: block.output!.height },
        })),
    }));
}

export const snapshotText = (papers: ResultPaper[]): string => `${JSON.stringify(buildSnapshot(papers), null, 2)}\n`;

/** Private paths (results/...) of every file the snapshot shows. */
export const snapshotFiles = (snapshot: ResultPaper[]): string[] =>
  snapshot.flatMap((paper) => paper.blocks.map((block) => block.output!.pdf));

export interface PublicSyncPlan {
  /** New text of the snapshot file, or null when it is unchanged. */
  json: string | null;
  /** Private paths to copy into public/. */
  add: string[];
  /** Public paths to delete. */
  remove: string[];
}

/** What the site's repository needs so that it shows exactly the published papers. */
export function planPublicSync(papers: ResultPaper[], currentJson: string | null, existingFiles: string[]): PublicSyncPlan {
  const json = snapshotText(papers);
  const wanted = snapshotFiles(buildSnapshot(papers));
  const existing = new Set(existingFiles);
  const wantedPublic = new Set(wanted.map(publicPath));
  return {
    json: json === currentJson ? null : json,
    add: wanted.filter((path) => !existing.has(publicPath(path))),
    remove: existingFiles.filter((path) => !wantedPublic.has(path)),
  };
}

export const isEmptyPlan = (plan: PublicSyncPlan): boolean =>
  plan.json === null && plan.add.length === 0 && plan.remove.length === 0;

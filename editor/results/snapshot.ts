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
 * A paper with collaborators' edits waiting for review keeps the version the site shows now (`current`);
 * if the site does not show it, it stays off until the owner publishes the edits.
 */
export function buildSnapshot(papers: ResultPaper[], current: ResultPaper[] = []): ResultPaper[] {
  return papers
    .filter((paper) => !paper.hidden)
    .flatMap((paper): ResultPaper[] => {
      if (!paper.pendingReview?.length) return [publicView(paper)];
      const shown = current.find((item) => item.id === paper.id);
      return shown ? [shown] : [];
    });
}

/** A published paper as visitors get it. */
export function publicView(paper: ResultPaper): ResultPaper {
  return {
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
  };
}

export const snapshotText = (papers: ResultPaper[], current: ResultPaper[] = []): string =>
  `${JSON.stringify(buildSnapshot(papers, current), null, 2)}\n`;

/** The papers in the site's snapshot file; an unreadable or missing file shows none. */
export function parseSnapshot(text: string | null): ResultPaper[] {
  try {
    const papers: unknown = text === null ? [] : JSON.parse(text);
    return Array.isArray(papers) ? (papers as ResultPaper[]) : [];
  } catch {
    return [];
  }
}

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
  const snapshot = buildSnapshot(papers, parseSnapshot(currentJson));
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  const kept = new Set(papers.filter((paper) => paper.pendingReview?.length).map((paper) => paper.id));
  const existing = new Set(existingFiles);
  const wantedPublic = new Set(snapshotFiles(snapshot).map(publicPath));
  return {
    json: json === currentJson ? null : json,
    // Only papers built from the private list bring files; a paper kept as the site shows it has them there.
    add: snapshotFiles(snapshot.filter((paper) => !kept.has(paper.id))).filter((path) => !existing.has(publicPath(path))),
    remove: existingFiles.filter((path) => !wantedPublic.has(path)),
  };
}

export const isEmptyPlan = (plan: PublicSyncPlan): boolean =>
  plan.json === null && plan.add.length === 0 && plan.remove.length === 0;

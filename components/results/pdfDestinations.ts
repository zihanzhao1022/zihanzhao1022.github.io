interface Viewport {
  width: number;
  height: number;
  viewBox: number[];
  convertToViewportPoint: (x: number, y: number) => number[];
}

/** Coordinates of a PDF destination in the displayed page, including cropped TeX pages. */
export function destinationPoint(destination: unknown[], viewport: Viewport): { left: number; top: number } {
  const mode = (destination[1] as { name?: string } | undefined)?.name;
  const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  let x = viewport.viewBox[0];
  let y = viewport.viewBox[3];
  if (mode === 'XYZ') {
    x = number(destination[2], x);
    y = number(destination[3], y);
  } else if (mode === 'FitH' || mode === 'FitBH') y = number(destination[2], y);
  else if (mode === 'FitV' || mode === 'FitBV') x = number(destination[2], x);
  else if (mode === 'FitR') {
    x = number(destination[2], x);
    y = number(destination[5], y);
  }
  const [left, top] = viewport.convertToViewportPoint(x, y);
  return { left: Math.max(0, Math.min(viewport.width, left)), top: Math.max(0, Math.min(viewport.height, top)) };
}

export const referencesId = (scope: string): string => `results-references-${encodeURIComponent(scope)}`;
/** A place on the page that \ref links from any block can jump to: a PDF destination. */
export const destinationId = (scope: string, name: string): string => `results-destination-${encodeURIComponent(JSON.stringify([scope, name]))}`;

/**
 * Whether a PDF's named destination becomes a jump target on the page: not the ones every block has (the
 * document start and its page), and not citations, which go to the bibliography (navigateCitation).
 */
export const isPageDestination = (name: string): boolean => name !== 'Doc-Start' && !/^page\.\d+$/.test(name) && !name.startsWith('cite.');
export const citationId = (scope: string, destination: string): string => `results-citation-${encodeURIComponent(JSON.stringify([scope, destination]))}`;

function reveal(target: HTMLElement): void {
  target.scrollIntoView({ block: 'start', behavior: 'auto' });
  target.focus({ preventScroll: true });
}

/** Keep the site's hash route intact; citation targets may be in a different PDF still loading. */
export function navigateCitation(scope: string, destination: string): void {
  const target = document.getElementById(citationId(scope, destination));
  if (target) {
    const references = document.getElementById(referencesId(scope));
    if (references) delete references.dataset.pendingCitation;
    reveal(target);
    return;
  }
  const references = document.getElementById(referencesId(scope));
  if (references) {
    references.dataset.pendingCitation = destination;
    references.scrollIntoView({ block: 'start' });
  }
}

/**
 * Jumps to a destination another block or a heading of the page holds: a \ref to a figure in another block
 * leads nowhere inside its own PDF. Does nothing when the page has no such place (e.g. a hidden block).
 */
export function navigateDestination(scope: string, name: string): void {
  const target = document.getElementById(destinationId(scope, name));
  if (target) reveal(target);
}

/**
 * The destination hyperref gives each heading a text block typesets, numbered or not ("section.2",
 * "appendix.A", "section*.3" for \paragraph and starred ones): one per heading, in order from the top.
 */
export const HEADING_DESTINATION = /^(?:section|subsection|subsubsection|paragraph|subparagraph|appendix)\*?\./;

/**
 * Jumps to a block's n-th heading in its PDF (see HEADING_DESTINATION). False when the block does not show
 * the `of` headings the outline expects (not drawn yet, or a heading it could not read in the source).
 */
export function goToHeading(blockId: string, index: number, of: number): boolean {
  const block = document.querySelector(`[data-result-block-id="${CSS.escape(blockId)}"]`);
  const marks = [...(block?.querySelectorAll<HTMLElement>('.resultsPdfHeading') ?? [])].sort(
    (a, b) => parseFloat(a.style.top) - parseFloat(b.style.top),
  );
  if (marks.length !== of || !marks[index]) return false;
  marks[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

export function finishCitationNavigation(scope: string): void {
  const references = document.getElementById(referencesId(scope));
  const destination = references?.dataset.pendingCitation;
  if (!references || !destination) return;
  delete references.dataset.pendingCitation;
  const target = document.getElementById(citationId(scope, destination));
  if (target) reveal(target);
}

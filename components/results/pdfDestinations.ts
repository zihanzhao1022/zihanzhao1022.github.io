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

export function finishCitationNavigation(scope: string): void {
  const references = document.getElementById(referencesId(scope));
  const destination = references?.dataset.pendingCitation;
  if (!references || !destination) return;
  delete references.dataset.pendingCitation;
  const target = document.getElementById(citationId(scope, destination));
  if (target) reveal(target);
}

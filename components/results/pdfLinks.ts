/** The destination forms returned by PDF.js for GoTo annotations. */
export type PdfDestination = string | unknown[];

/** PDF.js 6 exposes point conversion; coordinates include the page's scale and rotation. */
export interface PdfLinkViewport {
  width: number;
  height: number;
  convertToViewportPoint: (x: number, y: number) => number[];
}

interface LinkBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
}

export type PdfLink = LinkBounds & (
  | { url: string; destination?: never }
  | { url?: never; destination: PdfDestination }
);

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (['https:', 'http:', 'mailto:'].includes(url.protocol)) return url.href;
  } catch { /* An invalid or relative address cannot be opened by this layer. */ }
  return undefined;
}

/** Extract only links; PDF scripts, forms, attachments and named actions are never executed. */
export function getPdfLinks(annotations: unknown[], viewport: PdfLinkViewport): PdfLink[] {
  const links: PdfLink[] = [];
  for (const value of annotations) {
    if (!value || typeof value !== 'object') continue;
    const annotation = value as Record<string, unknown>;
    if (annotation.subtype !== 'Link') continue;
    // PDF annotation flags: Hidden (2), NoView (32).
    if (typeof annotation.annotationFlags === 'number' && (annotation.annotationFlags & 34)) continue;
    const rect = annotation.rect;
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)) continue;
    const first = viewport.convertToViewportPoint(rect[0], rect[1]);
    const last = viewport.convertToViewportPoint(rect[2], rect[3]);
    if (![...first, ...last].every(Number.isFinite)) continue;
    const bounds = {
      left: Math.min(first[0], last[0]),
      top: Math.min(first[1], last[1]),
      width: Math.abs(last[0] - first[0]),
      height: Math.abs(last[1] - first[1]),
    };
    if (!(bounds.width > 0 && bounds.height > 0)) continue;
    const url = safeUrl(annotation.url);
    if (url) {
      links.push({ ...bounds, url, label: url });
      continue;
    }
    const destination = annotation.dest;
    if (typeof destination === 'string' && destination.length > 0) {
      const label = destination.startsWith('cite.')
        ? `查看参考文献 ${destination.slice(5)}`
        : `跳转到 ${destination}`;
      links.push({ ...bounds, destination, label });
    } else if (Array.isArray(destination) && destination.length > 0) {
      links.push({ ...bounds, destination, label: '跳转到文档中的引用位置' });
    }
  }
  return links;
}

/** Transparent, keyboard-accessible anchors placed above the PDF's selectable text layer. */
export function renderPdfLinks({ annotations, viewport, onDestination }: {
  annotations: unknown[];
  viewport: PdfLinkViewport;
  onDestination?: (destination: PdfDestination) => void;
}): HTMLDivElement {
  const layer = document.createElement('div');
  layer.className = 'resultsPdfLinks';
  layer.style.width = `${viewport.width}px`;
  layer.style.height = `${viewport.height}px`;
  for (const link of getPdfLinks(annotations, viewport)) {
    if (!link.url && !onDestination) continue;
    const anchor = document.createElement('a');
    anchor.className = 'resultsPdfLink';
    anchor.style.left = `${link.left}px`;
    anchor.style.top = `${link.top}px`;
    anchor.style.width = `${link.width}px`;
    anchor.style.height = `${link.height}px`;
    anchor.title = link.label;
    anchor.setAttribute('aria-label', link.label);
    if (link.url) {
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    } else {
      // Preserve the current HashRouter route. The callback resolves destinations
      // across separately compiled text blocks and the page's bibliography PDF.
      anchor.href = typeof window === 'undefined' ? '#' : window.location.href;
      anchor.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onDestination?.(link.destination!);
      });
    }
    layer.append(anchor);
  }
  return layer;
}

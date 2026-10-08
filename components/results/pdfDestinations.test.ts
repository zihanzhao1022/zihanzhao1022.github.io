import { afterEach, describe, expect, it, vi } from 'vitest';
import { citationId, destinationPoint, finishCitationNavigation, navigateCitation, referencesId } from './pdfDestinations';

// Cropped PDF origin differs from (0, 0); this must use the PDF's viewport conversion.
const viewport = {
  width: 600,
  height: 400,
  viewBox: [10, 50, 310, 250],
  convertToViewportPoint: (x: number, y: number) => [(x - 10) * 2, (250 - y) * 2],
};

describe('PDF destination coordinates', () => {
  it('finds XYZ positions on scaled and cropped PDF pages', () => {
    expect(destinationPoint([{ num: 2, gen: 0 }, { name: 'XYZ' }, 30, 180, null], viewport)).toEqual({ left: 40, top: 140 });
  });

  it('uses the visible page origin when PDF coordinates are null, invalid or unspecified', () => {
    expect(destinationPoint([0, { name: 'XYZ' }, null, null, null], viewport)).toEqual({ left: 0, top: 0 });
    expect(destinationPoint([0, { name: 'XYZ' }, NaN, Infinity, null], viewport)).toEqual({ left: 0, top: 0 });
    expect(destinationPoint([0, { name: 'Fit' }], viewport)).toEqual({ left: 0, top: 0 });
  });

  it.each(['FitH', 'FitBH'])('preserves vertical positions for %s destinations', (name) => {
    expect(destinationPoint([0, { name }, 180], viewport)).toEqual({ left: 0, top: 140 });
  });

  it.each(['FitV', 'FitBV'])('preserves horizontal positions for %s destinations', (name) => {
    expect(destinationPoint([0, { name }, 30], viewport)).toEqual({ left: 40, top: 0 });
  });

  it('uses the upper-left of FitR destination rectangles and clamps off-page anchors', () => {
    expect(destinationPoint([0, { name: 'FitR' }, 30, 80, 90, 180], viewport)).toEqual({ left: 40, top: 140 });
    expect(destinationPoint([0, { name: 'XYZ' }, -200, 400, null], viewport)).toEqual({ left: 0, top: 0 });
    expect(destinationPoint([0, { name: 'XYZ' }, 600, -400, null], viewport)).toEqual({ left: 600, top: 400 });
  });
});

describe('citation identifiers', () => {
  it('keeps keys, papers, preview scopes and separator-like characters distinct', () => {
    const identifiers = [
      citationId('paper', 'cite.a'), citationId('other-paper', 'cite.a'),
      citationId('preview:paper:block', 'cite.a'), citationId('paper', 'cite.b'),
      citationId('a:b', 'c'), citationId('a', 'b:c'),
      citationId('a%20b', 'cite.a'), citationId('a b', 'cite.a'),
    ];
    expect(new Set(identifiers).size).toBe(identifiers.length);
    expect(citationId('论文', 'cite.作者 2024')).not.toMatch(/\s/);
    expect(referencesId('paper')).not.toBe(citationId('paper', 'references'));
    expect(referencesId('a b')).not.toBe(referencesId('a%20b'));
  });
});

const element = () => ({
  dataset: {} as Record<string, string>,
  scrollIntoView: vi.fn(),
  focus: vi.fn(),
});

function mockDocument(entries: Map<string, ReturnType<typeof element>>) {
  vi.stubGlobal('document', { getElementById: (id: string) => entries.get(id) ?? null });
}

afterEach(() => vi.unstubAllGlobals());

describe('citation navigation across separately loaded PDFs', () => {
  it('scrolls to and focuses the matching citation without looking in another paper', () => {
    const target = element();
    const otherPaper = element();
    mockDocument(new Map([
      [citationId('paper', 'cite.a'), target],
      [citationId('other-paper', 'cite.a'), otherPaper],
    ]));
    navigateCitation('paper', 'cite.a');
    expect(target.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'start', behavior: 'auto' });
    expect(target.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(otherPaper.scrollIntoView).not.toHaveBeenCalled();
  });

  it('keeps only the latest queued citation and finishes once the bibliography targets mount', () => {
    const references = element();
    const target = element();
    const entries = new Map([[referencesId('paper'), references]]);
    mockDocument(entries);
    navigateCitation('paper', 'cite.a');
    navigateCitation('paper', 'cite.b');
    expect(references.dataset.pendingCitation).toBe('cite.b');
    expect(references.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    entries.set(citationId('paper', 'cite.b'), target);
    finishCitationNavigation('paper');
    expect(references.dataset.pendingCitation).toBeUndefined();
    expect(target.scrollIntoView).toHaveBeenCalledOnce();
    expect(target.focus).toHaveBeenCalledOnce();
    finishCitationNavigation('paper');
    expect(target.focus).toHaveBeenCalledOnce();
  });

  it('safely ignores absent bibliography containers and completion without pending navigation', () => {
    mockDocument(new Map());
    expect(() => navigateCitation('paper', 'cite.missing')).not.toThrow();
    expect(() => finishCitationNavigation('paper')).not.toThrow();
    const references = element();
    mockDocument(new Map([[referencesId('paper'), references]]));
    finishCitationNavigation('paper');
    expect(references.scrollIntoView).not.toHaveBeenCalled();
  });

  it('clears an older queued citation when the user selects a target already present', () => {
    const references = element();
    const target = element();
    mockDocument(new Map([
      [referencesId('paper'), references],
      [citationId('paper', 'cite.b'), target],
    ]));
    navigateCitation('paper', 'cite.a');
    expect(references.dataset.pendingCitation).toBe('cite.a');
    navigateCitation('paper', 'cite.b');
    expect(references.dataset.pendingCitation).toBeUndefined();
    expect(target.focus).toHaveBeenCalledOnce();
    finishCitationNavigation('paper');
    expect(references.scrollIntoView).toHaveBeenCalledOnce();
  });

  it('clears a missing destination after load instead of re-queuing it on every resize', () => {
    const references = element();
    mockDocument(new Map([[referencesId('paper'), references]]));
    navigateCitation('paper', 'cite.missing');
    expect(references.dataset.pendingCitation).toBe('cite.missing');
    finishCitationNavigation('paper');
    expect(references.dataset.pendingCitation).toBeUndefined();
    finishCitationNavigation('paper');
    expect(references.scrollIntoView).toHaveBeenCalledOnce();
  });
});

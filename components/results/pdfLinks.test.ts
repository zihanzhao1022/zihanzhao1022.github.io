import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPdfLinks, PdfLinkViewport, renderPdfLinks } from './pdfLinks';

const viewport = (scale = 1): PdfLinkViewport => ({
  width: 300 * scale,
  height: 200 * scale,
  convertToViewportPoint: (x, y) => [x * scale, (200 - y) * scale],
});
const annotation = (extra: Record<string, unknown> = {}) => ({
  subtype: 'Link', rect: [10, 20, 40, 30], dest: 'cite.yang2024qwen25', ...extra,
});

describe('PDF link geometry and destinations', () => {
  it('converts PDF coordinates to the scaled screen rectangle without a device-pixel multiplier', () => {
    expect(getPdfLinks([annotation()], viewport(1.5))).toEqual([{
      left: 15, top: 255, width: 45, height: 15,
      destination: 'cite.yang2024qwen25', label: '查看参考文献 yang2024qwen25',
    }]);
    expect(getPdfLinks([annotation()], viewport(0.5))[0]).toMatchObject({
      left: 5, top: 85, width: 15, height: 5,
    });
  });

  it('normalizes reversed corners and rotated viewports', () => {
    const rotated = { ...viewport(), convertToViewportPoint: (x: number, y: number) => [y * 2, x * 2] };
    expect(getPdfLinks([annotation({ rect: [40, 30, 10, 20] })], rotated)[0]).toMatchObject({
      left: 40, top: 20, width: 20, height: 60,
    });
  });

  it('preserves named and explicit internal destinations for the page resolver', () => {
    const destination = [{ num: 3, gen: 0 }, { name: 'XYZ' }, 20, 70, null];
    const links = getPdfLinks([annotation({ dest: 'section.3' }), annotation({ dest: destination })], viewport());
    expect(links[0]).toMatchObject({ destination: 'section.3', label: '跳转到 section.3' });
    expect(links[1].destination).toBe(destination);
  });

  it('ignores malformed, invisible, empty and non-link annotations', () => {
    const invalid = [
      null, 'not an annotation', annotation({ subtype: 'Widget' }),
      annotation({ rect: [1, 2, 3] }), annotation({ rect: [0, NaN, 3, 4] }),
      annotation({ rect: [0, 0, 0, 4] }), annotation({ rect: ['0', 0, 3, 4] }),
      annotation({ annotationFlags: 2 }), annotation({ annotationFlags: 32 }),
      annotation({ dest: '' }), annotation({ dest: [] }),
    ];
    expect(getPdfLinks(invalid, viewport())).toEqual([]);
  });

  it('accepts only safe external protocols and never uses unsafeUrl or executes PDF actions', () => {
    const urls = ['https://example.com/paper?a=1#ref', 'http://example.com/', 'mailto:author@example.com'];
    expect(getPdfLinks(urls.map((url) => annotation({ url, dest: null })), viewport()).map((link) => link.url)).toEqual(urls);
    const unsafe = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///tmp/x', 'ftp://example.com', '/relative'];
    const script = vi.fn();
    expect(getPdfLinks([
      ...unsafe.map((url) => annotation({ url, dest: null })),
      annotation({ dest: null, unsafeUrl: 'https://example.com' }),
      annotation({ dest: null, action: 'Launch', actions: { Action: script } }),
    ], viewport())).toEqual([]);
    expect(script).not.toHaveBeenCalled();
  });
});

/** The renderer needs only basic DOM construction; browser navigation is tested through its click listener. */
class ElementStub {
  style: Record<string, string> = {};
  children: ElementStub[] = [];
  attributes: Record<string, string> = {};
  listeners: Record<string, (event: Event) => void> = {};
  className = '';
  href = '';
  target = '';
  rel = '';
  title = '';
  constructor(public tagName: string) {}
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  addEventListener(name: string, listener: (event: Event) => void) { this.listeners[name] = listener; }
  append(child: ElementStub) { this.children.push(child); }
}

function mockDom() {
  vi.stubGlobal('document', { createElement: (tag: string) => new ElementStub(tag) });
  vi.stubGlobal('window', { location: { href: 'https://example.com/#/results/paper' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('PDF link layer', () => {
  it('renders positioned, named, native keyboard-focusable anchors and isolates external windows', () => {
    mockDom();
    const layer = renderPdfLinks({ annotations: [annotation({ dest: null, url: 'https://example.com/paper' })], viewport: viewport(2) }) as unknown as ElementStub;
    expect(layer.className).toBe('resultsPdfLinks');
    expect(layer.style).toEqual({ width: '600px', height: '400px' });
    expect(layer.children[0]).toMatchObject({
      tagName: 'a', href: 'https://example.com/paper', target: '_blank', rel: 'noopener noreferrer',
      attributes: { 'aria-label': 'https://example.com/paper' }, title: 'https://example.com/paper',
      style: { left: '20px', top: '340px', width: '60px', height: '20px' },
    });
  });

  it('dispatches citation navigation while preserving the HashRouter route and avoiding parent clicks', () => {
    mockDom();
    const onDestination = vi.fn();
    const layer = renderPdfLinks({ annotations: [annotation()], viewport: viewport(), onDestination }) as unknown as ElementStub;
    const link = layer.children[0];
    expect(link.href).toBe('https://example.com/#/results/paper');
    expect(link.attributes['aria-label']).toBe('查看参考文献 yang2024qwen25');
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    link.listeners.click(event as unknown as Event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(onDestination).toHaveBeenCalledExactlyOnceWith('cite.yang2024qwen25');
  });

  it('does not expose dead destination links without a navigation callback', () => {
    mockDom();
    const layer = renderPdfLinks({ annotations: [annotation()], viewport: viewport() }) as unknown as ElementStub;
    expect(layer.children).toHaveLength(0);
  });
});

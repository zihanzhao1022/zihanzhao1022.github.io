import { describe, expect, it } from 'vitest';
import { renderInlineMarkdown } from './markdown';

const LINK_ATTRS = 'target="_blank" rel="noreferrer" class="text-purple-600 hover:underline font-medium"';

describe('renderInlineMarkdown', () => {
  it('returns plain text unchanged', () => {
    expect(renderInlineMarkdown("My homepage was deployed! 🚀 It's live.")).toBe(
      "My homepage was deployed! 🚀 It's live.",
    );
  });

  it('escapes HTML', () => {
    expect(renderInlineMarkdown('<img src=x onerror="alert(1)"> & more')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; more',
    );
  });

  it('renders links', () => {
    expect(renderInlineMarkdown('Mail [me](mailto:a@b.org) or see [site](https://x.org/a?b=1&c=2).')).toBe(
      `Mail <a href="mailto:a@b.org" ${LINK_ATTRS}>me</a> or see <a href="https://x.org/a?b=1&amp;c=2" ${LINK_ATTRS}>site</a>.`,
    );
  });

  it('allows site-relative links', () => {
    expect(renderInlineMarkdown('[cv](/files/cv.pdf) [top](#/about) [doc](./a.pdf)')).toBe(
      `<a href="/files/cv.pdf" ${LINK_ATTRS}>cv</a> <a href="#/about" ${LINK_ATTRS}>top</a> <a href="./a.pdf" ${LINK_ATTRS}>doc</a>`,
    );
  });

  it('renders unsafe links as plain text', () => {
    expect(
      renderInlineMarkdown('[a](javascript:alert) [b](JavaScript:alert) [c](data:text/html,hi) [d](//evil.example)'),
    ).toBe('a b c d');
  });

  it('renders bold, including inside link text', () => {
    expect(renderInlineMarkdown('**Zihan** and [**paper**](https://x.org)')).toBe(
      `<strong>Zihan</strong> and <a href="https://x.org" ${LINK_ATTRS}><strong>paper</strong></a>`,
    );
  });

  it('leaves unmatched markers alone', () => {
    expect(renderInlineMarkdown('2 * 3 = 6, [not a link] (x), **open')).toBe('2 * 3 = 6, [not a link] (x), **open');
  });
});

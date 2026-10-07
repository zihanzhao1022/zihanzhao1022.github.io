import { describe, expect, it } from 'vitest';
import { renderInlineMarkdown, renderMarkdown } from './markdown';

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

// Class names are styling; these tests check the structure.
const plain = (html: string): string => html.replace(/ class="[^"]*"/g, '');

describe('renderMarkdown', () => {
  it('renders headings, paragraphs with line breaks, and lists', () => {
    expect(plain(renderMarkdown('## Courses\nFirst line\nsecond line\n\n- One\n- [Two](https://x.org)\n\n1. A\n2. B'))).toBe(
      [
        '<h2>Courses</h2>',
        '<p>First line<br />second line</p>',
        '<ul><li>One</li><li><a href="https://x.org" target="_blank" rel="noreferrer">Two</a></li></ul>',
        '<ol><li>A</li><li>B</li></ol>',
      ].join('\n'),
    );
  });

  it('maps # and ## to h2 and ### to h3', () => {
    expect(plain(renderMarkdown('# A\n### B'))).toBe('<h2>A</h2>\n<h3>B</h3>');
  });

  it('shows standalone images from safe addresses only', () => {
    expect(plain(renderMarkdown('![Me](/images/zzh.png)'))).toBe('<img src="/images/zzh.png" alt="Me" />');
    expect(plain(renderMarkdown('![x](javascript:alert)'))).toBe('<p>x</p>');
  });

  it('escapes HTML everywhere', () => {
    expect(plain(renderMarkdown('<script>alert(1)</script>\n- <b>x</b>'))).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n<ul><li>&lt;b&gt;x&lt;/b&gt;</li></ul>',
    );
  });

  it('starts a new list when the list type changes', () => {
    expect(plain(renderMarkdown('- a\n1. b'))).toBe('<ul><li>a</li></ul>\n<ol><li>b</li></ol>');
  });

  it('returns nothing for an empty body', () => {
    expect(renderMarkdown('  \n\n')).toBe('');
  });
});

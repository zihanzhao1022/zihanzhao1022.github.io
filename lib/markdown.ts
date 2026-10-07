const LINK_CLASS = 'text-purple-600 hover:underline font-medium';

// http(s), mailto, and site paths ("/x" but not "//host", "#/x", "./x").
const SAFE_URL = /^(https?:|mailto:|\/(?!\/)|#|\.\/)/i;

// Text only ever lands in element content or double-quoted attributes, so these four are enough.
const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Renders the Markdown subset used in bio and news: [text](url) and **bold**.
 * Everything else is HTML-escaped, so the result is safe for dangerouslySetInnerHTML.
 */
export function renderInlineMarkdown(source: string): string {
  return escapeHtml(source)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, text: string, url: string) =>
      SAFE_URL.test(url)
        ? `<a href="${url}" target="_blank" rel="noreferrer" class="${LINK_CLASS}">${text}</a>`
        : text,
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

const BLOCK_CLASS = {
  h2: 'text-xl font-bold text-gray-900 mt-8 mb-3',
  h3: 'text-lg font-semibold text-gray-900 mt-6 mb-2',
  p: 'text-gray-700 font-light leading-relaxed mb-4',
  ul: 'list-disc pl-6 mb-4 space-y-1 text-gray-700 font-light',
  ol: 'list-decimal pl-6 mb-4 space-y-1 text-gray-700 font-light',
  img: 'max-w-full h-auto rounded-md my-4',
};

const SAFE_IMAGE = /^(https?:|\/(?!\/)|\.\/)/i;

type ListBlock = { tag: 'ul' | 'ol'; items: string[] };

/**
 * Renders a page body: # / ## / ### headings, - and 1. lists, a standalone ![alt](src) line as an image,
 * and paragraphs separated by blank lines (single line breaks are kept). All other HTML is escaped.
 */
export function renderMarkdown(source: string): string {
  const html: string[] = [];
  const open: { paragraph: string[]; list: ListBlock | null } = { paragraph: [], list: null };

  const closeParagraph = () => {
    if (open.paragraph.length > 0) {
      html.push(`<p class="${BLOCK_CLASS.p}">${open.paragraph.map(renderInlineMarkdown).join('<br />')}</p>`);
    }
    open.paragraph = [];
  };
  const closeList = () => {
    if (open.list) {
      const { tag, items } = open.list;
      html.push(`<${tag} class="${BLOCK_CLASS[tag]}">${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${tag}>`);
    }
    open.list = null;
  };

  for (const line of source.replace(/\r\n?/g, '\n').split('\n').map((raw) => raw.trim())) {
    if (line === '') {
      closeParagraph();
      closeList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      closeParagraph();
      closeList();
      const tag = heading[1].length === 3 ? 'h3' : 'h2';
      html.push(`<${tag} class="${BLOCK_CLASS[tag]}">${renderInlineMarkdown(heading[2])}</${tag}>`);
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    if (image) {
      closeParagraph();
      closeList();
      const [, alt, src] = image;
      html.push(
        SAFE_IMAGE.test(src)
          ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="${BLOCK_CLASS.img}" />`
          : `<p class="${BLOCK_CLASS.p}">${escapeHtml(alt)}</p>`,
      );
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const listItem = bullet ?? numbered;
    if (listItem) {
      closeParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (open.list && open.list.tag !== tag) closeList();
      if (!open.list) open.list = { tag, items: [] };
      open.list.items.push(listItem[1]);
      continue;
    }
    closeList();
    open.paragraph.push(line);
  }
  closeParagraph();
  closeList();
  return html.join('\n');
}

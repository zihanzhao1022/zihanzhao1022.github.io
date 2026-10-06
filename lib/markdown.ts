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

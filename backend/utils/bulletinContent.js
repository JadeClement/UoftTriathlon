/**
 * Turn a club-wide email body into the HTML and plain text stored on News.
 * Formatting matches the bulk email (markdown bold/italic/links, or existing anchors).
 */

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatText(text, options = {}) {
  if (!text) return '';
  const linkStyle = options.linkStyle ? ` style="${options.linkStyle}"` : '';

  const linkifyMarkdown = (s) => s.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/gi, (_m, label, url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    const display = (label && label.trim().length > 0) ? label : url;
    return `<a href="${href}"${linkStyle}>${display}</a>`;
  });

  return linkifyMarkdown(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n• /g, '<br/><br/>• ')
    .replace(/\n\d+\. /g, '<br/>$&')
    .replace(/\n/g, '<br/>');
}

function sanitizeBulletinHtml(html) {
  const allowed = new Set(['a', 'strong', 'em', 'b', 'i', 'br', 'p', 'ul', 'ol', 'li']);
  const withoutDangerous = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');

  return withoutDangerous.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag, attrs) => {
    const name = tag.toLowerCase();
    if (!allowed.has(name)) return '';
    if (match.startsWith('</')) return `</${name}>`;
    if (name === 'br') return '<br/>';
    if (name === 'a') {
      const hrefMatch = String(attrs || '').match(/href\s*=\s*(['"])(.*?)\1/i);
      const href = hrefMatch ? hrefMatch[2].trim() : '';
      if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
        return '';
      }
      const safeHref = href.replace(/"/g, '%22');
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">`;
    }
    return `<${name}>`;
  });
}

function buildBulletinHtml(body) {
  const signoff = '<p><em>The UofT Tri Club Exec</em></p>';
  const source = String(body || '');
  if (!source.trim()) return signoff;
  const hasAnchor = source.includes('<a ') || source.includes('<A ') || source.includes('</a>');
  const raw = hasAnchor ? source : formatText(escapeHtml(source));
  const safe = sanitizeBulletinHtml(raw);
  if (!safe) return signoff;
  return `${safe}${signoff}`;
}

function toPlainText(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchText({ title, bannerTitle, body }) {
  const combined = [title, bannerTitle, body].filter(Boolean).join('\n');
  return toPlainText(combined.replace(/\[name\]/g, ' '));
}

function previewText(body, max = 140) {
  const plain = toPlainText(String(body || '').replace(/\[name\]/g, 'there'));
  if (!plain) return 'A new club bulletin is on News.';
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trim()}…`;
}

function personalizeBulletinHtml(html, name) {
  const safeName = escapeHtml(name || 'there');
  return String(html || '').replace(/\[name\]/g, safeName);
}

module.exports = {
  formatText,
  escapeHtml,
  buildBulletinHtml,
  buildSearchText,
  previewText,
  personalizeBulletinHtml,
  sanitizeBulletinHtml,
};

import { Marked, Tokens } from 'marked';
import hljs from 'highlight.js';

let highlightCssCache: string | null = null;

export function getHighlightCss(): string {
  if (!highlightCssCache) {
    highlightCssCache = `
.hljs{color:#24292e;background:#f6f8fa}
.hljs-comment,.hljs-quote{color:#6a737d;font-style:italic}
.hljs-keyword,.hljs-selector-tag,.hljs-built_in{color:#d73a49}
.hljs-string,.hljs-attr,.hljs-addition{color:#032f62}
.hljs-number,.hljs-literal{color:#005cc5}
.hljs-type,.hljs-template-variable{color:#6f42c1}
.hljs-title,.hljs-section{color:#005cc5;font-weight:bold}
.hljs-name,.hljs-selector-id,.hljs-selector-class{color:#22863a}
.hljs-variable,.hljs-template-tag{color:#e36209}
.hljs-deletion{color:#b31d28;background:#ffeef0}
.hljs-meta{color:#6a737d}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
`;
  }
  return highlightCssCache;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * When the LLM puts HTML in a code block and then repeats it in a ```output block,
 * we render the HTML block's content as actual HTML so the output shows the visual
 * result instead of raw code. Replaces ```output\n...\n``` (after ```html\n...\n```)
 * with a div that contains the preceding HTML for rendering.
 */
function preprocessHtmlOutputBlocks(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return markdown;
  // Match: ```html (or htm) + newline + content + newline + ``` + optional whitespace + ```output + newline + any content + newline + ```
  const re = /```html?\s*\n([\s\S]*?)\n```\s*\n```output\s*\n[\s\S]*?\n```/gi;
  return markdown.replace(re, (_match, htmlContent: string) => {
    const trimmed = htmlContent.trim();
    return (
      '```html\n' +
      htmlContent +
      '\n```\n\n' +
      '<div class="rendered-html-output" style="border:1px solid #e0e0e0;padding:1em;margin:1em 0;background:#fafafa;">' +
      trimmed +
      '</div>\n'
    );
  });
}

export function markdownToHtml(markdown: string): string {
  const preprocessed = preprocessHtmlOutputBlocks(markdown);
  const marked = new Marked({ gfm: true, breaks: false });

  marked.use({
    renderer: {
      code(token: Tokens.Code): string {
        const { text, lang } = token;
        if (lang) {
          const safeLang = lang.toLowerCase();
          // Render ```html / ```htm as actual HTML (diagrams, layouts) instead of code
          if (safeLang === 'html' || safeLang === 'htm') {
            const trimmed = text.trim();
            return `<div class="rendered-html-output" style="border:1px solid #e0e0e0;padding:1em;margin:1em 0;background:#fafafa;">${trimmed}</div>\n`;
          }
          if (hljs.getLanguage(safeLang)) {
            try {
              const highlighted = hljs.highlight(text, { language: safeLang }).value;
              return `<pre><code class="hljs language-${escapeHtml(safeLang)}">${highlighted}</code></pre>\n`;
            } catch {
              // fall through to plain
            }
          }
          return `<pre><code class="language-${escapeHtml(safeLang)}">${escapeHtml(text)}</code></pre>\n`;
        }

        return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>\n`;
      },

      heading(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token: Tokens.Heading): string {
        const { depth, text } = token;
        const id = text
          .toLowerCase()
          .replace(/<[^>]*>/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          || `heading-${depth}`;
        const content = token.tokens ? this.parser.parseInline(token.tokens) : text;
        return `<h${depth} id="${id}">${content}</h${depth}>\n`;
      },

      table(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token: Tokens.Table): string {
        const renderCell = (cell: Tokens.TableCell): string =>
          this.parser.parseInline(cell.tokens);

        let html = '<table>\n<thead>\n<tr>\n';
        for (const cell of token.header) {
          const align = cell.align ? ` style="text-align:${cell.align}"` : '';
          html += `<th${align}>${renderCell(cell)}</th>\n`;
        }
        html += '</tr>\n</thead>\n<tbody>\n';
        for (const row of token.rows) {
          html += '<tr>\n';
          for (const cell of row) {
            const align = cell.align ? ` style="text-align:${cell.align}"` : '';
            html += `<td${align}>${renderCell(cell)}</td>\n`;
          }
          html += '</tr>\n';
        }
        html += '</tbody>\n</table>\n';
        return html;
      },
    },
  });

  return marked.parse(preprocessed) as string;
}

import { Marked, Tokens } from 'marked';
import hljs from 'highlight.js';
import fs from 'fs';
import katex from 'katex';

let highlightCssCache: string | null = null;
let mathCssCache: string | null = null;

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

export function getMathCss(): string {
  if (mathCssCache !== null) return mathCssCache;
  try {
    const cssPath = require.resolve('katex/dist/katex.min.css');
    mathCssCache = fs.readFileSync(cssPath, 'utf8');
  } catch {
    mathCssCache = '';
  }
  return mathCssCache;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeDiagramHtml(html: string): string {
  if (!html) return html;
  return html
    .replace(/<\s*(script|iframe|object|embed|link|meta|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|link|meta|base)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '');
}

function renderDiagramFigure(rawHtml: string): string {
  const cleaned = sanitizeDiagramHtml(rawHtml.trim());
  if (!cleaned) return '';
  const hasCaption = /<figcaption\b|class\s*=\s*["'][^"']*caption[^"']*["']/i.test(cleaned);
  const caption = hasCaption ? '' : '<figcaption>Figure: Visual Summary</figcaption>';
  return `<figure class="rendered-html-output"><div class="diagram-canvas">${cleaned}</div>${caption}</figure>\n`;
}

function transformOutsideCodeFences(
  markdown: string,
  transform: (text: string) => string,
): string {
  const fenceRegex = /```[\s\S]*?```/g;
  let result = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(markdown)) !== null) {
    const nonCode = markdown.slice(cursor, match.index);
    result += transform(nonCode);
    result += match[0];
    cursor = fenceRegex.lastIndex;
  }
  result += transform(markdown.slice(cursor));
  return result;
}

function renderMath(latex: string, displayMode: boolean): string {
  const source = latex.trim();
  if (!source) return '';
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: 'ignore',
    });
  } catch {
    return displayMode ? `\\[${source}\\]` : `\\(${source}\\)`;
  }
}

function preprocessMath(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return markdown;

  return transformOutsideCodeFences(markdown, (segment) => {
    const withDisplay = segment
      // Preferred block-math delimiters.
      .replace(/\\\[([\s\S]*?)\\\]/g, (_m, expr: string) => {
        const rendered = renderMath(expr, true);
        return rendered ? `\n<div class="math-display">${rendered}</div>\n` : '';
      })
      // Backward compatibility for $$...$$ block math.
      .replace(/\$\$([\s\S]*?)\$\$/g, (_m, expr: string) => {
        const rendered = renderMath(expr, true);
        return rendered ? `\n<div class="math-display">${rendered}</div>\n` : '';
      });

    // Preferred inline-math delimiters.
    return withDisplay.replace(/\\\((.+?)\\\)/g, (_m, expr: string) => {
      const rendered = renderMath(expr, false);
      return rendered ? `<span class="math-inline">${rendered}</span>` : '';
    });
  });
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
    const rendered = renderDiagramFigure(htmlContent);
    return (
      '```html\n' +
      htmlContent +
      '\n```\n\n' +
      rendered
    );
  });
}

function sanitizeMermaidSyntax(raw: string): string {
  return raw
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .replace(/\t/g, '    ')
    .trim();
}

export function markdownToHtml(markdown: string): string {
  const withMath = preprocessMath(markdown);
  const preprocessed = preprocessHtmlOutputBlocks(withMath);
  const marked = new Marked({ gfm: true, breaks: false });

  marked.use({
    renderer: {
      code(token: Tokens.Code): string {
        const { text, lang } = token;
        if (lang) {
          const safeLang = lang.toLowerCase();
          // Render ```mermaid blocks as <pre class="mermaid"> for client-side Mermaid.js rendering
          if (safeLang === 'mermaid') {
            const cleaned = sanitizeMermaidSyntax(text);
            return `<div class="mermaid-container"><pre class="mermaid">${cleaned}</pre></div>\n`;
          }
          // Render ```html / ```htm as actual HTML (diagrams, layouts) instead of code
          if (safeLang === 'html' || safeLang === 'htm') {
            return renderDiagramFigure(text);
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

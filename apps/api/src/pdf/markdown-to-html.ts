import { Marked, Tokens } from 'marked';
import hljs from 'highlight.js';
import type { ContentSegment } from '@/orchestrator/build-markdown';

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

// ── Markdown pre-processing ──

/**
 * Ensure fences have blank-line boundaries and fix unclosed fences.
 * Uses line-by-line tracking instead of regex fence counting (which miscounts
 * when ``` appears inside indented blocks or table cells).
 */
function normalizeMarkdownStructure(md: string): string {
  if (!md || typeof md !== 'string') return md;
  let out = md.replace(/\r\n/g, '\n');

  // Blank-line boundaries around fences
  out = out.replace(/([^\n])(```[^\n]*\n)/g, '$1\n$2');
  out = out.replace(/([^\n])\n(```)/g, '$1\n\n$2');
  out = out.replace(/(```)\n([^\n])/g, '$1\n\n$2');

  // Line-by-line fence tracking to find unclosed fences
  const lines = out.split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!inFence) {
      if (trimmed.startsWith('```')) {
        inFence = true;
      }
    } else {
      if (trimmed === '```') {
        inFence = false;
      }
    }
  }
  // If we're still inside a fence at end-of-input, close it
  if (inFence) {
    out += '\n```\n';
  }

  // Ensure headings always have blank line before them
  out = out.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

  return out;
}

/**
 * Fence-aware stripping of ```html, ```output, and ```html+output pairs.
 * Walks line-by-line so it never eats the closing ``` of a different block.
 */
function stripBannedFences(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return markdown;
  const bannedLangs = /^(html?|output|xml|svg|xhtml)$/i;
  const lines = markdown.split('\n');
  const out: string[] = [];
  let inFence = false;
  let fenceLang = '';
  let isBanned = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inFence) {
      const m = trimmed.match(/^```(\S*)/);
      if (m) {
        inFence = true;
        fenceLang = m[1] || '';
        isBanned = bannedLangs.test(fenceLang);
        if (!isBanned) out.push(line);
      } else {
        out.push(line);
      }
    } else {
      if (trimmed === '```') {
        inFence = false;
        if (!isBanned) out.push(line);
        isBanned = false;
        fenceLang = '';
      } else {
        if (!isBanned) out.push(line);
      }
    }
  }

  return out.join('\n');
}

/**
 * Fix common GFM table issues that prevent marked from recognising them:
 * 1. Missing separator row (|---|---|) after the header row
 * 2. Missing blank line before the table
 * 3. Tab-delimited tables (converted to pipe tables)
 */
function fixGfmTables(md: string): string {
  if (!md || typeof md !== 'string') return md;
  const lines = md.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed.startsWith('|') && (trimmed.match(/\t/g) || []).length >= 2) {
      const cells = trimmed.split('\t').map((c) => c.trim());
      const pipeLine = '| ' + cells.join(' | ') + ' |';
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const nextIsTabRow = !nextLine.startsWith('|') && (nextLine.match(/\t/g) || []).length >= 2;
      const nextIsPipeRow = nextLine.startsWith('|');
      if (nextIsTabRow || nextIsPipeRow) {
        if (out.length > 0 && out[out.length - 1].trim() !== '') {
          out.push('');
        }
        out.push(pipeLine);
        out.push('| ' + cells.map(() => '---').join(' | ') + ' |');
        continue;
      }
      out.push(pipeLine);
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const nextIsSep = /^\|[\s:-]+(\|[\s:-]+)+\|?$/.test(nextLine);
      const nextIsPipe = nextLine.startsWith('|') && nextLine.endsWith('|');
      const prevOut = out.length > 0 ? out[out.length - 1].trim() : '';
      const prevIsPipe = prevOut.startsWith('|') && prevOut.endsWith('|');
      const prevIsSep = /^\|[\s:-]+(\|[\s:-]+)+\|?$/.test(prevOut);
      // Only inject a separator at the START of a table block, never between data rows.
      if (nextIsPipe && !nextIsSep && !prevIsPipe && !prevIsSep) {
        const cols = trimmed.split('|').filter((c) => c.trim()).length;
        if (out.length > 0 && out[out.length - 1].trim() !== '' && !out[out.length - 1].trim().startsWith('|')) {
          out.push('');
        }
        out.push(line);
        out.push('| ' + Array(cols).fill('---').join(' | ') + ' |');
        continue;
      }
    }

    out.push(line);
  }

  return out.join('\n');
}

// ── Marked instance ──

function createMarkedInstance(): Marked {
  const marked = new Marked({ gfm: true, breaks: false });

  marked.use({
    renderer: {
      code(token: Tokens.Code): string {
        const { text, lang } = token;
        if (lang) {
          const safeLang = lang.toLowerCase();
          if (safeLang === 'html' || safeLang === 'htm') {
            return `<pre><code class="language-html">${escapeHtml(text)}</code></pre>\n`;
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

  return marked;
}

// ── Pre-process a pure-markdown string before feeding to marked ──

function preprocessMarkdown(md: string): string {
  let out = normalizeMarkdownStructure(md);
  out = stripBannedFences(out);
  out = fixGfmTables(out);
  return out;
}

// ── Post-render validation ──

function detectRawMarkdownInHtml(html: string): boolean {
  return (
    /<p>\s*```/.test(html) ||
    /<p>\s*#{1,6}\s/.test(html) ||
    /<p>\s*\|[^|]+\|[^|]+\|/.test(html)
  );
}

/**
 * Detect markdown syntax trapped inside <pre><code> blocks.
 * This happens when an unclosed fence swallows subsequent prose.
 * A real code block won't contain ### headings or **bold** patterns.
 */
function detectSwallowedContentInCodeBlocks(html: string): boolean {
  const codeBlockRe = /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi;
  let m: RegExpExecArray | null;
  codeBlockRe.lastIndex = 0;
  while ((m = codeBlockRe.exec(html)) !== null) {
    const content = m[1];
    if (content.length > 500) {
      const hasHeading = /^#{1,6}\s/m.test(content) || /#{1,6}\s/.test(content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
      const hasBold = /\*\*[^*]+\*\*/.test(content);
      const hasTable = /\|[^|]+\|[^|]+\|/.test(content);
      if ((hasHeading && hasBold) || (hasHeading && hasTable)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extract content trapped in oversized <pre><code> blocks that clearly
 * contain markdown (headings, bold, tables) back out and re-parse them.
 */
function repairSwallowedCodeBlocks(html: string, marked: Marked): string {
  return html.replace(
    /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (full, content: string) => {
      if (content.length < 500) return full;
      const decoded = content
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const hasHeading = /^#{1,6}\s/m.test(decoded);
      const hasBold = /\*\*[^*]+\*\*/.test(decoded);
      const hasTable = /\|[^|]+\|[^|]+\|/.test(decoded);
      if ((hasHeading && hasBold) || (hasHeading && hasTable)) {
        console.warn('[render] Repairing <pre> block that swallowed markdown content');
        return marked.parse(decoded) as string;
      }
      return full;
    },
  );
}

function repairLeakedMarkdown(html: string, marked: Marked): string {
  let repaired = html;

  repaired = repaired.replace(
    /<p>\s*(#{1,6})\s+(.*?)<\/p>/g,
    (_m, hashes: string, text: string) => {
      const level = hashes.length;
      const id = text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `heading-${level}`;
      return `<h${level} id="${id}">${text}</h${level}>`;
    },
  );

  repaired = repaired.replace(
    /<p>(\|[^<]+(?:\n\|[^<]+)+)<\/p>/g,
    (_m, tableBlock: string) => {
      const parsed = marked.parse(tableBlock) as string;
      return parsed.trim();
    },
  );

  repaired = repaired.replace(
    /<p>((?:[^<]|<(?!\/p>))*\*\*[^<]*)<\/p>/g,
    (_m, inner: string) => {
      const decoded = inner.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const parsed = marked.parse(decoded) as string;
      return parsed.trim();
    },
  );

  return repaired;
}

// ── Public API ──

/**
 * Convert structured content segments to HTML. Raw HTML segments pass through
 * untouched; markdown segments are parsed independently by marked. This
 * guarantees that CommonMark HTML-block rules never swallow markdown content.
 */
export function segmentsToHtml(segments: ContentSegment[]): string {
  const marked = createMarkedInstance();
  const htmlParts: string[] = [];

  for (const seg of segments) {
    if (seg.type === 'html') {
      htmlParts.push(seg.content);
    } else {
      const preprocessed = preprocessMarkdown(seg.content);
      let rendered = marked.parse(preprocessed) as string;

      if (detectSwallowedContentInCodeBlocks(rendered)) {
        console.warn('[render] Content swallowed by code block — repairing');
        rendered = repairSwallowedCodeBlocks(rendered, marked);
      }

      if (detectRawMarkdownInHtml(rendered)) {
        console.warn('[render] Raw markdown detected in segment — applying repair pass');
        rendered = repairLeakedMarkdown(rendered, marked);
      }

      htmlParts.push(rendered);
    }
  }

  return htmlParts.join('\n');
}

/**
 * Legacy: convert a flat markdown string (with embedded raw HTML) to HTML.
 * Used when only session.finalMarkdown is available (no segments).
 *
 * Splits the string into raw-HTML and markdown regions using a state machine,
 * then parses each markdown region independently.
 */
export function markdownToHtml(markdown: string): string {
  const segments = splitFlatMarkdownIntoSegments(markdown);
  return segmentsToHtml(segments);
}

/**
 * State-machine that splits a flat markdown string (with embedded raw HTML
 * blocks) into typed segments. Tracks <div> nesting depth so nested divs
 * (cover-page, copyright-page, toc) are treated as single HTML blocks.
 */
function splitFlatMarkdownIntoSegments(md: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const lines = md.split('\n');
  let inHtml = false;
  let depth = 0;
  let htmlBuf: string[] = [];
  let mdBuf: string[] = [];

  const flushMd = () => {
    if (mdBuf.length > 0) {
      const text = mdBuf.join('\n').trim();
      if (text) segments.push({ type: 'md', content: text });
      mdBuf = [];
    }
  };

  const flushHtml = () => {
    if (htmlBuf.length > 0) {
      segments.push({ type: 'html', content: htmlBuf.join('\n') });
      htmlBuf = [];
    }
  };

  for (const line of lines) {
    if (!inHtml) {
      // Detect standalone self-closing HTML tags (page-break divs, <hr/>, etc.)
      if (/^\s*<(?:div|hr)\b[^>]*\/>\s*$/i.test(line)) {
        flushMd();
        segments.push({ type: 'html', content: line });
        continue;
      }
      // Detect start of a block-level <div> or <p> with style/class (structural HTML, not markdown)
      if (/^\s*<div[\s>]/i.test(line)) {
        flushMd();
        inHtml = true;
        depth = 0;
        htmlBuf = [];
      }
    }

    if (inHtml) {
      htmlBuf.push(line);
      const opens = (line.match(/<div[\s>]/gi) || []).length;
      const closes = (line.match(/<\/div\s*>/gi) || []).length;
      depth += opens - closes;
      if (depth <= 0) {
        flushHtml();
        inHtml = false;
        depth = 0;
      }
    } else {
      mdBuf.push(line);
    }
  }

  if (htmlBuf.length > 0) {
    // Unclosed HTML block — flush as HTML anyway to avoid losing content
    flushHtml();
  }
  flushMd();

  return segments;
}

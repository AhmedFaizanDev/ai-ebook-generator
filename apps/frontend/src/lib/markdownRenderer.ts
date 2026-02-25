import { marked, Renderer } from 'marked';
import hljs from 'highlight.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const renderer: Partial<Renderer> = {
  code({ text, lang }: { text: string; lang?: string }) {
    let highlighted: string;
    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(text, { language: lang }).value;
      } catch {
        highlighted = escapeHtml(text);
      }
    } else {
      try {
        highlighted = hljs.highlightAuto(text).value;
      } catch {
        highlighted = escapeHtml(text);
      }
    }
    const langLabel = lang ? `<span class="code-lang-label">${escapeHtml(lang)}</span>` : '';
    return `<div class="code-block-wrapper">${langLabel}<pre class="code-block"><code>${highlighted}</code></pre></div>`;
  },
};

marked.use({
  renderer,
  gfm: true,
  breaks: false,
});

export function renderMarkdown(md: string): string {
  try {
    return marked.parse(md) as string;
  } catch {
    return `<p>${escapeHtml(md)}</p>`;
  }
}

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export function htmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  td.use(gfm);
  td.addRule('preserveImg', {
    filter: 'img',
    replacement(_content: string, node: HTMLElement) {
      const src = node.getAttribute('src') ?? '';
      const alt = node.getAttribute('alt') ?? '';
      if (!src) return '';
      return `\n\n![${alt}](${src})\n\n`;
    },
  });
  return td.turndown(html).replace(/\n{3,}/g, '\n\n').trim();
}

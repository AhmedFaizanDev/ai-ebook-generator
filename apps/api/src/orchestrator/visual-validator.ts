import { VisualValidationResult } from '@/lib/types';

const TABLE_RE = /^\|.+\|/m;
const TABLE_SEPARATOR_RE = /^\|[\s:\-|]+\|/m;
const MERMAID_DIAGRAM_RE = /```mermaid\s*\n[\s\S]*?\n```/gim;
const PLACEHOLDER_TEXT_RE = /\b(lorem ipsum|placeholder|dummy text|sample only|todo)\b/i;

function hasTableIn(text: string): boolean {
  return TABLE_RE.test(text) && TABLE_SEPARATOR_RE.test(text);
}

function hasMermaidDiagramIn(text: string): boolean {
  return /```mermaid\s*\n[\s\S]*?\n```/im.test(text);
}

function extractMermaidDiagramBlocks(text: string): string[] {
  const blocks: string[] = [];
  const regex = new RegExp(MERMAID_DIAGRAM_RE);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}

function hasQualityMermaidDiagram(text: string): boolean {
  const blocks = extractMermaidDiagramBlocks(text);
  if (blocks.length === 0) return false;

  return blocks.some((block) => {
    const mermaid = block.replace(/```mermaid\s*\n?/i, '').replace(/\n```$/i, '').trim();
    if (mermaid.length < 30) return false;
    if (PLACEHOLDER_TEXT_RE.test(mermaid)) return false;
    if (!/\b(graph|flowchart)\b/i.test(mermaid)) return false;
    const nodeLabels = (mermaid.match(/\["[^"]*"\]|\[[^\]]+\]/g) ?? []).length;
    const arrows = (mermaid.match(/-->/g) ?? []).length;
    return nodeLabels >= 3 && arrows >= 2;
  });
}

function extractLevel3Blocks(md: string): string[] {
  const lines = md.split('\n');
  const blocks: string[] = [];
  let collecting = false;
  let current: string[] = [];

  for (const line of lines) {
    if (/^###\s+/.test(line)) {
      if (collecting && current.length > 0) {
        blocks.push(current.join('\n'));
      }
      collecting = true;
      current = [];
      continue;
    }

    if (collecting && /^#{1,2}\s+/.test(line)) {
      if (current.length > 0) blocks.push(current.join('\n'));
      collecting = false;
      current = [];
      continue;
    }

    if (collecting) current.push(line);
  }

  if (collecting && current.length > 0) blocks.push(current.join('\n'));
  return blocks;
}

export function visualValidator(md: string): VisualValidationResult {
  const hasTable = hasTableIn(md);
  const hasHtmlDiagram = hasMermaidDiagramIn(md);

  const level3Blocks = extractLevel3Blocks(md);
  const hasRequiredSubsection = level3Blocks.length > 0;
  const visualInSubsection = level3Blocks.some((block) => hasQualityMermaidDiagram(block));

  const pass = hasHtmlDiagram && hasRequiredSubsection && visualInSubsection;

  return { hasTable, hasHtmlDiagram, hasAsciiDiagram: false, hasRequiredSubsection, pass };
}

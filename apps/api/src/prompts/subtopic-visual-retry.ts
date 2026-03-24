export function buildVisualRetryPrompt(
  subtopicTitle: string,
  isTechnical: boolean = true,
  allowCodeBlocks: boolean = true,
): string {
  const mermaidRules = 'STRICT Mermaid rules: use ONLY `graph TD` or `graph LR`. Wrap every node label in `["double-quoted label"]`. Use `-->` for arrows and `-->|"edge label"|` for labeled edges. 4–8 nodes max, short labels (< 5 words). Do NOT use subgraph, style, class, sequenceDiagram, classDiagram, stateDiagram, erDiagram, or advanced features.';

  const codeBlockInstruction = isTechnical
    ? allowCodeBlocks
      ? `Do not put narrative or theory inside code blocks — code blocks are for code only. Close all code blocks with \`\`\`. You may include one fenced \`mermaid\` block for a textbook-style diagram. ${mermaidRules} Do not use Markdown tables, raw HTML, or <table> tags as diagrams. Never output raw HTML math markup in prose.`
      : `Do NOT include fenced code blocks for program code or pseudocode. You may include one fenced \`mermaid\` block for a textbook-style diagram. ${mermaidRules} Do not use Markdown tables, raw HTML, or <table> tags as diagrams. Never output raw HTML math markup in prose.`
    : `Do not include code blocks for program code. For a visual diagram only, use one fenced \`mermaid\` block. ${mermaidRules} Do not use Markdown tables, raw HTML, or <table> tags as diagrams. Never output raw HTML math markup in prose. No other code blocks.`;

  return `Rewrite this subtopic in 1100–1300 words. Include one ### visual subsection (descriptive heading, no numbering) containing exactly one fenced \`mermaid\` diagram that substantively maps a ${isTechnical ? 'technical' : 'conceptual'} relationship from this section's content. ${mermaidRules} The visual must carry analytical value — not merely list items. Reject shallow visuals: no generic boxes, no decorative icons, no placeholder labels. Do NOT include ASCII art, text-based diagrams, or raw HTML. ${codeBlockInstruction} Do NOT use the heading "Summary" (reserved for end-of-unit). Start with ## ${subtopicTitle}. Do NOT include a conclusion — the unit has its own summary. Do NOT exceed 1300 words.`;
}

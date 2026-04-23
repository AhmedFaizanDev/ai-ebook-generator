/** Pull math-looking fragments from markdown for source anchors (verbatim, capped). */
export function extractEquationSnippets(markdown: string, maxLines = 24): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (s: string) => {
    const t = s.trim().replace(/\s+/g, ' ');
    if (t.length < 2 || t.length > 800) return;
    if (seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  const disp = /\$\$([\s\S]*?)\$\$/g;
  let m: RegExpExecArray | null;
  while ((m = disp.exec(markdown)) !== null) {
    push(m[1]!);
    if (out.length >= maxLines) return out;
  }

  const inlineDollar = /(?<!\$)\$(?!\s)([^$\n]{1,400})\$(?!\$)/g;
  while ((m = inlineDollar.exec(markdown)) !== null) {
    push(m[1]!);
    if (out.length >= maxLines) return out;
  }

  const paren = /\\\(([\s\S]*?)\\\)/g;
  while ((m = paren.exec(markdown)) !== null) {
    push(m[1]!);
    if (out.length >= maxLines) return out;
  }

  const bracket = /\\\[([\s\S]*?)\\\]/g;
  while ((m = bracket.exec(markdown)) !== null) {
    push(m[1]!);
    if (out.length >= maxLines) return out;
  }

  return out.slice(0, maxLines);
}

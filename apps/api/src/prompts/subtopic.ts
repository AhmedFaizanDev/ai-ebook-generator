import { SubtopicContext } from '@/lib/types';
import { DEFAULT_VISUAL_CONFIG } from '@/lib/types';
import { UNIT_COUNT, SUBTOPICS_PER_UNIT } from '@/lib/config';
import { getPlainProseForNoMath, getUserPromptLanguageFooter, type OutputLanguage } from '@/lib/output-language';

export function buildSubtopicPrompt(ctx: SubtopicContext): string {
  const visuals = ctx.visuals ?? DEFAULT_VISUAL_CONFIG;
  const lang = ctx.outputLanguage;

  const contextLine =
    lang === 'fr'
      ? ctx.prevUnitSummary
        ? `\nContexte de l’unité précédente (à prolonger, sans répéter) :\n${ctx.prevUnitSummary}`
        : ''
      : lang === 'de'
        ? ctx.prevUnitSummary
          ? `\nKontext der vorherigen Einheit (darauf aufbauen, nicht wiederholen):\n${ctx.prevUnitSummary}`
          : ''
        : lang === 'hi'
          ? ctx.prevUnitSummary
            ? `\nपिछली इकाई संदर्भ (आगे बढ़ाएँ, दोहराएँ नहीं):\n${ctx.prevUnitSummary}`
            : ''
          : ctx.prevUnitSummary
            ? `\nPrior unit context (build on this, do not repeat it):\n${ctx.prevUnitSummary}`
            : '';

  const chainLine =
    lang === 'fr'
      ? ctx.prevSubtopicSummary
        ? `\nFil du sous-thème précédent (poursuivre, sans répéter) :\n${ctx.prevSubtopicSummary}`
        : ''
      : lang === 'de'
        ? ctx.prevSubtopicSummary
          ? `\nVorheriges Unterthema (fortsetzen, nicht wiederholen):\n${ctx.prevSubtopicSummary}`
          : ''
        : lang === 'hi'
          ? ctx.prevSubtopicSummary
            ? `\nपिछला उप-विषय प्रवाह (जारी रखें, दोहराएँ नहीं):\n${ctx.prevSubtopicSummary}`
            : ''
          : ctx.prevSubtopicSummary
            ? `\nPrevious subtopic flow (continue from this, do not repeat):\n${ctx.prevSubtopicSummary}`
            : '';

  const positionHint =
    lang === 'fr'
      ? ctx.subtopicIndex === 0
        ? 'Ouverture d’unité : posez la thématique centrale.'
        : ctx.subtopicIndex === SUBTOPICS_PER_UNIT - 1
          ? 'Clôture d’unité : synthétisez et ouvrez sur la suite.'
          : ''
      : lang === 'de'
        ? ctx.subtopicIndex === 0
          ? 'Einheitseröffnung: zentrales Thema setzen.'
          : ctx.subtopicIndex === SUBTOPICS_PER_UNIT - 1
            ? 'Einheitsschluss: zusammenfassen und Ausblick.'
            : ''
        : lang === 'hi'
          ? ctx.subtopicIndex === 0
            ? 'इकाई आरंभ: केंद्रीय विषय स्थापित करें।'
            : ctx.subtopicIndex === SUBTOPICS_PER_UNIT - 1
              ? 'इकाई समापन: संक्षेप और आगे का संकेत।'
              : ''
          : ctx.subtopicIndex === 0
            ? 'This is the unit opener — establish the unit\'s central theme.'
            : ctx.subtopicIndex === SUBTOPICS_PER_UNIT - 1
              ? 'This is the unit closer — synthesize and point forward.'
              : '';

  const positionLine = positionHint ? `\n${positionHint}` : '';

  const unitNum = ctx.unitIndex + 1;
  const subNum = ctx.subtopicIndex + 1;
  const sectionId = `${unitNum}.${subNum}`;

  const mathRule = visuals.equations.enabled
    ? lang === 'fr'
      ? 'Lorsqu’une relation mathématique exige une notation symbolique, utilisez les délimiteurs LaTeX : inline \\(...\\) et display \\[...\\]. N’utilisez pas $...$ ni $$...$$. Fermez chaque délimiteur. Regroupez chaque formule complète dans un seul bloc \\[...\\] ; définissez les symboles en prose dans le paragraphe suivant. Pour la multiplication dans les sommes ou produits, utilisez \\cdot ou \\times uniquement — jamais \\square ni \\Box.'
      : lang === 'de'
        ? 'Bei Bedarf an symbolischer Notation: LaTeX inline \\(...\\) und Display \\[...\\]. Kein $...$ oder $$...$$. Delimiter schließen. Jede vollständige Formel in einem \\[...\\]-Block; Symbole danach in Prosa erklären. Multiplikation mit \\cdot oder \\times — nie \\square oder \\Box.'
        : lang === 'hi'
          ? 'प्रतीकात्मक संकेतन के लिए LaTeX: इनलाइन \\(...\\) और डिस्प्ले \\[...\\]। $...$ या $$...$$ नहीं। सभी delimiter बंद करें। पूर्ण सूत्र एक \\[...\\] ब्लॉक में; प्रतीकों का वर्णन अगले अनुच्छेद में। गुणन के लिए \\cdot या \\times — \\square या \\Box नहीं।'
          : 'When a mathematical relationship genuinely needs symbolic notation, use LaTeX delimiters: inline \\(...\\) and display \\[...\\]. Do NOT use $...$ or $$...$$. Ensure every delimiter is closed. Put each complete formula in a single \\[...\\] block (e.g. attention, softmax, norms); do not split one equation across multiple blocks. After a display equation, define symbols in normal prose in the following paragraph (e.g. "Here Q, K, and V denote..."), not as a separate pseudo-equation per symbol. For multiplication inside sums, products, or fractions use \\cdot or \\times only — never \\square or \\Box (those render as empty boxes in print).'
    : lang !== 'en'
      ? getPlainProseForNoMath(lang)
      : 'Do NOT use mathematical equations, formulas, symbolic notation, or LaTeX-style expressions; explain quantitative relationships in plain prose.';

  const mermaidRule = visuals.mermaid.enabled
    ? lang === 'fr'
      ? 'Lorsqu’un schéma aide la compréhension, utilisez un bloc \`\`\`mermaid (graph TD ou graph LR uniquement, libellés de nœuds entre guillemets, 3 à 10 nœuds). Pas d’art ASCII.'
      : lang === 'de'
        ? 'Bei Diagrammbedarf: \`\`\`mermaid mit nur graph TD oder graph LR; Knotenbeschriftungen in Anführungszeichen; 3–10 Knoten. Kein ASCII-Art.'
        : lang === 'hi'
          ? 'आरेख के लिए \`\`\`mermaid — केवल graph TD या graph LR; उद्धृत नोड लेबल; 3–10 नोड। ASCII नहीं।'
          : 'When a concept benefits from a diagram, use a fenced ```mermaid block (graph TD or graph LR only, quoted node labels, 3–10 nodes). Do NOT use ASCII art.'
    : lang === 'fr'
      ? 'N’incluez pas d’art ASCII ni de pseudo-diagrammes texte.'
      : lang === 'de'
        ? 'Kein ASCII-Art oder Text-Pseudodiagramme.'
        : lang === 'hi'
          ? 'ASCII या पाठ-आरेख नहीं।'
          : 'Do NOT include ASCII art or text-based diagrams.';

  const midHeadingRule =
    lang === 'fr'
      ? 'N’utilisez pas le titre « Synthèse » ici (réservé à la fin d’unité) ; utilisez « Conclusion » ou « Points clés » pour un bilan de milieu de section.'
      : lang === 'de'
        ? 'Verwenden Sie nicht die Überschrift „Zusammenfassung“ hier (reserviert für das Ende der Einheit); für Zwischenfazits „Fazit“ oder „Kernpunkte“.'
        : lang === 'hi'
          ? 'यहाँ « सारांश » शीर्षक न डालें (इकाई के अंत के लिए आरक्षित); मध्य में « निष्कर्ष » या « मुख्य बिंदु » उपयोग करें।'
          : 'Do NOT use the heading "Summary" here (reserved for end-of-unit); use "Conclusion" or "Key Takeaways" if you need a mid-section wrap-up.';

  const techBlock =
    ctx.isTechnical
      ? lang === 'fr'
        ? 'Utilisez des blocs de code seulement pour la programmation, l’ingénierie logicielle ou l’informatique — pas pour la finance ni l’économie (prose et tableaux). Pas de narration dans les blocs de code. Si vous incluez du code, ajoutez un bloc \`output\` pour le résultat attendu et fermez avec ```. Pas de HTML brut dans la prose. Pas de blocs ```html pour les figures.'
        : lang === 'de'
          ? 'Codeblöcke nur für Programmierung, Softwaretechnik oder Informatik — nicht für Finanzen (Prosa und Tabellen). Keine Erzählung in Codeblöcken. Bei Code: \`output\`-Block für erwartete Ausgabe; mit \`\`\` schließen. Kein rohes HTML. Keine ```html-Figuren.'
          : lang === 'hi'
            ? 'कोड ब्लॉक केवल प्रोग्रामिंग/सॉफ्टवेयर/कंप्यूटर विज्ञान — वित्त नहीं। कोड में कथा नहीं। कोड हो तो \`output\` ब्लॉक; \`\`\` से बंद। कच्चा HTML नहीं। ```html नहीं।'
            : 'Use code blocks only when the topic is programming, software engineering, or computer science — not for finance, economics, stock market, or business analysis (use prose and tables for those). Do not put narrative or theory inside code blocks. When you do include code, use a fenced block labeled `output` for expected output and close with ```. Do NOT use raw HTML in prose. Do NOT use ```html blocks for diagrams or figures.'
      : lang === 'fr'
        ? 'Pas de blocs de code, pas de HTML brut ni de balisage. Pas de ```html pour les figures. Tableaux GFM et prose uniquement.'
        : lang === 'de'
          ? 'Keine Codeblöcke, kein rohes HTML. Keine ```html-Figuren. Nur GFM-Tabellen und Prosa.'
          : lang === 'hi'
            ? 'कोड/HTML/```html नहीं। केवल GFM तालिका और गद्य।'
            : 'Do NOT include code blocks, raw HTML, or markup. Do NOT use ```html for diagrams (it does not render as a real image in the book). Use tables and prose only; no HTML diagrams.';

  if (lang === 'fr') {
    return `Livre : « ${ctx.topic} »
Unité ${unitNum}/${UNIT_COUNT} : « ${ctx.unitTitle} »
Sous-thème ${subNum}/${SUBTOPICS_PER_UNIT} : « ${ctx.subtopicTitle} »${contextLine}${chainLine}${positionLine}

Rédigez 1100 à 1300 mots. Commencez par ## ${sectionId} ${ctx.subtopicTitle}. Utilisez des ### (texte descriptif, sans numérotation) pour les sous-sections. Numérotation limitée à deux niveaux (unités et sous-thèmes). Ouvrez sur un problème ou concept central — pas d’introduction uniquement définitoire. Incluez une sous-section ### avec un tableau GFM porteur de sens (données ou comparaison ; pas de longs paragraphes dans les cellules). ${mermaidRule} ${techBlock} Utilisez des listes numérotées ou à puces ; jamais des listes en paragraphe continu. Terminez sur une implication ou une ouverture, pas sur un récapitulatif long. N’ajoutez pas de section « conclusion » de sous-chapitre — l’unité a sa propre synthèse. ${midHeadingRule} Pas de fausse page de titre ni de titre de livre dupliqué. ${mathRule} Ne dépassez pas 1300 mots.${getUserPromptLanguageFooter(ctx.outputLanguage)}`;
  }

  if (lang === 'de') {
    return `Buch: „${ctx.topic}“
Einheit ${unitNum}/${UNIT_COUNT}: „${ctx.unitTitle}“
Unterthema ${subNum}/${SUBTOPICS_PER_UNIT}: „${ctx.subtopicTitle}“${contextLine}${chainLine}${positionLine}

Schreiben Sie 1100–1300 Wörter. Beginnen Sie mit ## ${sectionId} ${ctx.subtopicTitle}. ### mit beschreibendem Text (ohne Nummer) für Unterabschnitte. Nummerierung nur auf zwei Ebenen. Einstieg mit zentralem Problem oder Konzept — nicht nur Definition. Ein ### mit aussagekräftiger GFM-Tabelle (Daten/Vergleich; keine langen Textzellen). ${mermaidRule} ${techBlock} Nummerierte oder Aufzählungslisten; niemals Listen als Fließtext. Schluss mit Implikation oder Ausblick, nicht mit langem Recap. Kein eigenes Unterkapitel-„Fazit“ — die Einheit hat eine abschließende Zusammenfassung. ${midHeadingRule} Keine Schein-Titelseite oder doppelter Buchtitel. ${mathRule} Maximal 1300 Wörter.${getUserPromptLanguageFooter(ctx.outputLanguage)}`;
  }

  if (lang === 'hi') {
    return `पुस्तक: "${ctx.topic}"
इकाई ${unitNum}/${UNIT_COUNT}: "${ctx.unitTitle}"
उप-विषय ${subNum}/${SUBTOPICS_PER_UNIT}: "${ctx.subtopicTitle}"${contextLine}${chainLine}${positionLine}

1100–1300 शब्द। ## ${sectionId} ${ctx.subtopicTitle} से शुरू करें। उप-अनुभागों के लिए ### (वर्णनात्मक, बिना संख्या)। केवल दो स्तर क्रमांकन। केंद्रीय समस्या या अवधारणा से खोलें — केवल परिभाषा नहीं। एक ### GFM तालिका (डेटा/तुलना; कोशिकाओं में लंबा गद्य नहीं)। ${mermaidRule} ${techBlock} क्रमांकित या बुलेट सूची; कभी अनुच्छेद में सूची नहीं। निहितार्थ या आगे के संकेत पर समाप्त करें। उप-अध्याय में अलग निष्कर्ष अनुभाग नहीं — इकाई का अपना सारांश है। ${midHeadingRule} नकली शीर्ष पृष्ठ नहीं। ${mathRule} अधिकतम 1300 शब्द।${getUserPromptLanguageFooter(ctx.outputLanguage)}`;
  }

  return `Book: "${ctx.topic}"
Unit ${unitNum}/${UNIT_COUNT}: "${ctx.unitTitle}"
Subtopic ${subNum}/${SUBTOPICS_PER_UNIT}: "${ctx.subtopicTitle}"${contextLine}${chainLine}${positionLine}

Write 1100–1300 words. Start with ## ${sectionId} ${ctx.subtopicTitle}. Use ### headings (descriptive text only, no numbering) for sub-sections within this subtopic. Numbering is limited to 2 levels only (Units and Topics) — do NOT number sub-sections. Open with the central problem or concept — not a definition paragraph. Include a ### subsection with a GFM table that carries analytical weight (tables only for data or comparison; never put paragraph narrative in table cells). ${mermaidRule} ${ctx.isTechnical ? 'Use code blocks only when the topic is programming, software engineering, or computer science — not for finance, economics, stock market, or business analysis (use prose and tables for those). Do not put narrative or theory inside code blocks. When you do include code, use a fenced block labeled `output` for expected output and close with ```. Do NOT use raw HTML in prose. Do NOT use ```html blocks for diagrams or figures.' : 'Do NOT include code blocks, raw HTML, or markup. Do NOT use ```html for diagrams (it does not render as a real image in the book). Use tables and prose only; no HTML diagrams.'} Use numbered lists (1. 2. 3.) or bullet lists (- or *) for lists; never render lists as plain paragraphs. Close with an implication or forward reference, not a recap. Do NOT include a conclusion section — the unit has its own summary. Do NOT use the heading "Summary" here (reserved for end-of-unit); use "Conclusion" or "Key Takeaways" if you need a mid-section wrap-up. Do not add an inner title page or duplicate book title. ${mathRule} Do NOT exceed 1300 words.${getUserPromptLanguageFooter(ctx.outputLanguage)}`;
}

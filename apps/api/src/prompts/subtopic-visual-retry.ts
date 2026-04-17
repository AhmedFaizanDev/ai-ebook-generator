import type { VisualConfig, ContentBlockError } from '@/lib/types';
import { DEFAULT_VISUAL_CONFIG } from '@/lib/types';
import { getPlainProseForNoMath, getUserPromptLanguageFooterShort, type OutputLanguage } from '@/lib/output-language';

export function buildVisualRetryPrompt(
  subtopicTitle: string,
  isTechnical: boolean = true,
  visuals: VisualConfig = DEFAULT_VISUAL_CONFIG,
  errors: ContentBlockError[] = [],
  outputLanguage: OutputLanguage = 'en',
): string {
  const codeBlockInstruction =
    outputLanguage === 'fr'
      ? isTechnical
        ? 'Utilisez des blocs de code uniquement pour la programmologie / informatique — pas pour la finance, l’économie ou l’analyse d’entreprise (prose et tableaux). Pas de HTML brut ni de ```html pour les schémas. Fermez tous les blocs avec ```.'
        : 'N’incluez pas de blocs de code, HTML brut ni balisage. Pas de ```html pour les schémas. Tableaux et prose uniquement.'
      : outputLanguage === 'de'
        ? isTechnical
          ? 'Codeblöcke nur für Programmierung/Informatik — nicht für Finanzen oder Wirtschaft (Prosa und Tabellen). Kein rohes HTML oder ```html für Diagramme. Alle Blöcke mit ``` schließen.'
          : 'Keine Codeblöcke, kein rohes HTML. Keine ```html-Diagramme. Nur Tabellen und Prosa.'
        : outputLanguage === 'hi'
          ? isTechnical
            ? 'कोड ब्लॉक केवल प्रोग्रामिंग/कंप्यूटर विज्ञान — वित्त नहीं। कच्चा HTML या ```html आरेख नहीं। ब्लॉक ``` से बंद करें।'
            : 'कोड/HTML नहीं। ```html नहीं। केवल तालिका और गद्य।'
          : isTechnical
            ? 'Use code blocks only for programming/software/CS topics — not for finance, economics, or business analysis (use prose and tables). Do not use raw HTML or ```html for diagrams. Close all code blocks with ```.'
            : 'Do NOT include code blocks, raw HTML, or markup. Do NOT use ```html for diagrams. Use tables and prose only.';

  const mathRule = visuals.equations.enabled
    ? outputLanguage === 'fr'
      ? 'Pour les formules, utilisez uniquement \\(...\\) en ligne et \\[...\\] en bloc. Pas de $...$ ni $$...$$. Fermez chaque délimiteur. Utilisez \\cdot ou \\times pour la multiplication — pas \\square ni \\Box.'
      : outputLanguage === 'de'
        ? 'Formeln nur mit \\(...\\) inline und \\[...\\] Display. Kein $...$ oder $$...$$. Delimiter schließen. \\cdot oder \\times — nie \\square oder \\Box.'
        : outputLanguage === 'hi'
          ? 'सूत्रों के लिए केवल \\(...\\) और \\[...\\]। $...$ नहीं। delimiter बंद करें। \\cdot या \\times।'
          : 'When using math, use LaTeX delimiters \\(...\\) for inline and \\[...\\] for display only. No $...$ or $$...$$. Ensure every delimiter is closed. Use \\cdot or \\times for multiplication — not \\square or \\Box.'
    : getPlainProseForNoMath(outputLanguage);

  const mermaidRule = visuals.mermaid.enabled
    ? outputLanguage === 'fr'
      ? 'Les diagrammes Mermaid doivent être dans des blocs ```mermaid avec graph TD ou graph LR uniquement, libellés de nœuds entre guillemets, et 3 à 10 nœuds.'
      : outputLanguage === 'de'
        ? 'Mermaid nur in ```mermaid mit graph TD oder graph LR; Knotenbeschriftungen in Anführungszeichen; 3–10 Knoten.'
        : outputLanguage === 'hi'
          ? '```mermaid — केवल graph TD/LR; उद्धृत नोड; 3–10 नोड।'
          : 'Mermaid diagrams must use ```mermaid blocks with graph TD or graph LR only, quoted node labels, and 3–10 nodes.'
    : outputLanguage === 'fr'
      ? 'N’incluez pas d’art ASCII ni de schémas textuels.'
      : outputLanguage === 'de'
        ? 'Kein ASCII-Art oder Textdiagramme.'
        : outputLanguage === 'hi'
          ? 'ASCII या पाठ-आरेख नहीं।'
          : 'Do NOT include ASCII art or text-based diagrams.';

  const errorFixes =
    errors.length > 0
      ? outputLanguage === 'fr'
        ? '\n\nCorrigez ces points issus de la tentative précédente :\n' +
          errors.map((e, i) => `${i + 1}. [${e.type}] ${e.message}`).join('\n')
        : outputLanguage === 'de'
          ? '\n\nBeheben Sie diese Punkte aus dem vorherigen Versuch:\n' +
            errors.map((e, i) => `${i + 1}. [${e.type}] ${e.message}`).join('\n')
          : outputLanguage === 'hi'
            ? '\n\nपिछले प्रयास की समस्याएँ ठीक करें:\n' + errors.map((e, i) => `${i + 1}. [${e.type}] ${e.message}`).join('\n')
            : '\n\nFix these specific issues from the previous attempt:\n' +
              errors.map((e, i) => `${i + 1}. [${e.type}] ${e.message}`).join('\n')
      : '';

  const midSummaryRule =
    outputLanguage === 'fr'
      ? 'N’utilisez pas le titre « Synthèse » ici (réservé à la fin d’unité) ; utilisez « Conclusion » ou « Points clés » pour un bilan intermédiaire.'
      : outputLanguage === 'de'
        ? 'Verwenden Sie nicht „Zusammenfassung“ hier (Ende der Einheit); für Zwischenfazits „Fazit“ oder „Kernpunkte“.'
        : outputLanguage === 'hi'
          ? 'यहाँ « सारांश » शीर्षक नहीं (इकाई अंत के लिए); मध्य में « निष्कर्ष » या « मुख्य बिंदु »।'
          : 'Do NOT use the heading "Summary" (reserved for end-of-unit).';

  if (outputLanguage === 'fr') {
    return `Réécrivez ce sous-thème sur 1100 à 1300 mots. Incluez une sous-section ### (titre descriptif, sans numérotation) contenant un tableau GFM qui compare, oppose ou cartographie de façon substantielle une relation ${isTechnical ? 'technique' : 'conceptuelle'} tirée du contenu de cette section. L’élément visuel doit avoir une valeur analytique — pas une simple liste. ${mermaidRule} Tableaux réservés aux données ou comparaisons ; pas de longues phrases dans les cellules. ${codeBlockInstruction} ${midSummaryRule} Commencez par ## ${subtopicTitle}. Pas de conclusion de sous-chapitre — l’unité a sa propre synthèse. ${mathRule} Ne dépassez pas 1300 mots.${errorFixes}${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Schreiben Sie dieses Unterthema in 1100–1300 Wörtern neu. Fügen Sie einen ###-Abschnitt (beschreibende Überschrift) mit einer GFM-Tabelle hinzu, die eine ${isTechnical ? 'technische' : 'konzeptuelle'} Beziehung aus dem Inhalt analytisch abbildet. ${mermaidRule} Tabellen nur für Daten/Vergleiche. ${codeBlockInstruction} ${midSummaryRule} Beginnen Sie mit ## ${subtopicTitle}. Kein Unterkapitel-Schluss — die Einheit hat eine Zusammenfassung. ${mathRule} Maximal 1300 Wörter.${errorFixes}${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `इस उप-विषय को 1100–1300 शब्दों में फिर लिखें। एक ### उप-अनुभाग जोड़ें (वर्णनात्मक शीर्षक) जिसमें GFM तालिका हो जो इस अनुभाग की ${isTechnical ? 'तकनीकी' : 'संकल्पनात्मक'} संबंध को दर्शाए। ${mermaidRule} ${codeBlockInstruction} ${midSummaryRule} ## ${subtopicTitle} से शुरू करें। उप-अध्याय निष्कर्ष नहीं — इकाई का सारांश अलग है। ${mathRule} अधिकतम 1300 शब्द।${errorFixes}${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Rewrite this subtopic in 1100–1300 words. Include a ### subsection (descriptive heading, no numbering) containing a GFM table that substantively compares, contrasts, or maps a ${isTechnical ? 'technical' : 'conceptual'} relationship from this section's content. The visual must carry analytical value — not merely list items. ${mermaidRule} Use tables only for data/comparison; do not put long prose in tables. ${codeBlockInstruction} Do NOT use the heading "Summary" (reserved for end-of-unit). Start with ## ${subtopicTitle}. Do NOT include a conclusion — the unit has its own summary. ${mathRule} Do NOT exceed 1300 words.${errorFixes}${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

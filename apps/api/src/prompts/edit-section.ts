import type { OutputLanguage } from '@/lib/output-language';
import { getUserPromptLanguageFooterShort } from '@/lib/output-language';

export type EditAction = 'expand' | 'rewrite' | 'add_example' | 'add_table' | 'shorten';

const ACTION_INSTRUCTIONS: Record<EditAction, string> = {
  expand: 'Expand the selected passage with more technical depth, examples, and detail. Double its length. Keep the same heading level and Markdown formatting. Output the expanded version that replaces the selected passage.',
  rewrite: 'Rewrite the selected passage to improve clarity, accuracy, and technical depth. Keep the same length and heading level. Output the rewritten version that replaces the selected passage.',
  add_example: 'Reproduce the selected passage exactly, then immediately after it add a practical, runnable code example that demonstrates the concept. Use a fenced code block with the appropriate language tag. Output the original passage followed by the new example.',
  add_table: 'Reproduce the selected passage exactly, then immediately after it add a comparison or summary table that organizes the key concepts into a GFM Markdown table (| col | col |). Output the original passage followed by the new table.',
  shorten: 'Condense the selected passage to half its current length. Preserve all key technical facts. Remove redundancy and filler. Output the shortened version that replaces the selected passage.',
};

const ACTION_INSTRUCTIONS_FR: Record<EditAction, string> = {
  expand:
    'Développez le passage sélectionné avec davantage de profondeur technique, d’exemples et de détails. Doublez sa longueur. Conservez le même niveau de titre et le format Markdown. Produisez uniquement la version développée qui remplace le passage sélectionné.',
  rewrite:
    'Réécrivez le passage sélectionné pour améliorer clarté, exactitude et profondeur technique. Conservez la même longueur et le même niveau de titre. Produisez uniquement la version réécrite qui remplace le passage sélectionné.',
  add_example:
    'Reproduisez exactement le passage sélectionné, puis ajoutez immédiatement après un exemple de code pratique et exécutable illustrant la notion. Utilisez un bloc de code avec la balise de langue appropriée. Produisez le passage original suivi du nouvel exemple.',
  add_table:
    'Reproduisez exactement le passage sélectionné, puis ajoutez immédiatement après un tableau comparatif ou de synthèse au format Markdown GFM (| col | col |). Produisez le passage original suivi du nouveau tableau.',
  shorten:
    'Condensez le passage sélectionné à la moitié de sa longueur actuelle. Conservez tous les faits techniques essentiels. Supprimez redondances et remplissage. Produisez uniquement la version condensée qui remplace le passage sélectionné.',
};

const ACTION_INSTRUCTIONS_DE: Record<EditAction, string> = {
  expand:
    'Erweitern Sie den markierten Abschnitt mit mehr technischer Tiefe, Beispielen und Details. Verdoppeln Sie die Länge. Überschriftenebene und Markdown beibehalten. Nur den erweiterten Ersatztext ausgeben.',
  rewrite:
    'Schreiben Sie den Abschnitt neu für Klarheit, Korrektheit und technische Tiefe. Gleiche Länge und Überschriftenebene. Nur die neue Version ausgeben.',
  add_example:
    'Reproduzieren Sie den Abschnitt exakt, fügen Sie danach ein praktisches, ausführbares Codebeispiel hinzu (fenced code block mit Sprach-Tag). Original plus Beispiel ausgeben.',
  add_table:
    'Reproduzieren Sie den Abschnitt exakt, fügen Sie danach eine GFM-Vergleichs- oder Übersichtstabelle (| col | col |) hinzu. Original plus Tabelle ausgeben.',
  shorten:
    'Kürzen Sie auf die halbe Länge. Wichtige technische Fakten behalten. Redundanz entfernen. Nur die gekürzte Version ausgeben.',
};

const ACTION_INSTRUCTIONS_HI: Record<EditAction, string> = {
  expand:
    'चयनित अंश को अधिक तकनीकी गहराई, उदाहरणों और विवरण के साथ विस्तृत करें। लंबाई दोगुनी करें। शीर्षक स्तर और Markdown बनाए रखें। केवल विस्तृत प्रतिस्थापन आउटपुट करें।',
  rewrite:
    'स्पष्टता, शुद्धता और तकनीकी गहराई के लिए पुनर्लेखन। समान लंबाई और शीर्षक स्तर। केवल नया संस्करण।',
  add_example:
    'अंश ठीक दोहराएँ, तुरंत बाद एक व्यावहारिक चलाया जा सकने वाला कोड उदाहरण जोड़ें (उपयुक्त भाषा टैग वाला fenced ब्लॉक)। मूल + उदाहरण।',
  add_table:
    'अंश ठीक दोहराएँ, फिर GFM तालिका (| col | col |) जोड़ें। मूल + तालिका।',
  shorten:
    'वर्तमान लंबाई का आधा करें। मुख्य तकनीकी तथ्य सुरक्षित रखें। केवल संक्षिप्त संस्करण।',
};

const ACTION_BY_LANG: Record<OutputLanguage, Record<EditAction, string>> = {
  en: ACTION_INSTRUCTIONS,
  fr: ACTION_INSTRUCTIONS_FR,
  de: ACTION_INSTRUCTIONS_DE,
  hi: ACTION_INSTRUCTIONS_HI,
};

function actionInstructions(action: EditAction, outputLanguage: OutputLanguage): string {
  return ACTION_BY_LANG[outputLanguage][action];
}

export function buildEditSectionPrompt(
  fullMarkdown: string,
  selectedText: string,
  action: EditAction,
  outputLanguage: OutputLanguage = 'en',
): string {
  if (outputLanguage === 'fr') {
    return `Vous modifiez un passage à l’intérieur d’une section d’un ebook technique. Produisez UNIQUEMENT le résultat en Markdown brut — aucune explication, aucun contenu environnant.

SECTION COMPLÈTE (contexte uniquement — ne la reproduisez pas) :
---
${fullMarkdown}
---

PASSAGE SÉLECTIONNÉ :
---
${selectedText}
---

CONSIGNE : ${actionInstructions(action, outputLanguage)}

Produisez uniquement du Markdown brut. Harmonisez le style de mise en forme existant. Pas de préambule ni d’explication. N’incluez pas de HTML brut, de blocs \`\`\`html, de SVG ni de balisage de diagramme — uniquement tableaux GFM et prose.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Sie bearbeiten einen Abschnitt innerhalb eines technischen E-Book-Kapitels. Ausgabe NUR als rohes Markdown — keine Erklärung, kein Rahmentext.

VOLLER ABSCHNITT (nur Kontext — nicht reproduzieren):
---
${fullMarkdown}
---

AUSWAHL:
---
${selectedText}
---

ANWEISUNG: ${actionInstructions(action, outputLanguage)}

Nur rohes Markdown. Stil beibehalten. Kein HTML, keine \`\`\`html- oder SVG-Diagramme — nur GFM-Tabellen und Prosa.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `आप एक तकनीकी ई-पुस्तक अनुभाग के भीतर एक अंश संपादित कर रहे हैं। केवल कच्चा Markdown आउटपुट — कोई व्याख्या नहीं।

पूरा अनुभाग (केवल संदर्भ — पुनः न लिखें):
---
${fullMarkdown}
---

चयनित अंश:
---
${selectedText}
---

निर्देश: ${actionInstructions(action, outputLanguage)}

केवल Markdown। HTML/\`\`\`html/SVG आरेख नहीं — केवल GFM तालिका और गद्य।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `You are editing one passage inside a larger technical ebook section. Output ONLY the result in raw Markdown — no explanation, no surrounding content.

FULL SECTION (for context only — do NOT reproduce it):
---
${fullMarkdown}
---

SELECTED PASSAGE:
---
${selectedText}
---

INSTRUCTION: ${actionInstructions(action, outputLanguage)}

Output raw Markdown only. Match the existing formatting style. No preamble or explanation. Do NOT include raw HTML, \`\`\`html blocks, SVG, or diagram markup — use GFM tables and prose only.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

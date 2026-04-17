import { SUBTOPICS_PER_UNIT } from '@/lib/config';
import type { OutputLanguage } from '@/lib/output-language';
import { getUserPromptLanguageFooterShort } from '@/lib/output-language';

export function buildUnitIntroductionPrompt(
  topic: string,
  unitIndex: number,
  unitTitle: string,
  subtopicTitles: string[],
  outputLanguage: OutputLanguage = 'en',
): string {
  const outline = subtopicTitles.map((t, i) => `${unitIndex + 1}.${i + 1} ${t}`).join('\n');

  if (outputLanguage === 'fr') {
    return `Livre : « ${topic} »
Unité ${unitIndex + 1} : « ${unitTitle} »

Sous-thèmes couverts dans cette unité :
${outline}

Rédigez une introduction académique de 2 à 3 paragraphes (300 à 400 mots). N’utilisez pas de titre Markdown — le titre d’unité figure déjà au-dessus.

Incluez :
1. Une vue d’ensemble narrative de l’unité et de son importance pour « ${topic} »
2. Les prérequis ou connaissances supposées
3. Trois à cinq objectifs d’apprentissage explicites sous forme de liste numérotée, introduits par la phrase : « À la fin de cette unité, le lecteur sera capable de : »

Ton : formel, neutre, niveau premier cycle. Pas de style conversationnel. Pas de remplissage. Pas de HTML brut, pas de \`\`\`html, pas de SVG ni de diagrammes en balisage. Ne dépassez pas 400 mots.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Buch: „${topic}“
Einheit ${unitIndex + 1}: „${unitTitle}“

Unterthemen in dieser Einheit:
${outline}

Schreiben Sie eine akademische Einleitung in 2–3 Absätzen (300–400 Wörter). Keine Markdown-Überschrift — der Einheitstitel steht bereits darüber.

Enthalten Sie:
1. Narrativen Überblick und Bedeutung für „${topic}“
2. Vorausgesetzte Vorkenntnisse
3. 3–5 explizite Lernziele als nummerierte Liste, eingeleitet mit: „Am Ende dieser Einheit können Lernende:“

Ton: formell, neutral. Kein Fülltext. Kein HTML/\`\`\`html/SVG. Maximal 400 Wörter.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `पुस्तक: "${topic}"
इकाई ${unitIndex + 1}: "${unitTitle}"

इस इकाई में उप-विषय:
${outline}

2–3 अनुच्छेदों में शैक्षणिक परिचय (300–400 शब्द)। Markdown शीर्षक नहीं — इकाई शीर्षक पहले से है।

शामिल करें:
1. "${topic}" संदर्भ में इकाई का सार और महत्व
2. मान्य पूर्वज्ञान
3. 3–5 स्पष्ट सीखने के उद्देश्य क्रमांकित सूची में, इस वाक्य से: « इस इकाई के अंत तक, शिक्षार्थी सक्षम होंगे: »

टोन: औपचारिक। भराव नहीं। HTML/SVG नहीं। अधिकतम 400 शब्द।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Book: "${topic}"
Unit ${unitIndex + 1}: "${unitTitle}"

Subtopics covered in this unit:
${outline}

Write a 2–3 paragraph academic introduction for this unit (300–400 words). Do NOT use a heading — the unit heading is already placed above this text.

Include:
1. A narrative overview of what this unit covers and why it matters in the context of "${topic}"
2. Assumed prerequisites or prior knowledge the reader should have
3. 3–5 explicit learning objectives as a numbered list, prefixed with "By the end of this unit, learners will be able to:"

Tone: formal, neutral, suitable for undergraduate learners. No conversational language. No filler. Do NOT include raw HTML, \`\`\`html blocks, SVG, or diagram markup. Do NOT exceed 400 words.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

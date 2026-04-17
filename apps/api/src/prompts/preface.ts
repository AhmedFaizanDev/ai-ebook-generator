import { UNIT_COUNT, SUBTOPICS_PER_UNIT } from '@/lib/config';
import type { OutputLanguage } from '@/lib/output-language';
import { getUserPromptLanguageFooterShort, unitOutlineLine } from '@/lib/output-language';

export function buildPrefacePrompt(topic: string, unitTitles: string[], outputLanguage: OutputLanguage = 'en'): string {
  const outline = unitTitles.map((t, i) => unitOutlineLine(outputLanguage, i, t)).join('\n');

  if (outputLanguage === 'fr') {
    return `Livre : « ${topic} »
Structure : ${UNIT_COUNT} unités, ${SUBTOPICS_PER_UNIT} sous-thèmes chacune, plus des projets de synthèse et des études de cas.

Plan des unités :
${outline}

Rédigez une préface professionnelle de 400 à 600 mots. Commencez par la ligne exacte suivante :
## Préface

Incluez :
1. L’objectif et la portée de cet ouvrage
2. Le lectorat visé et les prérequis supposés
3. L’organisation du livre (en vous appuyant sur le plan ci-dessus)
4. Comment tirer le meilleur parti de cet ouvrage
5. Des remerciements sobres (lectrices et lecteurs, communauté académique ou professionnelle)

Rédigez à la première personne du pluriel (« nous »). Ton : accueillant mais professionnel. Pas de remplissage. Pas de HTML brut, pas de blocs \`\`\`html, pas de SVG ni de diagrammes en balisage. Ne dépassez pas 600 mots.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Buch: „${topic}“
Struktur: ${UNIT_COUNT} Einheiten, je ${SUBTOPICS_PER_UNIT} Unterthemen, plus Abschlussprojekte und Fallstudien.

Einheitenüberblick:
${outline}

Schreiben Sie ein professionelles Vorwort (400–600 Wörter). Beginnen Sie exakt mit:
## Vorwort

Enthalten Sie:
1. Zweck und Umfang des Buches
2. Zielgruppe und Voraussetzungen
3. Aufbau des Buches (Bezug auf den obigen Plan)
4. Nutzen für die Leserschaft
5. Zurückhaltende Danksagungen

Wir-Form, Ton: einladend und professionell. Kein Fülltext. Kein HTML, keine \`\`\`html-Blöcke, kein SVG. Maximal 600 Wörter.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `पुस्तक: "${topic}"
संरचना: ${UNIT_COUNT} इकाइयाँ, प्रत्येक में ${SUBTOPICS_PER_UNIT} उपविषय, साथ ही कैपस्टोन और केस अध्ययन।

इकाई योजना:
${outline}

400–600 शब्दों में एक पेशेवर प्रस्तावना लिखें। ठीक इस पंक्ति से आरंभ करें:
## प्रस्तावना

शामिल करें:
1. पुस्तक का उद्देश्य और दायरा
2. लक्षित पाठक और पूर्वापेक्षाएँ
3. पुस्तक की संगठन रूपरेखा (ऊपर की योजना के अनुसार)
4. सर्वाधिक लाभ कैसे उठाएँ
5. संयमित आभार (पाठक और समुदाय)

हम-रूप, टोन: मित्रतापूर्ण लेकिन पेशेवर। भराव नहीं। HTML/\`\`\`html/SVG नहीं। अधिकतम 600 शब्द।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Book: "${topic}"
Structure: ${UNIT_COUNT} units, ${SUBTOPICS_PER_UNIT} subtopics each, plus capstone projects and case studies.

Unit outline:
${outline}

Write a professional book preface in 400–600 words. Start with ## Preface.

Include:
1. The purpose and scope of this book
2. Who the intended audience is and what prerequisites are assumed
3. How the book is organized (reference the unit structure above)
4. How to get the most out of this book
5. Acknowledgments (generic — thank the reader and the technical community)

Write in first-person plural ("we"). Tone: welcoming but professional. No filler. Do NOT include raw HTML, \`\`\`html blocks, SVG, or diagram markup. Do NOT exceed 600 words.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

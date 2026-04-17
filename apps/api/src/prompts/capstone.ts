import type { OutputLanguage } from '@/lib/output-language';
import {
  capstoneH2Line,
  capstoneSubsectionPrefix,
  getUserPromptLanguageFooterShort,
  unitSummaryLabel,
} from '@/lib/output-language';

function capstoneSpecDescription(lang: OutputLanguage, isTechnical: boolean): string {
  if (lang === 'fr') {
    return isTechnical
      ? 'un cahier des charges de projet d’ingénieur senior'
      : 'un cahier des charges de projet appliqué détaillé';
  }
  if (lang === 'de') {
    return isTechnical
      ? 'ein ausführliches Lastenheft auf Senior-Ingenieurniveau'
      : 'ein ausführliches Lastenheft für ein angewandtes Projekt';
  }
  if (lang === 'hi') {
    return isTechnical
      ? 'वरिष्ठ इंजीनियर स्तर की विस्तृत परियोजना विनिर्देश'
      : 'एक लागू परियोजना की विस्तृत विनिर्देश पुस्तिका';
  }
  return isTechnical ? "a senior engineer's project specification" : 'a detailed applied project specification';
}

function capstoneContentGuidance(lang: OutputLanguage, isTechnical: boolean): string {
  if (lang === 'fr') {
    return isTechnical
      ? 'un énoncé de problème concret avec critères de réussite mesurables ; des choix d’architecture avec analyse des compromis ; un plan par phases avec livrables précis ; une grille d’évaluation de la qualité de conception, pas seulement de l’achèvement.'
      : 'un énoncé de problème concret avec critères de réussite mesurables ; un cadre conceptuel et une démarche avec analyse des compromis ; un plan par phases avec livrables précis ; une grille d’évaluation de la profondeur de compréhension et de la qualité, pas seulement de l’achèvement.';
  }
  if (lang === 'de') {
    return isTechnical
      ? 'ein konkretes Problem mit messbaren Erfolgskriterien; Architekturentscheidungen mit Kompromissanalyse; einen phasenweise Umsetzungsplan mit klaren Lieferobjekten; eine Bewertungsmatrix für die Designqualität, nicht nur den Abschluss.'
      : 'ein konkretes Problem mit messbaren Erfolgskriterien; konzeptionelles Vorgehen mit Kompromissanalyse; einen phasenweise Plan mit Lieferobjekten; eine Bewertungsmatrix für Verständnistiefe und Qualität, nicht nur den Abschluss.';
  }
  if (lang === 'hi') {
    return isTechnical
      ? 'मापनीय सफलता मानदंडों के साथ ठोस समस्या कथन; ट्रेड-ऑफ विश्लेषण के साथ वास्तु निर्णय; विशिष्ट परिणामों के साथ चरणबद्ध कार्यान्वयन योजना; केवल पूर्णता नहीं, डिज़ाइन गुणवत्ता का मूल्यांकन करने वाला मापदंड।'
      : 'मापनीय सफलता मानदंडों के साथ ठोस समस्या कथन; ट्रेड-ऑफ विश्लेषण के साथ संकल्पनात्मक ढाँचा; विशिष्ट परिणामों के साथ चरणबद्ध योजना; समझ की गहराई और गुणवत्ता का मूल्यांकन।';
  }
  return isTechnical
    ? 'a concrete problem statement with measurable success criteria; architecture decisions with trade-off analysis; phased implementation plan with specific deliverables; a rubric that evaluates design quality, not just completion.'
    : 'a concrete problem statement with measurable success criteria; conceptual framework and approach with trade-off analysis; phased plan with specific deliverables; a rubric that evaluates depth of understanding and quality, not just completion.';
}

function capstoneContentGuidanceShort(lang: OutputLanguage, isTechnical: boolean): string {
  if (lang === 'fr') {
    return isTechnical
      ? 'Incluez un énoncé de problème concret avec critères mesurables ; des choix d’architecture avec compromis ; un plan par phases avec livrables ; une grille d’évaluation de la qualité de conception.'
      : 'Incluez un énoncé de problème concret avec critères mesurables ; un cadre conceptuel et une démarche avec compromis ; un plan par phases avec livrables ; une grille d’évaluation de la qualité de la compréhension.';
  }
  if (lang === 'de') {
    return isTechnical
      ? 'Konkretes Problem mit messbaren Kriterien; Architektur mit Kompromissen; phasenweiser Plan mit Lieferobjekten; Bewertungsmatrix für die Designqualität.'
      : 'Konkretes Problem mit messbaren Kriterien; konzeptionelles Vorgehen mit Kompromissen; phasenweiser Plan mit Lieferobjekten; Bewertungsmatrix für Verständnisqualität.';
  }
  if (lang === 'hi') {
    return isTechnical
      ? 'मापनीय मानदंडों के साथ ठोस समस्या; समझौता विश्लेषण के साथ वास्तु निर्णय; चरणबद्ध योजना और परिणाम; डिज़ाइन गुणवत्ता का मूल्यांकन।'
      : 'मापनीय मानदंडों के साथ ठोस समस्या; समझौता विश्लेषण के साथ संकल्पना; चरणबद्ध योजना; समझ की गुणवत्ता का मूल्यांकन।';
  }
  return isTechnical
    ? 'Include a concrete problem statement with measurable success criteria; architecture decisions with trade-off analysis; phased implementation plan with specific deliverables; a rubric that evaluates design quality.'
    : 'Include a concrete problem statement with measurable success criteria; conceptual framework and approach with trade-off analysis; phased plan with specific deliverables; a rubric that evaluates depth of understanding and quality.';
}

export function buildCapstonePrompt(
  topic: string,
  index: number,
  capstoneTitle: string,
  allUnitSummaries: string[],
  isTechnical: boolean = true,
  outputLanguage: OutputLanguage = 'en',
): string {
  const summariesBlock = allUnitSummaries
    .map((s, i) => `${unitSummaryLabel(outputLanguage, i)}: ${s}`)
    .join('\n');

  const specDescription = capstoneSpecDescription(outputLanguage, isTechnical);
  const contentGuidance = capstoneContentGuidance(outputLanguage, isTechnical);
  const h2Exact = capstoneH2Line(index, capstoneTitle, outputLanguage);
  const subNum = capstoneSubsectionPrefix(outputLanguage, index);

  if (outputLanguage === 'fr') {
    return `Livre : « ${topic} »
Projet de synthèse ${index + 1}/2 : « ${capstoneTitle} »

Contexte du livre (synthèses d’unité) :
${summariesBlock}

Rédigez 1600 à 1900 mots sous la forme ${specDescription}. Commencez exactement par la ligne suivante (titre de section) :
${h2Exact}
Utilisez des sous-sections ### numérotées ${subNum}.1, ${subNum}.2, etc. Incluez : ${contentGuidance} Référencez des techniques précises du livre le cas échéant. N’incluez pas de HTML brut, de blocs \`\`\`html, de SVG ni de pseudo-diagrammes en balisage ; utilisez uniquement des tableaux GFM et de la prose. Ne dépassez pas 1900 mots.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Buch: „${topic}“
Abschlussprojekt ${index + 1}/2: „${capstoneTitle}“

Kontext (Einheitszusammenfassungen):
${summariesBlock}

Schreiben Sie 1600–1900 Wörter als ${specDescription}. Beginnen Sie exakt mit dieser Überschrift:
${h2Exact}
Verwenden Sie ###-Unterabschnitte nummeriert als ${subNum}.1, ${subNum}.2 usw. Folgendes einbeziehen: ${contentGuidance} Verweisen Sie bei Bedarf auf konkrete Techniken aus dem Buch. Kein rohes HTML, keine \`\`\`html-Blöcke, kein SVG — nur GFM-Tabellen und Prosa. Maximal 1900 Wörter.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `पुस्तक: "${topic}"
कैपस्टोन परियोजना ${index + 1}/2: "${capstoneTitle}"

पुस्तक संदर्भ (इकाई सारांश):
${summariesBlock}

${specDescription} के रूप में 1600–1900 शब्द लिखें। ठीक इस शीर्षक पंक्ति से आरंभ करें:
${h2Exact}
### उप-अनुभाग ${subNum}.1, ${subNum}.2 आदि क्रमांकन के साथ लिखें। शामिल करें: ${contentGuidance} पुस्तक की तकनीकों का उल्लेख करें। कच्चा HTML, \`\`\`html, SVG नहीं — केवल GFM तालिका और गद्य। अधिकतम 1900 शब्द।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Book: "${topic}"
Capstone ${index + 1}/2: "${capstoneTitle}"

Book context (unit summaries):
${summariesBlock}

Write 1600–1900 words as ${specDescription}. Start with exactly this heading line:
${h2Exact}
Use ### sub-sections numbered ${subNum}.1, ${subNum}.2, etc. Include: ${contentGuidance} Reference specific techniques from the book where applicable. Do NOT include raw HTML, \`\`\`html blocks, SVG, or diagram markup — use GFM tables and prose only. Do NOT exceed 1900 words.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

export function buildBatchedCapstonePrompt(
  topic: string,
  capstoneTitles: string[],
  allUnitSummaries: string[],
  isTechnical: boolean = true,
  outputLanguage: OutputLanguage = 'en',
): string {
  const summariesBlock = allUnitSummaries
    .map((s, i) => `${unitSummaryLabel(outputLanguage, i)}: ${s}`)
    .join('\n');

  const titlesBlock = capstoneTitles.map((t, i) => `${i + 1}. "${t}"`).join('\n');
  const titlesBlockFr = capstoneTitles.map((t, i) => `${i + 1}. « ${t} »`).join('\n');
  const titlesBlockDe = capstoneTitles.map((t, i) => `${i + 1}. „${t}“`).join('\n');

  const contentGuidance = capstoneContentGuidanceShort(outputLanguage, isTechnical);

  if (outputLanguage === 'fr') {
    return `Livre : « ${topic} »

Contexte du livre (synthèses d’unité) :
${summariesBlock}

Rédigez ${capstoneTitles.length} projets de synthèse, chacun de 1600 à 1900 mots. Séparez-les par une ligne contenant uniquement « --- ».

Titres des projets :
${titlesBlockFr}

Pour chaque projet : commencez par une ligne ## exactement de la forme « ## Projet de synthèse N : » suivie du titre (N = 1, 2, …). Utilisez des sous-sections ### numérotées « Projet de synthèse N.1 », « Projet de synthèse N.2 », etc. ${contentGuidance} Référencez des techniques du livre. Pas de HTML brut ni de \`\`\`html ; tableaux GFM et prose uniquement. Maximum 1900 mots par projet.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Buch: „${topic}“

Kontext (Einheitszusammenfassungen):
${summariesBlock}

Schreiben Sie ${capstoneTitles.length} Abschlussprojekte, jedes 1600–1900 Wörter. Trennen Sie sie mit einer Zeile, die nur „---“ enthält.

Projekttitel:
${titlesBlockDe}

Jedes Projekt beginnt mit einer ##-Zeile der Form „## Abschlussprojekt N: “ plus Titel (N = 1, 2, …). ###-Unterabschnitte nummerieren als „Abschlussprojekt N.1“, „Abschlussprojekt N.2“ usw. ${contentGuidance} Verweisen Sie auf Buchtechniken. Kein rohes HTML oder \`\`\`html; nur GFM-Tabellen und Prosa. Maximal 1900 Wörter pro Projekt.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    const titlesHi = capstoneTitles.map((t, i) => `${i + 1}. "${t}"`).join('\n');
    return `पुस्तक: "${topic}"

पुस्तक संदर्भ (इकाई सारांश):
${summariesBlock}

${capstoneTitles.length} कैपस्टोन परियोजनाएँ लिखें, प्रत्येक 1600–1900 शब्द। उन्हें केवल "---" वाली पंक्ति से अलग करें।

शीर्षक:
${titlesHi}

प्रत्येक: "## कैपस्टोन परियोजना N: " से शुरू करें (N = 1, 2, …)। ### उप-अनुभाग "कैपस्टोन परियोजना N.1", "कैपस्टोन परियोजना N.2" आदि। ${contentGuidance} पुस्तक की तकनीकों का उल्लेख। HTML/\`\`\`html नहीं; केवल GFM तालिका। प्रति परियोजना अधिकतम 1900 शब्द।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Book: "${topic}"

Book context (unit summaries):
${summariesBlock}

Write ${capstoneTitles.length} capstone projects, each 1600–1900 words. Separate them with a line containing only "---".

Capstone titles:
${titlesBlock}

For each capstone: start with ## Capstone Project N: Title (N = 1, 2, …). Use ### sub-sections numbered Capstone N.1, Capstone N.2, etc. ${contentGuidance} Reference specific techniques from the book. Do NOT include raw HTML, \`\`\`html blocks, SVG, or diagram markup — use GFM tables and prose only. Do NOT exceed 1900 words per capstone.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

import type { OutputLanguage } from '@/lib/output-language';
import {
  caseStudyH2Line,
  caseStudySubsectionPrefix,
  getUserPromptLanguageFooterShort,
  unitSummaryLabel,
} from '@/lib/output-language';

function caseRetroDescription(lang: OutputLanguage, isTechnical: boolean): string {
  if (lang === 'fr') {
    return isTechnical ? 'une rétrospective technique publiée' : 'une rétrospective analytique publiée';
  }
  if (lang === 'de') {
    return isTechnical ? 'eine veröffentlichte technische Retrospektive' : 'eine veröffentlichte analytische Retrospektive';
  }
  if (lang === 'hi') {
    return isTechnical ? 'एक प्रकाशित तकनीकी पुनर्भाव' : 'एक प्रकाशित विश्लेषणात्मक पुनर्भाव';
  }
  return isTechnical ? 'a published technical retrospective' : 'a published analytical retrospective';
}

function caseContentGuidance(lang: OutputLanguage, isTechnical: boolean): string {
  if (lang === 'fr') {
    return isTechnical
      ? 'le défi technique précis et son contexte métier ; des procédures pas à pas avec explications ; la première approche et pourquoi elle a échoué ou était insuffisante ; l’architecture révisée avec détails concrets ; des résultats chiffrés (métriques plausibles inventées) ; des leçons généralisables.'
      : 'le défi précis et son contexte élargi ; une analyse pas à pas avec explications ; la première approche et pourquoi elle était insuffisante ; l’approche révisée avec détails concrets ; des résultats (métriques plausibles inventées) ; des leçons généralisables.';
  }
  if (lang === 'de') {
    return isTechnical
      ? 'konkrete technische Herausforderung und Geschäftskontext; schrittweise Vorgehensweisen mit Erklärungen; erste Lösung und warum sie scheiterte; überarbeitete Architektur mit Umsetzungsdetails; quantitative Ergebnisse (plausible Beispielmetriken); verallgemeinerbare Lehren.'
      : 'konkrete Herausforderung und weiterer Kontext; schrittweise Analyse mit Erklärungen; erste Herangehensweise und ihre Unzulänglichkeit; überarbeiteter Ansatz mit Details; Ergebnisse (plausible Metriken); verallgemeinerbare Lehren.';
  }
  if (lang === 'hi') {
    return isTechnical
      ? 'विशिष्ट तकनीकी चुनौती और व्यावसायिक संदर्भ; चरणबद्ध प्रक्रियाएँ स्पष्टीकरण के साथ; प्रारंभिक दृष्टिकोण और विफलता/अपर्याप्तता का कारण; संशोधित वास्तु विवरण; मात्रात्मक परिणाम (यथार्थवत मेट्रिक्स); सामान्यीकरण योग्य सबक।'
      : 'विशिष्ट चुनौती और व्यापक संदर्भ; चरणबद्ध विश्लेषण; प्रारंभिक दृष्टिकोण और अपर्याप्तता; संशोधित दृष्टिकोण विवरण के साथ; परिणाम (मेट्रिक्स); सामान्यीकरण योग्य सबक।';
  }
  return isTechnical
    ? 'the specific technical challenge and its business context; step-by-step procedures with explanations at each stage; the initial approach and why it failed or was insufficient; the revised architecture with concrete implementation details; quantitative outcomes (use realistic fabricated metrics); lessons that generalize beyond this case.'
    : 'the specific challenge and its broader context; step-by-step analysis with explanations at each stage; the initial approach and why it was insufficient; the revised approach with concrete details; outcomes (use realistic fabricated metrics); lessons that generalize beyond this case.';
}

function caseContentGuidanceShort(lang: OutputLanguage, isTechnical: boolean): string {
  if (lang === 'fr') {
    return isTechnical
      ? 'Défi technique et contexte métier ; procédures pas à pas ; première approche et échec ; architecture révisée avec détails ; résultats chiffrés plausibles ; leçons généralisables.'
      : 'Défi et contexte ; analyse pas à pas ; première approche et insuffisance ; approche révisée avec détails ; résultats plausibles ; leçons généralisables.';
  }
  if (lang === 'de') {
    return isTechnical
      ? 'Technik und Geschäftskontext; Schritt-für-Schritt; erste Lösung und Scheitern; überarbeitete Architektur mit Details; plausible Kennzahlen; Lehren.'
      : 'Herausforderung und Kontext; Analyse Schritt für Schritt; erste Ansätze und Unzulänglichkeit; überarbeiteter Ansatz; plausible Ergebnisse; Lehren.';
  }
  if (lang === 'hi') {
    return isTechnical
      ? 'तकनीकी चुनौती और संदर्भ; चरणबद्ध प्रक्रिया; प्रथम दृष्टिकोण और विफलता; संशोधित वास्तु; मेट्रिक्स; सबक।'
      : 'चुनौती और संदर्भ; चरणबद्ध विश्लेषण; प्रथम दृष्टिकोण; संशोधित दृष्टिकोण; परिणाम; सबक।';
  }
  return isTechnical
    ? 'Include the specific technical challenge and business context; step-by-step procedures with explanations at each stage; the initial approach and why it failed; the revised architecture with concrete implementation details; quantitative outcomes (use realistic fabricated metrics); generalizable lessons.'
    : 'Include the specific challenge and broader context; step-by-step analysis with explanations at each stage; the initial approach and why it was insufficient; the revised approach with concrete details; outcomes (use realistic fabricated metrics); generalizable lessons.';
}

export function buildCaseStudyPrompt(
  topic: string,
  index: number,
  caseStudyTitle: string,
  allUnitSummaries: string[],
  isTechnical: boolean = true,
  outputLanguage: OutputLanguage = 'en',
): string {
  const summariesBlock = allUnitSummaries
    .map((s, i) => `${unitSummaryLabel(outputLanguage, i)}: ${s}`)
    .join('\n');

  const retroDescription = caseRetroDescription(outputLanguage, isTechnical);
  const contentGuidance = caseContentGuidance(outputLanguage, isTechnical);
  const h2Exact = caseStudyH2Line(index, caseStudyTitle, outputLanguage);
  const sub = caseStudySubsectionPrefix(outputLanguage, index);

  if (outputLanguage === 'fr') {
    return `Livre : « ${topic} »
Étude de cas ${index + 1} : « ${caseStudyTitle} »

Contexte du livre (synthèses d’unité) :
${summariesBlock}

Rédigez 1600 à 1900 mots sous la forme ${retroDescription}. Commencez exactement par la ligne suivante :
${h2Exact}
Utilisez des sous-sections ### numérotées ${sub}.1, ${sub}.2, etc. Incluez : ${contentGuidance} Référencez des techniques du livre. Pas de HTML brut ni de \`\`\`html ; tableaux GFM et prose uniquement. Ne dépassez pas 1900 mots.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Buch: „${topic}“
Fallstudie ${index + 1}: „${caseStudyTitle}“

Kontext (Einheitszusammenfassungen):
${summariesBlock}

Schreiben Sie 1600–1900 Wörter als ${retroDescription}. Beginnen Sie exakt mit:
${h2Exact}
###-Unterabschnitte ${sub}.1, ${sub}.2 usw. ${contentGuidance} Buchtechniken einbeziehen. Kein HTML/\`\`\`html; nur GFM-Tabellen und Prosa. Maximal 1900 Wörter.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `पुस्तक: "${topic}"
केस अध्ययन ${index + 1}: "${caseStudyTitle}"

पुस्तक संदर्भ (इकाई सारांश):
${summariesBlock}

${retroDescription} के रूप में 1600–1900 शब्द। ठीक इस पंक्ति से आरंभ:
${h2Exact}
### उप-अनुभाग ${sub}.1, ${sub}.2 आदि। ${contentGuidance} पुस्तक की तकनीकों का उल्लेख। HTML नहीं; GFM तालिका। अधिकतम 1900 शब्द।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Book: "${topic}"
Case Study ${index + 1}: "${caseStudyTitle}"

Book context (unit summaries):
${summariesBlock}

Write 1600–1900 words as ${retroDescription}. Start with exactly this heading line:
${h2Exact}
Use ### sub-sections numbered ${sub}.1, ${sub}.2, etc. Include: ${contentGuidance} Reference specific techniques from the book where applicable. Do NOT include raw HTML, \`\`\`html blocks, SVG, or diagram markup — use GFM tables and prose only. Do NOT exceed 1900 words.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

export function buildBatchedCaseStudyPrompt(
  topic: string,
  caseStudyTitles: string[],
  allUnitSummaries: string[],
  isTechnical: boolean = true,
  outputLanguage: OutputLanguage = 'en',
): string {
  const summariesBlock = allUnitSummaries
    .map((s, i) => `${unitSummaryLabel(outputLanguage, i)}: ${s}`)
    .join('\n');

  const titlesBlock = caseStudyTitles.map((t, i) => `${i + 1}. "${t}"`).join('\n');
  const titlesBlockFr = caseStudyTitles.map((t, i) => `${i + 1}. « ${t} »`).join('\n');
  const titlesBlockDe = caseStudyTitles.map((t, i) => `${i + 1}. „${t}“`).join('\n');
  const contentGuidance = caseContentGuidanceShort(outputLanguage, isTechnical);

  if (outputLanguage === 'fr') {
    return `Livre : « ${topic} »

Contexte du livre (synthèses d’unité) :
${summariesBlock}

Rédigez ${caseStudyTitles.length} études de cas, chacune de 1600 à 1900 mots. Séparez-les par une ligne contenant uniquement « --- ».

Titres des études :
${titlesBlockFr}

Pour chaque étude : commencez par une ligne ## exactement de la forme « ## Étude de cas N : » suivie du titre. Utilisez des sous-sections ### « Étude de cas N.1 », « Étude de cas N.2 », etc. ${contentGuidance} Référencez des techniques du livre. Pas de HTML brut ni de \`\`\`html ; tableaux GFM et prose uniquement. Maximum 1900 mots par étude.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Buch: „${topic}“

Kontext (Einheitszusammenfassungen):
${summariesBlock}

Schreiben Sie ${caseStudyTitles.length} Fallstudien, jeweils 1600–1900 Wörter. Trennen Sie mit einer Zeile „---“.

Titel:
${titlesBlockDe}

Jede Studie beginnt mit „## Fallstudie N: “ plus Titel. ### als „Fallstudie N.1“, „Fallstudie N.2“ usw. ${contentGuidance} Buchtechniken. Kein HTML/\`\`\`html; GFM. Max. 1900 Wörter pro Studie.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    const titlesHi = caseStudyTitles.map((t, i) => `${i + 1}. "${t}"`).join('\n');
    return `पुस्तक: "${topic}"

संदर्भ (इकाई सारांश):
${summariesBlock}

${caseStudyTitles.length} केस अध्ययन, प्रत्येक 1600–1900 शब्द। "---" से अलग करें।

शीर्षक:
${titlesHi}

प्रत्येक "## केस अध्ययन N: " से शुरू। ### "केस अध्ययन N.1" आदि। ${contentGuidance} तकनीकें। HTML नहीं। प्रति अधिकतम 1900 शब्द।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Book: "${topic}"

Book context (unit summaries):
${summariesBlock}

Write ${caseStudyTitles.length} case studies, each 1600–1900 words. Separate them with a line containing only "---".

Case study titles:
${titlesBlock}

For each case study: start with ## Case Study N: Title. Use ### sub-sections numbered Case Study N.1, Case Study N.2, etc. ${contentGuidance} Reference specific techniques from the book. Do NOT include raw HTML, \`\`\`html blocks, SVG, or diagram markup — use GFM tables and prose only. Do NOT exceed 1900 words per case study.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

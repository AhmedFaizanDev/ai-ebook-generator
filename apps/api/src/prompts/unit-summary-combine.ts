import type { OutputLanguage } from '@/lib/output-language';
import { getUserPromptLanguageFooterShort } from '@/lib/output-language';

export function buildUnitSummaryCombinePrompt(
  unitTitle: string,
  microSummaries: string[],
  outputLanguage: OutputLanguage = 'en',
): string {
  const numbered = microSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n');

  if (outputLanguage === 'fr') {
    return `Unité : « ${unitTitle} »

Micro-synthèses des sous-thèmes :
${numbered}

Synthétisez en un seul paragraphe de 80 à 100 mots. Indiquez le principe unificateur de l’unité, les techniques ou idées clés, et le lien avec les unités précédentes ou suivantes. Sans préambule.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Einheit: „${unitTitle}“

Mikro-Zusammenfassungen der Unterthemen:
${numbered}

Fassen Sie in einem Absatz (80–100 Wörtern) zusammen: das verbindende Prinzip der Einheit, zentrale Techniken oder Ideen, und den Bezug zu vorherigen oder folgenden Einheiten. Kein Vorwort.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `इकाई: "${unitTitle}"

उप-विषय सूक्ष्म सार:
${numbered}

80–100 शब्दों में एक अनुच्छाद में संश्लेषित करें: इकाई का एकीकरण सिद्धांत, मुख्य तकनीकें या विचार, और पिछली/अगली इकाइयों से संबंध। कोई प्रस्तावना नहीं।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Unit: "${unitTitle}"

Subtopic summaries:
${numbered}

Synthesize into one paragraph, 80–100 words. State the unit's unifying principle, key techniques, and how it connects to prior or subsequent units. No preamble.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

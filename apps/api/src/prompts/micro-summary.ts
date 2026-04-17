import type { OutputLanguage } from '@/lib/output-language';
import { getUserPromptLanguageFooterShort } from '@/lib/output-language';

export function buildMicroSummaryPrompt(
  subtopicTitle: string,
  contentExcerpt: string,
  outputLanguage: OutputLanguage = 'en',
): string {
  if (outputLanguage === 'fr') {
    return `Sous-thème : « ${subtopicTitle} »

Extrait :
${contentExcerpt}

En 50 à 80 mots, formulez l’idée centrale et son lien avec le thème de l’unité. Nommez des mécanismes, structures ou contraintes précis — pas de simples titres. Sans préambule.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Unterthema: „${subtopicTitle}“

Auszug:
${contentExcerpt}

In 50–80 Wörtern: zentrale Erkenntnis und Bezug zum Einheitsthema. Nennen Sie Mechanismen, Muster oder Randbedingungen — keine bloßen Überschriften. Kein Vorwort.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `उप-विषय: "${subtopicTitle}"

अंश:
${contentExcerpt}

50–80 शब्दों में केंद्रीय बिंदु और इकाई विषय से संबंध। विशिष्ट तंत्र/संरचनाएँ नामित करें — केवल शीर्षक नहीं। कोई प्रस्तावना नहीं।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Subtopic: "${subtopicTitle}"

Excerpt:
${contentExcerpt}

In 50–80 words, state the central technical insight and how it connects to the unit's broader theme. Name specific mechanisms, patterns, or constraints — not headings. No preamble.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

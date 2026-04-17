import type { OutputLanguage } from '@/lib/output-language';
import { getUserPromptLanguageFooterShort, unitEndSummaryHeading } from '@/lib/output-language';

export function buildUnitEndSummaryPrompt(
  topic: string,
  unitIndex: number,
  unitTitle: string,
  subtopicTitles: string[],
  microSummaries: string[],
  outputLanguage: OutputLanguage = 'en',
): string {
  const context = subtopicTitles
    .map((t, i) => `${unitIndex + 1}.${i + 1} ${t}: ${microSummaries[i] ?? ''}`)
    .join('\n');

  const unitLine =
    outputLanguage === 'fr'
      ? `Unité ${unitIndex + 1} : « ${unitTitle} »`
      : outputLanguage === 'de'
        ? `Einheit ${unitIndex + 1}: „${unitTitle}“`
        : outputLanguage === 'hi'
          ? `इकाई ${unitIndex + 1}: "${unitTitle}"`
          : `Unit ${unitIndex + 1}: "${unitTitle}"`;

  const heading = unitEndSummaryHeading(unitIndex + 1, outputLanguage);

  if (outputLanguage === 'fr') {
    return `Livre : « ${topic} »
${unitLine}

Synthèses par sous-thème :
${context}

Rédigez une courte synthèse de fin d’unité en 5 à 10 puces. Commencez par exactement cette ligne :
${heading}

Règles :
1. Chaque puce : une seule phrase qui résume une idée ou une compétence clé
2. Utilisez la syntaxe Markdown (- ou *) ; une puce par ligne
3. N’introduisez aucun contenu absent des sous-thèmes ci-dessus
4. Ordonnez les puces selon la progression logique de l’unité
5. Rédigez les puces en français, avec des formulations d’action (« Savoir… », « Comprendre… », « Être capable de… »).

Ton : formel, académique. 200–300 mots. Ne dépassez pas 300 mots.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Buch: „${topic}“
${unitLine}

Zusammenfassungen je Unterthema:
${context}

Schreiben Sie eine kurze Einheitszusammenfassung mit 5–10 Aufzählungspunkten. Beginnen Sie exakt mit:
${heading}

Regeln:
1. Jede Zeile: ein Satz zu einer Kernidee oder Fähigkeit
2. Markdown-Listen (- oder *)
3. Kein neues Material außerhalb der obigen Unterthemen
4. Logische Reihenfolge
5. Handlungsorientierte Formulierungen auf Deutsch

Ton: formell, akademisch. 200–300 Wörter. Maximal 300 Wörter.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `पुस्तक: "${topic}"
${unitLine}

उप-विषय सार:
${context}

5–10 बिंदुओं में इकाई अंत सारांश। ठीक इस पंक्ति से शुरू:
${heading}

नियम:
1. प्रत्येक बिंदु: एक वाक्य, एक मुख्य विचार
2. Markdown सूची (- या *)
3. ऊपर के अतिरिक्त नया सामग्री नहीं
4. तार्किक क्रम
5. क्रियात्मक हिंदी

टोन: औपचारिक। 200–300 शब्द। अधिकतम 300।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Book: "${topic}"
${unitLine}

Subtopic summaries:
${context}

Write a concise end-of-unit recap section with 5–10 bullet points. Start with exactly this heading on its own line:
${heading}

Rules:
1. Each bullet must be a single sentence capturing one key concept or skill
2. Use proper Markdown list syntax: start each bullet with - or * on its own line (never plain paragraph text as a list)
3. Do NOT introduce new material not covered in the subtopics above
4. Order bullets to follow the logical progression of the unit
5. Use action-oriented language ("Learned how to...", "Understood the role of...")

Tone: formal, academic. 200–300 words. Do NOT exceed 300 words.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

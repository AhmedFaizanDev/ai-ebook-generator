import { getUserPromptLanguageFooterShort, unitOutlineLine, type OutputLanguage } from '@/lib/output-language';

export function buildGlossaryPrompt(
  topic: string,
  unitTitles: string[],
  isTechnical: boolean = true,
  outputLanguage: OutputLanguage = 'en',
): string {
  const outline = unitTitles.map((t, i) => unitOutlineLine(outputLanguage, i, t)).join('\n');
  const termType = isTechnical ? 'key technical terms' : 'key terms and concepts';
  const mainHeading =
    outputLanguage === 'fr'
      ? '# Glossaire'
      : outputLanguage === 'de'
        ? '# Glossar'
        : outputLanguage === 'hi'
          ? '# शब्दावली'
          : '# Glossary';

  if (outputLanguage === 'fr') {
    const termTypeFr = isTechnical ? 'termes techniques clés' : 'termes et notions clés';
    return `Livre : « ${topic} »

Unités couvertes :
${outline}

Générez une section Glossaire. Commencez par ${mainHeading}.

Exigences :
1. 15 à 20 ${termTypeFr} réellement utiles dans cet ouvrage
2. Ordre alphabétique strict
3. Format de chaque entrée : **Terme** — définition concise (1 à 2 phrases), entièrement en français
4. Définitions précises, autonomes, pertinentes pour « ${topic} »
5. Privilégiez les notions qu’un lecteur chercherait dans un index, pas les mots du quotidien

Ton : formel, académique. 400 à 500 mots. Texte propre — pas de caractères parasites ni d’artefacts. Ne dépassez pas 500 mots.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    const termTypeDe = isTechnical ? 'zentrale Fachbegriffe' : 'zentrale Begriffe und Konzepte';
    return `Buch: „${topic}“

Abgedeckte Einheiten:
${outline}

Erstellen Sie ein Glossar. Beginnen Sie mit ${mainHeading}.

Anforderungen:
1. 15–20 ${termTypeDe}, die im Buch wirklich vorkommen
2. Streng alphabetische Reihenfolge
3. Format je Eintrag: **Begriff** — prägnante Definition (1–2 Sätze), vollständig auf Deutsch
4. Präzise, eigenständige Definitionen, relevant für „${topic}“
5. Begriffe, die Leser nachschlagen würden — keine Allerweltswörter

Ton: formell, akademisch. 400–500 Wörter. Sauberer Text. Maximal 500 Wörter.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    const termTypeHi = isTechnical ? 'मुख्य तकनीकी शब्द' : 'मुख्य शब्द और अवधारणाएँ';
    return `पुस्तक: "${topic}"

इकाइयाँ:
${outline}

शब्दावली अनुभाग बनाएं। ${mainHeading} से शुरू करें।

आवश्यकताएँ:
1. 15–20 ${termTypeHi}
2. वर्णमाला क्रम सख्त
3. प्रारूप: **शब्द** — संक्षिप्त परिभाषा (1–2 वाक्य), पूरा हिंदी में
4. सटीक, स्वतंत्र परिभाषाएँ "${topic}" से संबंधित
5. अनुक्रमणिका योग्य शब्द, दैनिक शब्द नहीं

टोन: औपचारिक, शैक्षणिक। 400–500 शब्द। अधिकतम 500 शब्द।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Book: "${topic}"

Units covered:
${outline}

Generate a Glossary section. Start with ${mainHeading}.

Requirements:
1. List 15–20 ${termType} used throughout this book
2. Arrange terms in strict alphabetical order
3. Each entry format: **Term** — concise definition (1–2 sentences)
4. Definitions must be precise, self-contained, and relevant to "${topic}"
5. Include foundational terms a reader would need to look up, not obvious common words

Tone: formal, academic. 400–500 words. Output clean text only — no stray symbols or artifact characters. Do NOT exceed 500 words.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

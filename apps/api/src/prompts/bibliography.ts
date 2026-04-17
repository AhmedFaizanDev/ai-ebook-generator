import type { OutputLanguage } from '@/lib/output-language';
import { BIBLIOGRAPHY_HEADINGS, getUserPromptLanguageFooterShort, unitOutlineLine } from '@/lib/output-language';

export function buildBibliographyPrompt(
  topic: string,
  unitTitles: string[],
  outputLanguage: OutputLanguage = 'en',
): string {
  const outline = unitTitles.map((t, i) => unitOutlineLine(outputLanguage, i, t)).join('\n');
  const h = BIBLIOGRAPHY_HEADINGS[outputLanguage];

  if (outputLanguage === 'fr') {
    return `Livre : « ${topic} »

Unités couvertes :
${outline}

Rédigez une bibliographie et une liste de lectures recommandées professionnelles. Commencez par # ${h.main}.

Exigences :
1. Utilisez exactement ces sous-titres, dans cet ordre : ${h.books}, ${h.papers}, ${h.online}
2. Sous chaque sous-titre, uniquement des listes à puces Markdown (préfixe « - »)
3. 5 à 12 références au total
4. Format de chaque entrée : Auteur(s), « Titre », Éditeur/Source, Année.
5. Chaque entrée doit comporter une année sur quatre chiffres (AAAA)
6. Des références plausibles et pertinentes pour « ${topic} » — privilégiez des ouvrages ou sources réels et reconnus
7. Mélangez fondations, références récentes et documentation ou normes officielles
8. Pas de sous-section « Synthèse » ni de prose hors listes dans la bibliographie
9. Pas de chaînes d’initiales absurdes, pas de texte incohérent ni de remplissage
10. Noms d’auteurs avec patronymes réels ; guillemets français « » ou guillemets droits ASCII autour des titres, cohérents ; pas de « ... » tronquant un auteur

Longueur totale : 180 à 320 mots. Pas de préambule. Texte propre : lettres, chiffres et ponctuation usuels — pas de caractères de contrôle, pas de blocs de code ni de HTML.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Buch: „${topic}“

Einheiten:
${outline}

Erstellen Sie ein professionelles Literaturverzeichnis und weiterführende Literatur. Beginnen Sie mit # ${h.main}.

Anforderungen:
1. Genau diese Unterüberschriften in dieser Reihenfolge: ${h.books}, ${h.papers}, ${h.online}
2. Unter jeder Überschrift nur Markdown-Aufzählungen („- “)
3. Insgesamt 5–12 Einträge
4. Format: Autor(en), „Titel“, Verlag/Quelle, Jahr.
5. Jedes Jahr als vierstellige Zahl (JJJJ)
6. Plausible, relevante Quellen zu „${topic}“ — nach Möglichkeit echte Werke
7. Mix aus Grundlagen, aktueller Literatur und Normen/Dokumentation
8. Keine „Zusammenfassung“-Untersektion, keine Prosa außerhalb der Listen
9. Keine Initialketten, kein Unsinn, kein Platzhalterspam
10. Echte Nachnamen; Titel in Anführungszeichen; keine abgebrochenen Autoren mit „…“

Länge: 180–320 Wörter. Kein Vorwort. Nur sauberer Text — keine Steuerzeichen, keine Codeblöcke oder HTML.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `पुस्तक: "${topic}"

इकाइयाँ:
${outline}

एक पेशेवर ग्रंथसूची और अनुशंसित पठन अनुभाग लिखें। # ${h.main} से शुरू करें।

आवश्यकताएँ:
1. ठीक ये उपशीर्षक इस क्रम में: ${h.books}, ${h.papers}, ${h.online}
2. प्रत्येक के तहत केवल Markdown बुलेट ("- ")
3. कुल 5–12 संदर्भ
4. प्रारूप: लेखक, "शीर्षक," प्रकाशक/स्रोत, वर्ष।
5. प्रत्येक में चार अंकों का वर्ष (YYYY)
6. "${topic}" से संबंधित विश्वसनीय संदर्भ — यथासंभव वास्तविक कार्य
7. आधार, आधुनिक स्रोत और आधिकारिक दस्तावेज़ मिलाएँ
8. कोई सारांश उपखंड नहीं, सूचियों के बाहर गद्य नहीं
9. आरंभिक अक्षरों की लंबी श्रृंखला या कूड़ा नहीं
10. वास्तविक उपनाम; शीर्षक उद्धरण में; कटे हुए नाम नहीं

कुल 180–320 शब्द। कोई प्रस्तावना नहीं। साफ़ पाठ — नियंत्रण वर्ण, कोड ब्लॉक या HTML नहीं।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Book: "${topic}"

Units covered:
${outline}

Generate a professional bibliography and recommended reading section. Start with # ${h.main}.

Requirements:
1. Use exactly these subsection headings in this order: ${h.books}, ${h.papers}, ${h.online}
2. Under each subsection, use Markdown bullet list entries only ("- " prefix)
3. List 5–12 total references
4. Each entry must use this citation format: Author(s), "Title," Publisher/Source, Year.
5. Every entry must include a 4-digit year (YYYY)
6. References must be plausible and relevant to "${topic}" — use real, widely-known works in this field where possible
7. Include a mix of foundational texts, modern references, and official documentation/standards
8. Do NOT add a "Summary" subsection or any paragraph prose within the bibliography section — only reference lists under the required subsection headings.
9. Never repeat initials, never output gibberish, and never use placeholder spam.
10. Author names must include real surnames (e.g. H. K. Khalil or Khalil, H. K.) — not long chains of initials (A. B. C. D. …), not truncated names with "...", and never omit the opening quote before the title. Good: Lastname, "Book Title," Publisher, 2000. Bad: A. A. A. A., "Title," … ; Bad: Smith, Book Title," Publisher (missing " before Book).

Write 180–320 words total. No preamble. Output clean text only: use standard letters, numbers, and punctuation only — no control characters, Unicode replacement symbols, stray Unicode, code blocks, or HTML.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

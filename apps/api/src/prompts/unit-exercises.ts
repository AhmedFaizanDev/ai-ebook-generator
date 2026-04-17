import type { OutputLanguage } from '@/lib/output-language';
import { getUserPromptLanguageFooterShort, unitExercisesHeading } from '@/lib/output-language';

const answerLineLabel = (lang: OutputLanguage) => {
  if (lang === 'fr') {
    return '**Réponse : X** (X = A, B, C ou D) — utilisez exactement ce format pour chaque réponse';
  }
  if (lang === 'de') {
    return '**Antwort: X** (X = A, B, C oder D) — genau dieses Format für jede Antwort';
  }
  if (lang === 'hi') {
    return '**उत्तर: X** (X = A, B, C या D) — प्रत्येक उत्तर के लिए ठीक यह प्रारूप';
  }
  return '**Answer: X** — every question must have an answer';
};

const answerLineExample = (lang: OutputLanguage) => {
  if (lang === 'fr') return '**Réponse : X**';
  if (lang === 'de') return '**Antwort: X**';
  if (lang === 'hi') return '**उत्तर: X**';
  return '**Answer: X**';
};

export function buildUnitExercisesPrompt(
  topic: string,
  unitIndex: number,
  unitTitle: string,
  subtopicTitles: string[],
  unitSummary: string,
  questionRange?: { start: number; end: number },
  outputLanguage: OutputLanguage = 'en',
): string {
  const subtopicList = subtopicTitles
    .map((t, i) => `${unitIndex + 1}.${i + 1} ${t}`)
    .join('\n');

  const hasRange = questionRange && questionRange.start >= 1 && questionRange.end >= questionRange.start;
  const start = hasRange ? questionRange!.start : 1;
  const end = hasRange ? questionRange!.end : 20;
  const count = end - start + 1;
  const wordCap = hasRange ? Math.ceil((count / 20) * 500) : 1000;

  const unitNum = unitIndex + 1;
  const exH = unitExercisesHeading(unitNum, outputLanguage);

  const rangeInstruction =
    outputLanguage === 'fr'
      ? hasRange
        ? `Générez **uniquement les questions ${start} à ${end}**. Numérotez-les ${start}. ${start + 1}. … ${end}.`
        : `Générez une section d’exercices avec exactement 20 questions à choix multiples (QCM). Numérotation 1. 2. 3. … 20.`
      : outputLanguage === 'de'
        ? hasRange
          ? `Erzeugen Sie **nur die Fragen ${start} bis ${end}**. Nummerierung ${start}. ${start + 1}. … ${end}.`
          : `Erzeugen Sie genau 20 Multiple-Choice-Fragen. Nummerierung 1. … 20.`
        : outputLanguage === 'hi'
          ? hasRange
            ? `**केवल प्रश्न ${start} से ${end}** उत्पन्न करें। क्रमांकन ${start}. … ${end}.`
            : `ठीक 20 बहुवikal्पीय प्रश्न। क्रमांकन 1. … 20.`
          : hasRange
            ? `Generate **only questions ${start} through ${end}**. Number them ${start}. ${start + 1}. … ${end}.`
            : `Generate an exercises section with exactly 20 multiple-choice questions (MCQs). Number questions sequentially (1. 2. 3. ... 20.)`;

  const headingInstruction =
    outputLanguage === 'fr'
      ? hasRange && start === 1
        ? `Commencez par la ligne exacte suivante : ${exH}`
        : hasRange && start > 1
          ? `N’ajoutez pas ${exH} ni aucun titre de section. Questions uniquement.`
          : `Commencez par la ligne exacte suivante : ${exH}`
      : outputLanguage === 'de'
        ? hasRange && start === 1
          ? `Beginnen Sie exakt mit: ${exH}`
          : hasRange && start > 1
            ? `Fügen Sie ${exH} oder andere Abschnittstitel nicht hinzu — nur Fragen.`
            : `Beginnen Sie exakt mit: ${exH}`
        : outputLanguage === 'hi'
          ? hasRange && start === 1
            ? `ठीक इस पंक्ति से आरंभ करें: ${exH}`
            : hasRange && start > 1
              ? `${exH} या अन्य शीर्षक न डालें — केवल प्रश्न।`
              : `ठीक इस पंक्ति से आरंभ करें: ${exH}`
          : hasRange && start === 1
            ? `Start with ${exH} (use this exact heading).`
            : hasRange && start > 1
              ? `Do NOT add ${exH} or any section heading. Output only the questions.`
              : `Start with ${exH} (use this exact heading).`;

  if (outputLanguage === 'fr') {
    return `Livre : « ${topic} »
Unité ${unitNum} : « ${unitTitle} »

Sous-thèmes :
${subtopicList}

Synthèse d’unité :
${unitSummary}

${rangeInstruction} ${headingInstruction}

Exigences :
1. Les questions évaluent la compréhension conceptuelle et l’application — pas la mémorisation par cœur
2. Couvrez tous les sous-thèmes de façon équilibrée
3. Chaque question : exactement 4 options libellées A, B, C, D
4. Indiquez la bonne réponse en fin de question : ${answerLineLabel(outputLanguage)} ; ne tronquez pas
5. Répartition indicative : ~40 % rappel, ~40 % application, ~20 % analyse
6. Questions autonomes — pas de renvoi à des figures ou ressources externes
7. Mettez chaque question en gras : **N. Texte de la question ?** Ne mettez pas les options en gras.
8. Ligne vide obligatoire entre l’énoncé et la première option (A) ne doit jamais être sur la même ligne que la question).
9. Nombre exact de questions demandées, chacune avec quatre options et sa ligne de réponse.

Format (ligne vide avant A)) :
**N. Texte de la question ?**

A) Option
B) Option
C) Option
D) Option
${answerLineExample(outputLanguage)}

Ton : formel, académique. Environ ${wordCap} mots. Ne dépassez pas ${wordCap} mots.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Buch: „${topic}“
Einheit ${unitNum}: „${unitTitle}“

Unterthemen:
${subtopicList}

Einheitszusammenfassung:
${unitSummary}

${rangeInstruction} ${headingInstruction}

Anforderungen:
1. Fragen prüfen Verständnis und Anwendung — kein reines Auswendiglernen
2. Unterthemen ausgewogen abdecken
3. Jede Frage: genau vier Optionen A, B, C, D
4. Richtige Antwort: ${answerLineLabel(outputLanguage)}
5. Schwierigkeit: ~40 % Abruf, ~40 % Anwendung, ~20 % Analyse
6. Fragen müssen in sich geschlossen sein
7. Fragen fett: **N. Fragetext?** — Optionen nicht fett
8. Leerzeile zwischen Frage und erster Option A)
9. Exakt die geforderte Anzahl mit vier Optionen und Antwortzeile

Format:
**N. Fragetext?**

A) Option
B) Option
C) Option
D) Option
${answerLineExample(outputLanguage)}

Ton: formell, akademisch. ~${wordCap} Wörter. Maximal ${wordCap} Wörter.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `पुस्तक: "${topic}"
इकाई ${unitNum}: "${unitTitle}"

उप-विषय:
${subtopicList}

इकाई सारांश:
${unitSummary}

${rangeInstruction} ${headingInstruction}

आवश्यकताएँ:
1. प्रश्न अवधारणा और अनुप्रयोग जाँचें — रटना नहीं
2. सभी उप-विषय संतुलित
3. प्रत्येक में चार विकल्प A, B, C, D
4. सही उत्तर: ${answerLineLabel(outputLanguage)}
5. कठिनाई: ~40% स्मरण, ~40% अनुप्रयोग, ~20% विश्लेषण
6. प्रश्न स्वयंपूर्ण
7. प्रश्न मोटा: **N. प्रश्न पाठ?** — विकल्प सामान्य
8. प्रश्न और A) के बीच खाली पंक्ति
9. अनुरोधित संख्या, चार विकल्प और उत्तर पंक्ति

प्रारूप:
**N. प्रश्न?**

A) विकल्प
B) विकल्प
C) विकल्प
D) विकल्प
${answerLineExample(outputLanguage)}

टोन: औपचारिक। ~${wordCap} शब्द। अधिकतम ${wordCap} शब्द।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Book: "${topic}"
Unit ${unitIndex + 1}: "${unitTitle}"

Subtopics:
${subtopicList}

Unit summary:
${unitSummary}

${rangeInstruction} ${headingInstruction}

Requirements:
1. Questions must assess conceptual understanding and basic application — not rote memorization
2. Cover all subtopics roughly evenly
3. Each question has exactly 4 options labeled A, B, C, D
4. Mark the correct answer at the end of each question as: ${answerLineLabel(outputLanguage)}; do not truncate or omit answers
5. Mix difficulty: ~40% straightforward recall, ~40% application, ~20% analysis
6. Questions must be self-contained — no references to figures or external resources
7. Bold every question: use **N. Question text?** for each question (e.g. **1. What is...?**). Do NOT bold the options (A, B, C, D) — options are normal text. Exercise questions must be formatted in bold consistently across all units.
8. Put a strict line break (blank line) between the question text and the first option. Option A must never appear on the same line as the question; always start options on a new line after a blank line.
9. Output exactly the requested number of questions (e.g. 10 or 20) with full options and the required answer line for each — do not stop early or omit questions.

Format each question exactly like this (note the blank line before A)):
**N. Question text?**

A) Option
B) Option
C) Option
D) Option
${answerLineExample(outputLanguage)}

Tone: formal, academic. ~${wordCap} words. Do NOT exceed ${wordCap} words.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

export function buildUnitExercisesRepairPrompt(
  topic: string,
  unitIndex: number,
  unitTitle: string,
  subtopicTitles: string[],
  unitSummary: string,
  issues: string[],
  flawedMarkdown: string,
  outputLanguage: OutputLanguage = 'en',
): string {
  const subtopicList = subtopicTitles
    .map((t, i) => `${unitIndex + 1}.${i + 1} ${t}`)
    .join('\n');

  const issuesBlock = issues.map((r, i) => `${i + 1}. ${r}`).join('\n');
  const unitNum = unitIndex + 1;
  const exH = unitExercisesHeading(unitNum, outputLanguage);

  if (outputLanguage === 'fr') {
    return `Livre : « ${topic} »
Unité ${unitNum} : « ${unitTitle} »

Sous-thèmes :
${subtopicList}

Synthèse d’unité :
${unitSummary}

La section d’exercices précédente n’a pas passé les contrôles automatiques. Réécrivez la section **complète** depuis zéro.

Problèmes détectés :
${issuesBlock}

Exigences strictes :
- Commencez par ${exH} (titre exact).
- Exactement 20 questions, numérotées **1.** à **20.** en gras (format **N. Texte ?**).
- Après l’énoncé : ligne vide, puis A) B) C) D) sur des lignes distinctes (texte normal, pas en gras).
- Après les quatre options : une ligne **Réponse : X** où X est A, B, C ou D.
- Aucune question tronquée ; chaque question a quatre options et une réponse.

Sortie défectueuse à remplacer :
---
${flawedMarkdown}
---

Sortie : uniquement la section d’exercices corrigée en Markdown. Environ 1000 mots. Maximum 1000 mots.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Buch: „${topic}“
Einheit ${unitNum}: „${unitTitle}“

Unterthemen:
${subtopicList}

Einheitszusammenfassung:
${unitSummary}

Die vorherige Übungssektion hat die Prüfungen nicht bestanden. Schreiben Sie die **gesamte** Sektion neu.

Gefundene Probleme:
${issuesBlock}

Streng:
- Beginnen Sie mit ${exH} (exakt).
- Genau 20 Fragen, fett **1.** … **20.** (**N. Text?**).
- Leerzeile, dann A) B) C) D) (normal, nicht fett).
- Danach **Antwort: X** mit X ∈ {A,B,C,D}.
- Keine abgeschnittenen Fragen.

Fehlerhafte Ausgabe:
---
${flawedMarkdown}
---

Nur die korrigierte vollständige Übungssektion in Markdown. ~1000 Wörter. Max. 1000 Wörter.${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `पुस्तक: "${topic}"
इकाई ${unitNum}: "${unitTitle}"

उप-विषय:
${subtopicList}

सारांश:
${unitSummary}

पिछला अभ्यास खंड सत्यापन में विफल। **पूरा** खंड फिर से लिखें।

समस्याएँ:
${issuesBlock}

सख्त:
- ${exH} से शुरू (ठीक वही)।
- ठीक 20 प्रश्न, मोटा **1.** से **20.** (**N. प्रश्न?**).
- खाली पंक्ति, फिर A) B) C) D) अलग पंक्तियों में (सामान्य)।
- फिर **उत्तर: X**।
- कोई कटा प्रश्न नहीं।

दोषपूर्ण:
---
${flawedMarkdown}
---

केवल ठीक पूरा अभ्यास Markdown। ~1000 शब्द। अधिकतम 1000।${getUserPromptLanguageFooterShort(outputLanguage)}`;
  }

  return `Book: "${topic}"
Unit ${unitIndex + 1}: "${unitTitle}"

Subtopics:
${subtopicList}

Unit summary:
${unitSummary}

Your previous Exercises output failed automated quality checks. Rewrite the COMPLETE section from scratch.

Detected issues:
${issuesBlock}

Hard requirements (all must be satisfied):
- Start with ${exH} (exact heading).
- Exactly 20 questions, numbered **1.** through **20.** in bold (format **N. Question text?**).
- Each question: blank line, then A) B) C) D) on separate lines (normal weight, not bold).
- After the four options, a line **Answer: X** where X is A, B, C, or D.
- No truncated questions; every question must have four options and an answer.

Flawed output to replace:
---
${flawedMarkdown}
---

Output only the fixed full exercises section in Markdown. ~1000 words. Do NOT exceed 1000 words.${getUserPromptLanguageFooterShort(outputLanguage)}`;
}

import { SUBTOPICS_PER_UNIT } from '@/lib/config';

export function buildUnitIntroductionPrompt(
  topic: string,
  unitIndex: number,
  unitTitle: string,
  subtopicTitles: string[],
): string {
  const outline = subtopicTitles.map((t, i) => `${unitIndex + 1}.${i + 1} ${t}`).join('\n');

  return `Book: "${topic}"
Unit ${unitIndex + 1}: "${unitTitle}"

Subtopics covered in this unit:
${outline}

Write a 2–3 paragraph academic introduction for this unit (300–400 words). Do NOT use a heading — the unit heading is already placed above this text.

Include:
1. A narrative overview of what this unit covers and why it matters in the context of "${topic}"
2. Assumed prerequisites or prior knowledge the reader should have
3. 3–5 explicit learning objectives as a numbered list, prefixed with "By the end of this unit, learners will be able to:"

Tone: formal, neutral, suitable for undergraduate learners. No conversational language. No filler. Do NOT exceed 400 words.`;
}

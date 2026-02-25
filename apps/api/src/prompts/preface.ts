import { UNIT_COUNT, SUBTOPICS_PER_UNIT } from '@/lib/config';

export function buildPrefacePrompt(topic: string, unitTitles: string[]): string {
  const outline = unitTitles.map((t, i) => `Unit ${i + 1}: ${t}`).join('\n');

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

Write in first-person plural ("we"). Tone: welcoming but professional. No filler. Do NOT exceed 600 words.`;
}

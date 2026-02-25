export function buildUnitExercisesPrompt(
  topic: string,
  unitIndex: number,
  unitTitle: string,
  subtopicTitles: string[],
  unitSummary: string,
): string {
  const subtopicList = subtopicTitles
    .map((t, i) => `${unitIndex + 1}.${i + 1} ${t}`)
    .join('\n');

  return `Book: "${topic}"
Unit ${unitIndex + 1}: "${unitTitle}"

Subtopics:
${subtopicList}

Unit summary:
${unitSummary}

Generate an "Exercises" section with exactly 20 multiple-choice questions (MCQs). Start with ## Exercises.

Requirements:
1. Questions must assess conceptual understanding and basic application — not rote memorization
2. Cover all subtopics roughly evenly (3–5 questions per subtopic)
3. Each question has exactly 4 options labeled A, B, C, D
4. Mark the correct answer at the end of each question as: **Answer: X**
5. Mix difficulty: ~40% straightforward recall, ~40% application, ~20% analysis
6. Questions must be self-contained — no references to figures or external resources
7. Number questions sequentially (1. 2. 3. ... 20.)

Format each question as:
**N. Question text?**
A) Option
B) Option
C) Option
D) Option
**Answer: X**

Tone: formal, academic. 800–1000 words. Do NOT exceed 1000 words.`;
}

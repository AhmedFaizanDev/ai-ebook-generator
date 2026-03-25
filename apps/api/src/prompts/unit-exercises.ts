export function buildUnitExercisesPrompt(
  topic: string,
  unitIndex: number,
  unitTitle: string,
  subtopicTitles: string[],
  unitSummary: string,
  questionRange?: { start: number; end: number },
): string {
  const subtopicList = subtopicTitles
    .map((t, i) => `${unitIndex + 1}.${i + 1} ${t}`)
    .join('\n');

  const hasRange = questionRange && questionRange.start >= 1 && questionRange.end >= questionRange.start;
  const start = hasRange ? questionRange!.start : 1;
  const end = hasRange ? questionRange!.end : 20;
  const count = end - start + 1;
  const wordCap = hasRange ? Math.ceil((count / 20) * 500) : 1000;

  const rangeInstruction = hasRange
    ? `Generate **only questions ${start} through ${end}**. Number them ${start}. ${start + 1}. … ${end}.`
    : 'Generate an "Exercises" section with exactly 20 multiple-choice questions (MCQs). Number questions sequentially (1. 2. 3. ... 20.)';

  const headingInstruction =
    hasRange && start === 1
      ? 'Start with ## Exercises.'
      : hasRange && start > 1
        ? 'Do NOT add ## Exercises or any section heading. Output only the questions.'
        : 'Start with ## Exercises.';

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
4. Mark the correct answer at the end of each question as: **Answer: X** — every question must have an answer; do not truncate or omit answers
5. Mix difficulty: ~40% straightforward recall, ~40% application, ~20% analysis
6. Questions must be self-contained — no references to figures or external resources
7. Bold every question: use **N. Question text?** for each question (e.g. **1. What is...?**). Do NOT bold the options (A, B, C, D) — options are normal text. Exercise questions must be formatted in bold consistently across all units.
8. Put a strict line break (blank line) between the question text and the first option. Option A must never appear on the same line as the question; always start options on a new line after a blank line.
9. Output exactly the requested number of questions (e.g. 10 or 20) with full options and **Answer: X** for each — do not stop early or omit questions.

Format each question exactly like this (note the blank line before A)):
**N. Question text?**

A) Option
B) Option
C) Option
D) Option
**Answer: X**

Tone: formal, academic. ~${wordCap} words. Do NOT exceed ${wordCap} words.`;
}

export function buildUnitExercisesRepairPrompt(
  topic: string,
  unitIndex: number,
  unitTitle: string,
  subtopicTitles: string[],
  unitSummary: string,
  issues: string[],
  flawedMarkdown: string,
): string {
  const subtopicList = subtopicTitles
    .map((t, i) => `${unitIndex + 1}.${i + 1} ${t}`)
    .join('\n');

  const issuesBlock = issues.map((r, i) => `${i + 1}. ${r}`).join('\n');

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
- Start with ## Exercises.
- Exactly 20 questions, numbered **1.** through **20.** in bold (format **N. Question text?**).
- Each question: blank line, then A) B) C) D) on separate lines (normal weight, not bold).
- After the four options, a line **Answer: X** where X is A, B, C, or D.
- No truncated questions; every question must have four options and an answer.

Flawed output to replace:
---
${flawedMarkdown}
---

Output only the fixed full Exercises section in Markdown. ~1000 words. Do NOT exceed 1000 words.`;
}

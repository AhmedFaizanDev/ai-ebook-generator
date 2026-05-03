import { SessionState } from '@/lib/types';
import { MIN_CALL_INTERVAL_MS, LLM_CONCURRENCY } from '@/lib/config';
import { computeWordTargets, DEFAULT_SUBTOPIC_BAND } from '@/lib/word-budget';
import { checkLimits } from '@/lib/counters';
import { saveSession } from '@/lib/session-store';
import { retry } from './retry';
import { generateStructure } from './generate-structure';
import { generateSubtopic } from './generate-subtopic';
import { generateMicroSummary } from './generate-micro-summary';
import { combineUnitSummary } from './combine-unit-summary';
import { generatePreface } from './generate-preface';
import { generateUnitIntro } from './generate-unit-intro';
import { generateUnitEndSummary } from './generate-unit-end-summary';
import { generateUnitExercises } from './generate-unit-exercises';
import { generateCapstones } from './generate-capstone';
import { generateCaseStudies } from './generate-case-study';
import { generateGlossary } from './generate-glossary';
import { generateBibliography } from './generate-bibliography';
import { buildFinalMarkdown } from './build-markdown';
import { logPhase, logVerbose } from './debug';

function touch(session: SessionState): void {
  session.lastActivityAt = Date.now();
}

const throttle = () =>
  MIN_CALL_INTERVAL_MS > 0
    ? new Promise<void>((r) => setTimeout(r, MIN_CALL_INTERVAL_MS))
    : Promise.resolve();

async function runBatch<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIdx = 0;
  let failed: unknown = null;

  async function worker(): Promise<void> {
    while (nextIdx < tasks.length && !failed) {
      const idx = nextIdx++;
      if (idx >= tasks.length) break;
      try {
        results[idx] = await tasks[idx]();
      } catch (err) {
        failed = err;
        throw err;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  const settled = await Promise.allSettled(workers);
  const firstRejection = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
  if (firstRejection) {
    throw firstRejection.reason;
  }
  return results;
}

function isStructureComplete(session: SessionState): boolean {
  const s = session.structure;
  if (!s || !Array.isArray(s.units) || s.units.length === 0) return false;
  for (const u of s.units) {
    if (!u || !Array.isArray(u.subtopics) || u.subtopics.length === 0) return false;
    if (typeof u.unitTitle !== 'string' || u.unitTitle.trim().length === 0) return false;
  }
  return true;
}

function isUnitComplete(session: SessionState, unitIdx: number): boolean {
  const unit = session.structure?.units[unitIdx];
  if (!unit || unit.subtopics.length === 0) return false;
  if (!session.unitIntroductions[unitIdx]) return false;
  if (session.unitSummaries.length <= unitIdx) return false;
  if (!session.unitEndSummaries[unitIdx]) return false;
  if (!session.unitExercises[unitIdx]) return false;
  for (let s = 0; s < unit.subtopics.length; s++) {
    if (!session.subtopicMarkdowns.get(`u${unitIdx}-s${s}`)) return false;
  }
  return true;
}

/** Total subtopics across all units in the current structure (1 if not yet built, to avoid div-by-zero). */
function totalSubtopicsOf(session: SessionState): number {
  const units = session.structure?.units ?? [];
  let n = 0;
  for (const u of units) n += u.subtopics?.length ?? 0;
  return Math.max(1, n);
}

function isPostUnitsComplete(session: SessionState): boolean {
  const hasText = (s: string | null | undefined): boolean => !!s && s.trim().length > 0;
  return !!(
    hasText(session.capstonesMarkdown) &&
    hasText(session.caseStudiesMarkdown) &&
    hasText(session.glossaryMarkdown) &&
    hasText(session.bibliographyMarkdown)
  );
}

export async function orchestrate(session: SessionState): Promise<void> {
  session.status = 'generating';
  touch(session);
  logPhase(session.id, 'orchestrate started', { topic: session.topic });

  try {
    // Phase 1: Structure (skip if already complete for resume)
    if (!isStructureComplete(session)) {
      session.phase = 'structure';
      logPhase(session.id, 'phase: structure');
      await throttle();
      session.structure = await retry(
        () => generateStructure(session),
        { max: 3, label: 'structure' }
      );
      touch(session);
      session.progress = 3;
      checkLimits(session);
      logPhase(session.id, 'structure done', { callCount: session.callCount, tokenCount: session.tokenCount });
      saveSession(session);
    } else {
      logPhase(session.id, 'resume: structure already complete, skipping');
    }

    if (!isStructureComplete(session) || !session.structure) {
      throw new Error(`Structure invalid: ${session.structure?.units.length ?? 0} unit(s), some without subtopics`);
    }

    // Ensure word-budget targets exist for any pre-supplied structure (CSV-driven path) and
    // for resumed sessions persisted before this column was added.
    if (!session.wordTargets) {
      session.wordTargets = computeWordTargets(session.structure);
    }

    const unitCount = session.structure.units.length;
    const totalSubs = totalSubtopicsOf(session);
    let completedSubs = 0;
    for (let u = 0; u < unitCount; u++) {
      const unit = session.structure.units[u];
      for (let s = 0; s < unit.subtopics.length; s++) {
        if (session.subtopicMarkdowns.get(`u${u}-s${s}`)) completedSubs++;
      }
    }

    // Phase 1b: Preface (skip if already present for resume)
    if (!session.prefaceMarkdown || session.prefaceMarkdown.trim().length === 0) {
      session.phase = 'preface';
      logPhase(session.id, 'phase: preface');
      await throttle();
      session.prefaceMarkdown = await retry(
        () => generatePreface(session),
        { max: 2, label: 'preface' }
      );
      touch(session);
      checkLimits(session);
      logPhase(session.id, 'preface done');
      saveSession(session);
    } else {
      logPhase(session.id, 'resume: preface already complete, skipping');
    }

    // Phase 2: Units (skip each unit if already complete for resume)
    for (let unitIdx = 0; unitIdx < unitCount; unitIdx++) {
      const unit = session.structure.units[unitIdx];
      if (!unit || unit.subtopics.length === 0) {
        throw new Error(`Unit ${unitIdx + 1} invalid: 0 subtopics`);
      }
      const unitSubCount = unit.subtopics.length;

      if (isUnitComplete(session, unitIdx)) {
        logPhase(session.id, `resume: unit ${unitIdx + 1}/${unitCount} already complete, skipping`);
        continue;
      }

      session.currentUnit = unitIdx + 1;
      session.phase = `unit-${unitIdx + 1}`;
      touch(session);
      logPhase(session.id, `unit ${unitIdx + 1}/${unitCount} started`);
      session.microSummaries[unitIdx] = [];

      const prevUnitSummary = unitIdx > 0
        ? session.unitSummaries[unitIdx - 1] ?? null
        : null;

      // 2a: Unit Introduction + all subtopics in parallel
      logPhase(session.id, `unit ${unitIdx + 1} intro + subtopics (parallel)`);

      const microResults: (string | null)[] = new Array(unitSubCount).fill(null);

      const introTask = async () => {
        await throttle();
        const intro = await retry(
          () => generateUnitIntro(session, unitIdx),
          { max: 2, label: `unit-${unitIdx + 1}-intro` }
        );
        session.unitIntroductions[unitIdx] = intro;
        touch(session);
        checkLimits(session);
      };

      const subtopicTasks = Array.from({ length: unitSubCount }, (_, subIdx) => {
        return async () => {
          session.currentSubtopic = subIdx + 1;
          touch(session);

          const targetWords = session.wordTargets?.perSubtopic[unitIdx]?.[subIdx] ?? DEFAULT_SUBTOPIC_BAND;

          await throttle();
          const md = await retry(
            () =>
              generateSubtopic(
                {
                  topic: session.topic,
                  unitTitle: unit.unitTitle,
                  subtopicTitle: unit.subtopics[subIdx],
                  unitIndex: unitIdx,
                  subtopicIndex: subIdx,
                  prevUnitSummary,
                  prevSubtopicSummary: null,
                  model: session.model,
                  isTechnical: session.isTechnical,
                  visuals: session.visuals,
                  targetWords,
                  unitCount,
                  unitSubtopicCount: unitSubCount,
                },
                session
              ),
            { max: 3, label: `subtopic U${unitIdx + 1}/S${subIdx + 1}` }
          );

          session.subtopicMarkdowns.set(`u${unitIdx}-s${subIdx}`, md);

          await throttle();
          const micro = await retry(
            () =>
              generateMicroSummary(
                unit.subtopics[subIdx],
                md,
                session
              ),
            { max: 2, label: `micro U${unitIdx + 1}/S${subIdx + 1}` }
          );
          microResults[subIdx] = micro;
          touch(session);

          completedSubs++;
          session.progress = 3 + (completedSubs / totalSubs) * 72;
          checkLimits(session);
          logVerbose(session.id, `unit ${unitIdx + 1} subtopic ${subIdx + 1}/${unitSubCount} done`, {
            callCount: session.callCount,
            tokenCount: session.tokenCount,
          });
        };
      });

      const allUnitTasks = [introTask, ...subtopicTasks];
      await runBatch(allUnitTasks, LLM_CONCURRENCY);

      session.microSummaries[unitIdx] = microResults.filter((m): m is string => m !== null);
      saveSession(session);

      // Build unitMd from stored subtopics (order guaranteed by map keys)
      let unitMd = '';
      for (let s = 0; s < unitSubCount; s++) {
        const md = session.subtopicMarkdowns.get(`u${unitIdx}-s${s}`);
        if (md) unitMd += md + '\n\n';
      }
      session.unitMarkdowns[unitIdx] = unitMd;
      touch(session);

      // 2c: Combine micro-summaries into unit summary
      await throttle();
      const unitSummary = await retry(
        () =>
          combineUnitSummary(
            unit.unitTitle,
            session.microSummaries[unitIdx]!,
            session
          ),
        { max: 2, label: `unit-${unitIdx + 1}-summary` }
      );
      session.unitSummaries[unitIdx] = unitSummary;
      touch(session);

      // 2d + 2e: Unit End Summary + Unit Exercises in parallel
      logPhase(session.id, `unit ${unitIdx + 1} end-summary + exercises (parallel)`);
      const [endSummary, exercises] = await Promise.all([
        (async () => {
          session.phase = `unit-${unitIdx + 1}-summary`;
          await throttle();
          return retry(
            () => generateUnitEndSummary(session, unitIdx),
            { max: 2, label: `unit-${unitIdx + 1}-end-summary` }
          );
        })(),
        (async () => {
          session.phase = `unit-${unitIdx + 1}-exercises`;
          await throttle();
          return retry(
            () => generateUnitExercises(session, unitIdx),
            { max: 3, label: `unit-${unitIdx + 1}-exercises` }
          );
        })(),
      ]);

      session.unitEndSummaries[unitIdx] = endSummary;
      session.unitExercises[unitIdx] = exercises;
      touch(session);
      checkLimits(session);

      logPhase(session.id, `unit ${unitIdx + 1}/${unitCount} done`, { callCount: session.callCount });
      saveSession(session);

      session.microSummaries[unitIdx] = null;
    }

    // Phase 3-6: Capstones + Case Studies + Glossary + Bibliography (skip if already complete for resume)
    if (!isPostUnitsComplete(session)) {
      session.phase = 'post-units';
      touch(session);
      logPhase(session.id, 'phase: capstones + case-studies + glossary + bibliography (parallel)');

      const [capstones, caseStudies, glossary, bibliography] = await Promise.all([
      (async () => {
        await throttle();
        return retry(
          () => generateCapstones(session),
          { max: 3, label: 'capstones' }
        );
      })(),
      (async () => {
        await throttle();
        return retry(
          () => generateCaseStudies(session),
          { max: 3, label: 'case-studies' }
        );
      })(),
      (async () => {
        await throttle();
        return retry(
          () => generateGlossary(session),
          { max: 2, label: 'glossary' }
        );
      })(),
      (async () => {
        await throttle();
        return retry(
          () => generateBibliography(session),
          { max: 2, label: 'bibliography' }
        );
      })(),
    ]);

      session.capstonesMarkdown = capstones;
      session.caseStudiesMarkdown = caseStudies;
      session.glossaryMarkdown = glossary;
      session.bibliographyMarkdown = bibliography;
      touch(session);
      session.progress = 96;
      checkLimits(session);
      logPhase(session.id, 'post-units done');
      saveSession(session);
    } else {
      logPhase(session.id, 'resume: post-units already complete, skipping');
    }

    // Phase 7: Assembly (always rebuild final markdown so it's up to date)
    session.phase = 'assembly';
    touch(session);
    logPhase(session.id, 'phase: assembly');
    session.finalMarkdown = buildFinalMarkdown(session);
    touch(session);
    session.progress = 98;

    session.status = 'markdown_ready';
    session.phase = 'markdown_ready';
    logPhase(session.id, 'markdown ready — waiting for user approval before PDF');
    saveSession(session);
  } catch (error: unknown) {
    touch(session);
    logPhase(session.id, 'orchestrate failed', { error: error instanceof Error ? error.message : String(error) });
    session.status = 'failed';
    session.error = error instanceof Error ? error.message : String(error);
    session.finalMarkdown = null;
    // Do NOT clear structure, unitMarkdowns, microSummaries, unitSummaries, prefaceMarkdown,
    // unitIntroductions, unitEndSummaries, unitExercises, capstonesMarkdown, caseStudiesMarkdown,
    // glossaryMarkdown, bibliographyMarkdown, or subtopicMarkdowns — keep checkpoint data so resume can continue from last completed phase.
    saveSession(session);
  }
}

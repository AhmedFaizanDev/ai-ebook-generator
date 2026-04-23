#!/usr/bin/env tsx
/**
 * Smoke structural / table / asset stats for ingest (no LLM, no PDF export).
 * Usage: npx tsx src/cli/golden-ingest-validate.ts [path/to.docx]
 * Default: Shonkora sample path from the ingest hardening plan.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createSessionForIngest, deleteSession } from '@/lib/session-store';
import { ingestFileToSession } from '@/ingest/index';

const DEFAULT_DOCX = 'C:\\Users\\mfa77.000\\Downloads\\shonkora water supply project.docx';

function scoreMarkdown(md: string): {
  words: number;
  pipeTableRows: number;
  images: number;
  h2: number;
} {
  const words = md.trim().length ? md.trim().split(/\s+/).length : 0;
  const pipeTableRows = (md.match(/^\s*\|[^|\n]+\|/gm) ?? []).length;
  const images = (md.match(/^!\[[^\n]*\]\([^)]+\)\s*$/gm) ?? []).length;
  const h2 = (md.match(/^##\s+/gm) ?? []).length;
  return { words, pipeTableRows, images, h2 };
}

async function main(): Promise<void> {
  const file = path.resolve(process.argv[2] || DEFAULT_DOCX);
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  process.env.INGEST_STRICT_SOURCE_FIDELITY = '1';
  process.env.INGEST_REWRITE_QUALITY_GATE = '1';
  process.env.INGEST_TABLE_RECONSTRUCTION = 'confidence';

  const session = createSessionForIngest('golden-ingest', process.env.OPENAI_MODEL || 'gpt-4o-mini');
  try {
    const result = await ingestFileToSession(session, file, {
      deterministicOnly: true,
    });
    const md = session.finalMarkdown ?? '';
    const stats = scoreMarkdown(md);
    const report = {
      file,
      units: session.structure?.units.length ?? 0,
      sections: session.ingestSections?.length ?? 0,
      imageAssets: session.ingestImageAssets?.length ?? 0,
      ingestWarnings: session.ingestWarnings?.length ?? 0,
      resultWarnings: result.warnings.length,
      ...stats,
      prefaceSet: !!session.prefaceMarkdown,
      premiumFull: process.env.INGEST_PREMIUM_FULL === '1',
    };
    console.log(JSON.stringify(report, null, 2));
  } finally {
    deleteSession(session.id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';
import type { SessionState } from '@/lib/types';
import type { IngestImageAsset } from '@/ingest/types';
import { sectionizeIngestMarkdown } from '@/ingest/ingest-structure';
import { looksTechnicalForIngest } from '@/ingest/premium-ingest';

export const INGEST_BASELINE_MANIFEST_VERSION = 1 as const;

export interface IngestBaselineManifest {
  version: typeof INGEST_BASELINE_MANIFEST_VERSION;
  topic: string;
  author?: string;
  sessionId: string;
  sourcePath?: string;
  /** From original ingest (optional diagnostic). */
  estimatedSourcePages?: number;
  /** Absolute paths to image files at export time (Phase 2). */
  imageAssets: IngestImageAsset[];
}

export function buildBaselineManifest(
  session: SessionState,
  estimatedSourcePages?: number,
): IngestBaselineManifest {
  return {
    version: INGEST_BASELINE_MANIFEST_VERSION,
    topic: session.topic,
    author: session.author,
    sessionId: session.id,
    sourcePath: session.sourcePath,
    estimatedSourcePages,
    imageAssets: session.ingestImageAssets ?? [],
  };
}

export function writeBaselineManifest(
  filePath: string,
  session: SessionState,
  estimatedSourcePages?: number,
): void {
  const manifest = buildBaselineManifest(session, estimatedSourcePages);
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Copy ingest image files next to the baseline manifest so Phase 2 still resolves `rvimg://`
 * after Phase 1 deletes the temporary `.sessions/ingest/<id>/` folder.
 */
export function snapshotIngestImageAssetsForBaseline(
  destDir: string,
  baseName: string,
  assets: IngestImageAsset[],
): IngestImageAsset[] {
  if (!assets.length) return assets;
  const dirName = `${baseName}-baseline-assets`;
  const assetsRoot = path.join(destDir, dirName);
  fs.mkdirSync(assetsRoot, { recursive: true });
  return assets.map((a) => {
    const src = a.filePath;
    const ext = path.extname(src) || path.extname(a.relativePath || '') || '.bin';
    const destFile = `${a.id}${ext}`.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const dest = path.join(assetsRoot, destFile);
    try {
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        return {
          ...a,
          filePath: dest,
          relativePath: `${dirName}/${destFile}`,
        };
      }
    } catch {
      // fall through
    }
    return { ...a };
  });
}

export function readBaselineManifest(filePath: string): IngestBaselineManifest {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const obj = JSON.parse(raw) as IngestBaselineManifest;
  if (obj.version !== INGEST_BASELINE_MANIFEST_VERSION) {
    throw new Error(`Unsupported baseline manifest version: ${obj.version}`);
  }
  return obj;
}

/**
 * Load baseline markdown + manifest into session (no file ingest). Call before Phase-2 enhance.
 */
export function hydrateSessionFromBaselineMarkdown(
  session: SessionState,
  markdown: string,
  manifest: IngestBaselineManifest,
): void {
  session.ingestMode = true;
  session.topic = manifest.topic || session.topic;
  if (manifest.author) session.author = manifest.author;
  if (manifest.sourcePath) session.sourcePath = manifest.sourcePath;
  session.ingestImageAssets = manifest.imageAssets ?? [];
  session.finalMarkdown = markdown.trim();

  const technical = looksTechnicalForIngest(session.topic, session.sourcePath ?? '');
  const eqEnv = (process.env.INGEST_EQUATIONS || '').toLowerCase();
  const forceEquations = eqEnv === '1' || eqEnv === 'true' || eqEnv === 'yes';
  session.visuals = {
    ...session.visuals,
    equations: { enabled: forceEquations || technical },
    mermaid: { enabled: true },
    strictMode: false,
  };

  const sectionized = sectionizeIngestMarkdown(session.finalMarkdown, session.topic);
  session.structure = sectionized.structure;
  session.ingestSections = sectionized.sections;
  session.subtopicMarkdowns.clear();
  session.unitMarkdowns = sectionized.structure.units.map(() => null);
  for (const sec of session.ingestSections) {
    session.subtopicMarkdowns.set(`u${sec.unitIndex}-s${sec.subtopicIndex}`, sec.markdown);
  }
}

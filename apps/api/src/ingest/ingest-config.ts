/**
 * Central env readers for ingest quality / fidelity knobs.
 * See apps/api/.env.example for documentation.
 */

export function isEnvTruthy(name: string): boolean {
  const v = (process.env[name] || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** Tighter LLM prompts + stronger validator expectations. */
export function isStrictSourceFidelity(): boolean {
  return isEnvTruthy('INGEST_STRICT_SOURCE_FIDELITY');
}

/** When a post-rewrite section fails checks, revert to pre-LLM text for that section. */
export function isRewriteQualityGateEnabled(): boolean {
  return isEnvTruthy('INGEST_REWRITE_QUALITY_GATE');
}

/**
 * Long preface / unit intro / recap scaffolding (legacy premium).
 * Default ingest premium is minimal unless this is set.
 */
export function isPremiumFullScaffolding(): boolean {
  return isEnvTruthy('INGEST_PREMIUM_FULL');
}

export type TableReconstructionMode = 'always' | 'confidence' | 'never';

/** How aggressively to keep or rebuild GFM pipe tables from DOCX/HTML. */
export function getTableReconstructionMode(): TableReconstructionMode {
  const v = (process.env.INGEST_TABLE_RECONSTRUCTION || 'confidence').toLowerCase();
  if (v === 'always' || v === 'force') return 'always';
  if (v === 'never' || v === 'off' || v === '0') return 'never';
  return 'confidence';
}

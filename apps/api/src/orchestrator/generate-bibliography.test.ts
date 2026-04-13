import { describe, it, expect } from 'vitest';
import { validateBibliographyMarkdown } from './generate-bibliography';
import type { VisualConfig } from '@/lib/types';

const visuals: VisualConfig = {
  equations: { enabled: false },
  mermaid: { enabled: false },
  strictMode: true,
  autoFixAttempts: 1,
};

function bibWithBullets(bullets: string): string {
  return `# Bibliography

### Books
${bullets}

### Research Papers & Standards
- Chen, "Stability Notes," IEEE Trans. Autom. Control, 2015.

### Online Resources
- NIST, "Digital Resources," NIST, 2023.
- OECD, "Policy Briefs," OECD, 2022.`;
}

describe('validateBibliographyMarkdown — citation shape', () => {
  it('accepts well-formed entries', () => {
    const md = bibWithBullets(
      `- H. K. Khalil, "Nonlinear Systems," Prentice Hall, 2002.
- J. M. Maciejowski, "Predictive Control with Constraints," Prentice Hall, 2002.`,
    );
    const r = validateBibliographyMarkdown(md, visuals);
    expect(r.pass).toBe(true);
  });

  it('rejects run-on author initials', () => {
    const md = bibWithBullets(
      `- A. V. B. V. R. S. R. S. P., "Nonlinear Control Systems," Springer, 2011.
- J. M. Maciejowski, "Predictive Control with Constraints," Prentice Hall, 2002.`,
    );
    const r = validateBibliographyMarkdown(md, visuals);
    expect(r.pass).toBe(false);
    expect(r.reasons.some((x) => x.includes('initials'))).toBe(true);
  });

  it('rejects ellipsis / truncation in author', () => {
    const md = bibWithBullets(
      `- D. G. Luenh..., "Optimization by Vector Space Methods," Wiley, 1969.
- J. M. Maciejowski, "Predictive Control with Constraints," Prentice Hall, 2002.`,
    );
    const r = validateBibliographyMarkdown(md, visuals);
    expect(r.pass).toBe(false);
    expect(r.reasons.some((x) => x.includes('ellipsis') || x.includes('truncation'))).toBe(true);
  });

  it('rejects missing opening quote before title', () => {
    const md = bibWithBullets(
      `- D. G. Luenberger, Optimization by Vector Space Methods," Wiley, 1969.
- J. M. Maciejowski, "Predictive Control with Constraints," Prentice Hall, 2002.`,
    );
    const r = validateBibliographyMarkdown(md, visuals);
    expect(r.pass).toBe(false);
    expect(r.reasons.some((x) => x.includes('opening') || x.includes('comma'))).toBe(true);
  });
});

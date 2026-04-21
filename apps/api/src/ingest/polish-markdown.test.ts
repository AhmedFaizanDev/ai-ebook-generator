import { describe, it, expect } from 'vitest';
import { splitByTopLevelHeading } from '@/ingest/polish-markdown';

describe('splitByTopLevelHeading', () => {
  it('splits on ATX H1 only', () => {
    const md = `# A\n\nx\n\n# B\n\ny`;
    const parts = splitByTopLevelHeading(md);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('# A');
    expect(parts[1]).toContain('# B');
  });

  it('does not split on H2', () => {
    const md = `# One\n\n## Two\n\nbody`;
    expect(splitByTopLevelHeading(md)).toHaveLength(1);
  });
});

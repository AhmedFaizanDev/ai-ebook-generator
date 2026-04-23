import { describe, expect, it } from 'vitest';
import { shouldStripNonNarrativeSection } from '@/ingest/ingest-main-body-filter';

describe('shouldStripNonNarrativeSection', () => {
  it('strips collapsed Word TOC merged as (from source)', () => {
    expect(shouldStripNonNarrativeSection('Any', 'Table of contents (from source)')).toBe(true);
  });

  it('strips standalone TABLE OF CONTENTS when body looks like dot-leader TOC', () => {
    const md = `## TABLE OF CONTENTS

Introduction .......... 1
Methods ............... 5
Results ............... 9
Discussion ............ 12
Conclusion ............ 18`;
    expect(shouldStripNonNarrativeSection('Body', 'TABLE OF CONTENTS', md)).toBe(true);
  });

  it('does not strip declaration-style sections by default', () => {
    expect(shouldStripNonNarrativeSection('DECLARATION', 'Introduction')).toBe(false);
    expect(shouldStripNonNarrativeSection('Front matter', 'ACKNOWLEDGEMENT')).toBe(false);
  });
});

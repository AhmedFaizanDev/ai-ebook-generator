import { describe, it, expect } from 'vitest';
import { parsePdfimagesList } from '@/ingest/pdf-poppler';

describe('parsePdfimagesList', () => {
  it('parses typical poppler list header and rows', () => {
    const stdout = `page   num  type   width height color comp bpc  enc interp  object ID x-ppi y-ppi size ratio
--------------------------------------------------------------------------------------------
   1     0 image   100   200  rgb     3   8  image  yes       12  0   150  150   1234  N
   2     1 image   100   200  rgb     3   8  image  yes       13  0   150  150   2345  N
`;
    const rows = parsePdfimagesList(stdout);
    expect(rows.map((r) => r.page)).toEqual([1, 2]);
    expect(rows.map((r) => r.index)).toEqual([0, 1]);
  });
});

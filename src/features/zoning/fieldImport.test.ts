import { describe, expect, it } from 'vitest';
import { importFieldCsv } from './fieldImport';

const header = 'row,column,ph,nitrogen,phosphorus,potassium,ec,soil_temperature';

describe('importFieldCsv', () => {
  it('creates an importable field grid from complete observations', () => {
    const result = importFieldCsv(`${header}\n1,1,6.2,42,24,165,1.2,22\n1,2,6.3,44,25,170,1.3,22.4`, 'north.csv');
    expect(result.errors).toEqual([]);
    expect(result.field?.source).toBe('imported');
    expect(result.field?.cells).toHaveLength(2);
  });

  it('rejects incomplete headers and duplicate coordinates', () => {
    expect(importFieldCsv('row,column,ph\n1,1,6.2', 'bad.csv').errors[0]).toContain('Missing required columns');
    expect(importFieldCsv(`${header}\n1,1,6.2,42,24,165,1.2,22\n1,1,6.3,44,25,170,1.3,22.4`, 'duplicate.csv').errors[0]).toContain('duplicated');
  });
});

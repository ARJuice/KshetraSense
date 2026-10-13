import { describe, expect, it } from 'vitest';
import { createCsvImportPreview } from './csvImport';

const HEADER = 'sample_id,collected_at,latitude,longitude,ph,ec_ds_m,nitrogen_mg_kg,phosphorus_mg_kg,potassium_mg_kg,source';

describe('createCsvImportPreview', () => {
  it('accepts a complete soil record and keeps its declared units', () => {
    const preview = createCsvImportPreview(
      `${HEADER}\nSE-014,2026-10-11,12.9716,77.5946,6.4,1.42,48,24,180,Lab A`,
      'samples.csv',
    );

    expect(preview.issues).toEqual([]);
    expect(preview.accepted).toHaveLength(1);
    expect(preview.accepted[0]).toMatchObject({
      sampleId: 'SE-014',
      ph: 6.4,
      ecDsM: 1.42,
      nitrogenMgKg: 48,
      provenance: 'csv-import',
    });
  });

  it('reports missing columns and invalid values without accepting the row', () => {
    const preview = createCsvImportPreview(
      'sample_id,collected_at,latitude,longitude,ph,ec_ds_m,nitrogen_mg_kg,phosphorus_mg_kg,potassium_mg_kg\nSE-014,not-a-date,300,77,20,1,2,3,4',
      'broken.csv',
    );

    expect(preview.accepted).toHaveLength(0);
    expect(preview.issues[0].message).toContain('source');
  });

  it('does not coerce an empty numeric field into zero', () => {
    const preview = createCsvImportPreview(
      `${HEADER}\nSE-014,2026-10-11,12.9716,77.5946,,1.42,48,24,180,Lab A`,
      'incomplete.csv',
    );

    expect(preview.accepted).toHaveLength(0);
    expect(preview.issues[0].message).toContain('ph is required');
  });

  it('handles quoted values when building a row', () => {
    const preview = createCsvImportPreview(
      `${HEADER},notes\nSE-014,2026-10-11,12.9716,77.5946,6.4,1.42,48,24,180,"Lab, A","Composite sample, 0-15 cm"`,
      'quoted.csv',
    );

    expect(preview.accepted[0].source).toBe('Lab, A');
    expect(preview.accepted[0].notes).toBe('Composite sample, 0-15 cm');
  });

  it('parses optional depth, method, and moisture context correctly', () => {
    const preview = createCsvImportPreview(
      `${HEADER},depth_cm,method,moisture_pct,moisture_unit\nSE-015,2026-10-12,12.9716,77.5946,6.8,0.85,55,30,210,Lab B,15,Mehlich-3,22.5,% gravimetric`,
      'extended.csv',
    );

    expect(preview.issues).toEqual([]);
    expect(preview.accepted).toHaveLength(1);
    expect(preview.accepted[0]).toMatchObject({
      sampleId: 'SE-015',
      depthCm: 15,
      depthInterval: '0-15 cm',
      method: 'Mehlich-3',
      moisturePercentage: 22.5,
      moistureUnit: '% gravimetric',
    });
  });
});


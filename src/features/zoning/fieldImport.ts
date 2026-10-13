import type { FieldGrid, SoilCell, SoilFeatureKey } from '../../domain/soil';

const REQUIRED_HEADERS = ['row', 'column', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'ec', 'soil_temperature'] as const;

export interface FieldImportResult {
  field?: FieldGrid;
  errors: string[];
}

export const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; value = '';
    } else value += character;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const toNumber = (raw: string, label: string, rowNumber: number, errors: string[]) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) errors.push(`Row ${rowNumber}: ${label} must be a number.`);
  return parsed;
};

export function importFieldCsv(content: string, name: string): FieldImportResult {
  const rows = parseCsvRows(content.replace(/^\uFEFF/, ''));
  if (rows.length < 2) return { errors: ['The file needs a header row and at least two observations.'] };
  const headers = rows[0].map((header) => header.toLowerCase());
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) return { errors: [`Missing required columns: ${missing.join(', ')}.`] };
  const cells: SoilCell[] = [];
  const errors: string[] = [];
  const seenCoordinates = new Set<string>();
  for (const [index, cellsInRow] of rows.slice(1).entries()) {
    const line = index + 2;
    const record = Object.fromEntries(headers.map((header, position) => [header, cellsInRow[position] ?? '']));
    const row = toNumber(record.row, 'row', line, errors);
    const column = toNumber(record.column, 'column', line, errors);
    const values = {
      ph: toNumber(record.ph, 'ph', line, errors),
      nitrogen: toNumber(record.nitrogen, 'nitrogen', line, errors),
      phosphorus: toNumber(record.phosphorus, 'phosphorus', line, errors),
      potassium: toNumber(record.potassium, 'potassium', line, errors),
      ec: toNumber(record.ec, 'ec', line, errors),
      soilTemperature: toNumber(record.soil_temperature, 'soil_temperature', line, errors),
    } satisfies Record<SoilFeatureKey, number>;
    if (!Number.isInteger(row) || row < 1 || !Number.isInteger(column) || column < 1) errors.push(`Row ${line}: row and column must be positive integers.`);
    const coordinate = `${row}:${column}`;
    if (seenCoordinates.has(coordinate)) errors.push(`Row ${line}: coordinate (${row}, ${column}) is duplicated.`);
    seenCoordinates.add(coordinate);
    cells.push({ id: `r${row}-c${column}`, row, column, values });
  }
  if (errors.length) return { errors: errors.slice(0, 8) };
  if (cells.length < 2) return { errors: ['At least two observations are required.'] };
  return {
    field: {
      name: name.replace(/\.csv$/i, '') || 'Imported field',
      source: 'imported',
      rows: Math.max(...cells.map((cell) => cell.row)),
      columns: Math.max(...cells.map((cell) => cell.column)),
      cells,
    },
    errors: [],
  };
}

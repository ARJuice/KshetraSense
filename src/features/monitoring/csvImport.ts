import { getMissingRequiredHeaders, validateSoilSampleRow } from './soilSampleValidation';
import type { CsvImportPreview, ImportIssue } from './types';

const parseCsvRows = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
};

export const createCsvImportPreview = (content: string, fileName: string): CsvImportPreview => {
  const rows = parseCsvRows(content.replace(/^\uFEFF/, ''));
  if (rows.length === 0) {
    return { fileName, totalRows: 0, accepted: [], issues: [{ row: 0, message: 'The file is empty.' }] };
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const missingHeaders = getMissingRequiredHeaders(headers);
  if (missingHeaders.length > 0) {
    return {
      fileName,
      totalRows: Math.max(0, rows.length - 1),
      accepted: [],
      issues: [{ row: 1, message: `Missing required columns: ${missingHeaders.join(', ')}.` }],
    };
  }

  const accepted: CsvImportPreview['accepted'] = [];
  const issues: ImportIssue[] = [];
  const acceptedIds = new Set<string>();
  rows.slice(1).forEach((cells, rowIndex) => {
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
    const result = validateSoilSampleRow(row, 'csv-import');
    if (result.value && acceptedIds.has(result.value.sampleId)) {
      issues.push({ row: rowIndex + 2, message: `sample_id “${result.value.sampleId}” is duplicated in this import.` });
    } else if (result.value) {
      accepted.push(result.value);
      acceptedIds.add(result.value.sampleId);
    } else {
      issues.push({ row: rowIndex + 2, message: result.errors.join(' ') });
    }
  });

  return { fileName, totalRows: rows.length - 1, accepted, issues };
};

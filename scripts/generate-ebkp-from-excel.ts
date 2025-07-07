import fs from 'fs';
import * as XLSX from 'xlsx';
import path from 'path';

interface Entry {
  level: number;
  ebene: string;
  code: string;
  bezeichnung: string;
}

// Get the Excel file path from command line argument or use default
const excelPath = process.argv[2] || 'C:\\Users\\louistrue\\Dropbox\\02_Ressourcen\\02_BIM\\11_CRB\\CRB_ifc_Regelsatz_eBKP-H2020_BETA_1.0.xlsx';

console.log('Reading Excel file from:', excelPath);

// Read the Excel file
const workbook = XLSX.readFile(excelPath);

// Show all available sheets
console.log('Available sheets:', workbook.SheetNames);

// Use the specific sheet name for EBKP data
const targetSheetName = 'CRB_eBKP-H-Ifc';
let worksheet;

if (workbook.SheetNames.includes(targetSheetName)) {
  worksheet = workbook.Sheets[targetSheetName];
  console.log('Processing sheet:', targetSheetName);
} else {
  console.log(`Sheet "${targetSheetName}" not found. Using first sheet:`, workbook.SheetNames[0]);
  worksheet = workbook.Sheets[workbook.SheetNames[0]];
}

// Convert to JSON
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

console.log('First few rows of data:');
jsonData.slice(0, 5).forEach((row, index) => {
  console.log(`Row ${index}:`, row);
});

// Process the data - skip header row if present
const entries: Entry[] = [];
let startRow = 0;

// Check if first row is header
if (jsonData[0] && typeof jsonData[0][0] === 'string' && isNaN(parseInt(jsonData[0][0]))) {
  startRow = 1;
  console.log('Skipping header row');
}

for (let i = startRow; i < jsonData.length; i++) {
  const row = jsonData[i];
  if (row && row.length >= 4 && row[0]) {
    const entry: Entry = {
      level: parseInt(row[0].toString(), 10),
      ebene: (row[1] || '').toString().trim(),
      code: (row[2] || '').toString().trim(),
      bezeichnung: (row[3] || '').toString().trim(),
    };
    
    if (!isNaN(entry.level) && entry.code) {
      entries.push(entry);
    }
  }
}

console.log(`Processed ${entries.length} entries`);

type EBKPStructured = Record<string, Record<string, { code: string; label: string }[]>>;
const structured: EBKPStructured = {};

let currentHaupt = '';
let currentGruppe = '';

for (const entry of entries) {
  if (entry.level === 1) {
    currentHaupt = entry.code;
    structured[currentHaupt] = {};
  } else if (entry.level === 2) {
    currentGruppe = entry.code;
    if (!structured[currentHaupt]) structured[currentHaupt] = {};
    structured[currentHaupt][currentGruppe] = [];
  } else if (entry.level === 3) {
    structured[currentHaupt][currentGruppe].push({
      code: entry.code,
      label: entry.bezeichnung,
    });
  }
}

// Write JSON with labels
fs.writeFileSync('./ebkp-structured.json', JSON.stringify(structured, null, 2));
console.log('Written: ebkp-structured.json');

// Types
const allHaupt = Object.keys(structured).sort();
const allGruppen = Object.entries(structured).flatMap(([_, gruppen]) => Object.keys(gruppen)).sort();
const allCodes = Object.values(structured)
  .flatMap(gruppen => Object.values(gruppen))
  .flat()
  .map(e => e.code)
  .sort();

const tsOutput = `
export type EBKPHauptgruppe = ${allHaupt.map(h => `'${h}'`).join(' | ')};

export type EBKPElementgruppe =
  ${allGruppen.map(g => `'${g}'`).join(' |\n  ')};

export type EBKPElement =
  ${allCodes.map(c => `'${c}'`).join(' |\n  ')};

export const EBKP_STRUCTURE = ${JSON.stringify(structured, null, 2)} as const;
`;

fs.writeFileSync('./ebkp-types.ts', tsOutput.trim());
console.log('Written: ebkp-types.ts');

console.log('\nSummary:');
console.log(`- Hauptgruppen: ${allHaupt.length}`);
console.log(`- Elementgruppen: ${allGruppen.length}`);
console.log(`- Elements: ${allCodes.length}`); 
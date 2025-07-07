import fs from 'fs';
import path from 'path';
import { EBKP_STRUCTURE } from '../src/data/ebkp-types';

const raw_data: [string, number[]][] = [
    ["B06.01", [60]],
    ["B06.02", [60]],
    ["B06.04", [60]],
    ["B07.02", [60]],
    ["C01", [60]],
    ["C02.01", [60]],
    ["C02.02", [60]],
    ["C03", [60]],
    ["C04.01", [60]],
    ["C04.04", [60]],
    ["C04.05", [60]],
    ["C04.08", [40]],
    ["D01", [30]],
    ["D05.02", [20, 40, 30]], // Wärmeerzeugung: 20 (allg.), Erdwärmesonden: 40, Solarkollektoren: 30
    ["D05.04", [30]],
    ["D05.05", [30]],
    ["D07", [30]],
    ["D08", [30]],
    ["E01", [60]],
    ["E02.01", [30]],
    ["E02.02", [30]],
    ["E02.03", [40]],
    ["E02.04", [40]],
    ["E02.05", [40]],
    ["E03", [30]],
    ["F01.01", [60]],
    ["F01.02", [30]],
    ["F01.03", [40]],
    ["F02", [30]],
    ["G01", [30]],
    ["G02", [30]],
    ["G03", [30]],
    ["G04", [30]]
];

interface EBKPWithAmortization {
  code: string;
  label: string;
  amortizationYears?: number[];
}

interface EBKPStructuredWithAmortization {
  [hauptgruppe: string]: {
    [elementgruppe: string]: EBKPWithAmortization[];
  };
}

// Create amortization lookup map
const amortizationMap = new Map<string, number[]>();
raw_data.forEach(([code, years]) => {
  amortizationMap.set(code, years);
});

console.log('Processing EBKP structure with amortization data...');
console.log(`Found ${raw_data.length} amortization entries`);

// Create new structure with amortization
const structuredWithAmortization: EBKPStructuredWithAmortization = {};

// Process each hauptgruppe
for (const [hauptgruppe, elementgruppen] of Object.entries(EBKP_STRUCTURE)) {
  structuredWithAmortization[hauptgruppe] = {};
  
  // Process each elementgruppe
  for (const [elementgruppe, elements] of Object.entries(elementgruppen)) {
    structuredWithAmortization[hauptgruppe][elementgruppe] = [];
    
    // Check if there's a group-level amortization (e.g., "E01" applies to all E01.xx)
    const groupAmortization = amortizationMap.get(elementgruppe);
    
    // Process each element
    for (const element of elements) {
      const elementWithAmortization: EBKPWithAmortization = {
        code: element.code,
        label: element.label
      };
      
      // Check for specific element amortization first
      const specificAmortization = amortizationMap.get(element.code);
      if (specificAmortization) {
        elementWithAmortization.amortizationYears = specificAmortization;
      } else if (groupAmortization) {
        // Apply group-level amortization
        elementWithAmortization.amortizationYears = groupAmortization;
      }
      
      structuredWithAmortization[hauptgruppe][elementgruppe].push(elementWithAmortization);
    }
  }
}

// Count elements with amortization
let elementsWithAmortization = 0;
let totalElements = 0;

for (const elementgruppen of Object.values(structuredWithAmortization)) {
  for (const elements of Object.values(elementgruppen)) {
    for (const element of elements) {
      totalElements++;
      if (element.amortizationYears) {
        elementsWithAmortization++;
      }
    }
  }
}

console.log(`Applied amortization to ${elementsWithAmortization} out of ${totalElements} elements`);

// Write JSON with amortization
fs.writeFileSync(path.resolve(__dirname, 'ebkp-with-amortization.json'), JSON.stringify(structuredWithAmortization, null, 2));
console.log('Written: ebkp-with-amortization.json');

// Generate TypeScript types and constants
const allElementsWithAmortization = Object.values(structuredWithAmortization)
  .flatMap(elementgruppen => Object.values(elementgruppen))
  .flat()
  .filter(element => element.amortizationYears);

const allAmortizationYears = [...new Set(
  allElementsWithAmortization.flatMap(element => element.amortizationYears || [])
)].sort((a, b) => a - b);

const tsOutput = `
export interface EBKPWithAmortization {
  code: string;
  label: string;
  amortizationYears?: number[];
}

export interface EBKPStructuredWithAmortization {
  [hauptgruppe: string]: {
    [elementgruppe: string]: EBKPWithAmortization[];
  };
}

export type AmortizationYears = ${allAmortizationYears.map(y => `${y}`).join(' | ')};

export const EBKP_STRUCTURE_WITH_AMORTIZATION = ${JSON.stringify(structuredWithAmortization, null, 2)} as const;

export const ELEMENTS_WITH_AMORTIZATION = [
${allElementsWithAmortization.map(element => 
  `  { code: '${element.code}', label: '${element.label}', amortizationYears: [${element.amortizationYears?.join(', ')}] }`
).join(',\n')}
] as const;

export const AMORTIZATION_LOOKUP = new Map<string, number[]>([
${allElementsWithAmortization.map(element => 
  `  ['${element.code}', [${element.amortizationYears?.join(', ')}]]`
).join(',\n')}
]);
`;

fs.writeFileSync(path.resolve(__dirname, 'ebkp-with-amortization-types.ts'), tsOutput.trim());
console.log('Written: ebkp-with-amortization-types.ts');

// Create a summary report
const summaryByAmortization = allAmortizationYears.map(years => {
  const elements = allElementsWithAmortization.filter(e => e.amortizationYears?.includes(years));
  return {
    years,
    count: elements.length,
    examples: elements.slice(0, 3).map(e => `${e.code} (${e.label})`)
  };
});

console.log('\nAmortization Summary:');
summaryByAmortization.forEach(({ years, count, examples }) => {
  console.log(`- ${years} years: ${count} elements`);
  console.log(`  Examples: ${examples.join(', ')}`);
});

// Show group-level applications
console.log('\nGroup-level amortization applications:');
const groupApplications = raw_data.filter(([code]) => !code.includes('.'));
groupApplications.forEach(([groupCode, years]) => {
  const elementsInGroup = Object.values(structuredWithAmortization)
    .flatMap(elementgruppen => Object.values(elementgruppen))
    .flat()
    .filter(element => element.code.startsWith(groupCode + '.'));
  
  console.log(`- ${groupCode} (${years[0]} years) → applied to ${elementsInGroup.length} elements`);
  if (elementsInGroup.length > 0) {
    console.log(`  Examples: ${elementsInGroup.slice(0, 3).map(e => e.code).join(', ')}`);
  }
}); 
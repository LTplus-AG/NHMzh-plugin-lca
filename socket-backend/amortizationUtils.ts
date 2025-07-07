import { AMORTIZATION_LOOKUP } from './data/ebkp-with-amortization-types';

/**
 * Gets the amortization years for a given EBKP code.
 * If multiple options are available, returns the first one as default.
 * @param ebkpCode - The EBKP code to look up
 * @param defaultYears - Default value if no amortization data is found
 * @returns The amortization years for the EBKP code
 */
export function getAmortizationYears(ebkpCode: string, defaultYears: number = 50): number {
  const amortizationOptions = AMORTIZATION_LOOKUP.get(ebkpCode);
  
  if (amortizationOptions && amortizationOptions.length > 0) {
    // Return the first option as default
    return amortizationOptions[0];
  }
  
  return defaultYears;
}

/**
 * Gets all amortization options for a given EBKP code.
 * @param ebkpCode - The EBKP code to look up
 * @returns Array of amortization years, or empty array if none found
 */
export function getAmortizationOptions(ebkpCode: string): number[] {
  return AMORTIZATION_LOOKUP.get(ebkpCode) || [];
}

/**
 * Checks if an EBKP code has amortization data
 * @param ebkpCode - The EBKP code to check
 * @returns True if amortization data exists for this code
 */
export function hasAmortizationData(ebkpCode: string): boolean {
  return AMORTIZATION_LOOKUP.has(ebkpCode);
}

/**
 * Gets all EBKP codes that have amortization data
 * @returns Array of EBKP codes with amortization data
 */
export function getEbkpCodesWithAmortization(): string[] {
  return Array.from(AMORTIZATION_LOOKUP.keys());
}

/**
 * Creates a backward-compatible lookup object for migration purposes
 * @param defaultYears - Default amortization years for codes with multiple options
 * @returns Record mapping EBKP codes to single amortization values
 */
export function createLegacyAmortizationMap(defaultYears: number = 50): Record<string, number> {
  const legacyMap: Record<string, number> = {};
  
  for (const [ebkpCode, amortizationOptions] of AMORTIZATION_LOOKUP.entries()) {
    // Use first option as default for backward compatibility
    legacyMap[ebkpCode] = amortizationOptions[0] || defaultYears;
  }
  
  return legacyMap;
} 
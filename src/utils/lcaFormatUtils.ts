import { OutputFormats } from '../types/lca.types';
import { DisplayMode } from './lcaDisplayHelper';
import { DEFAULT_AMORTIZATION_YEARS } from './constants';

/**
 * Formats a number using Swiss locale formatting
 * @param num The number to format
 * @param decimals Number of decimal places (default: 3)
 * @returns Formatted number string or "0" if invalid
 */
export const formatNumber = (
  num: number | null | undefined,
  decimals: number = 3
): string => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return new Intl.NumberFormat("de-CH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(num);
};

/**
 * Gets the display value based on display mode and EBF
 * @param value The raw value
 * @param displayMode The display mode (absolute or relative)
 * @param ebfNumeric The EBF numeric value
 * @param amortizationYears The amortization years (default: DEFAULT_AMORTIZATION_YEARS)
 * @returns The calculated display value
 */
export const getDisplayValue = (
  value: number | undefined,
  displayMode: DisplayMode,
  ebfNumeric: number | null,
  amortizationYears: number = DEFAULT_AMORTIZATION_YEARS
): number => {
  if (value === undefined) return 0;
  if (displayMode === "relative" && ebfNumeric !== null && ebfNumeric > 0) {
    return value / (amortizationYears * ebfNumeric);
  }
  return value;
};

/**
 * Formats a display value with proper formatting
 * @param value The raw value
 * @param displayMode The display mode (absolute or relative)
 * @param ebfNumeric The EBF numeric value
 * @param amortizationYears The amortization years (default: DEFAULT_AMORTIZATION_YEARS)
 * @returns Formatted display value string
 */
export const formatDisplayValue = (
  value: number | undefined,
  displayMode: DisplayMode,
  ebfNumeric: number | null,
  amortizationYears: number = DEFAULT_AMORTIZATION_YEARS
): string => {
  const displayValue = getDisplayValue(value, displayMode, ebfNumeric, amortizationYears);
  return formatNumber(displayValue, 3);
};

/**
 * Gets the unit string for a given output format and display mode
 * @param outputFormat The output format (GWP, UBP, PENR)
 * @param displayMode The display mode (absolute or relative)
 * @returns The unit string
 */
export const getUnitForOutputFormat = (
  outputFormat: OutputFormats,
  displayMode: DisplayMode
): string => {
  let baseUnit = "";
  switch (outputFormat) {
    case OutputFormats.GWP:
      baseUnit = "kg CO₂-eq";
      break;
    case OutputFormats.UBP:
      baseUnit = "UBP";
      break;
    case OutputFormats.PENR:
      baseUnit = "kWh";
      break;
    default:
      baseUnit = "";
  }
  if (displayMode === "relative") {
    return `${baseUnit}/m²·a`;
  }
  return baseUnit;
}; 
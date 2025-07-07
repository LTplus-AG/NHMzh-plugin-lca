// Default amortization years for fallback when no EBKP-specific data is available
export const DEFAULT_AMORTIZATION_YEARS = 30;

// Environmental impact calculation constants
export const ENVIRONMENTAL_IMPACT_FACTORS = {
  GWP: "gwp", // Global Warming Potential
  UBP: "ubp", // Umweltbelastungspunkte
  PENR: "penr", // Primary Energy Non-Renewable
} as const; 
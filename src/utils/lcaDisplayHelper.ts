// This helper now uses element-specific amortization years passed as parameters

// Define display mode type
export type DisplayMode = "total" | "relative";

export class LCADisplayHelper {
  /**
   * Gets the appropriate divisor and suffix for formatting based on display mode and EBF
   * @param displayMode - Display mode (total or relative)
   * @param ebf - Energy reference area
   * @param amortizationYears - Element-specific amortization years
   */
  static getDivisorAndSuffix(
    displayMode: DisplayMode,
    ebf: number | null,
    amortizationYears: number
  ): { divisor: number; suffix: string; error?: string } {
    if (displayMode === "relative") {
      if (ebf !== null && ebf > 0) {
        return { divisor: amortizationYears * ebf, suffix: "/m²·Jahr" }; // Use middot for clarity
      } else {
        // Return error state if relative mode selected but EBF invalid
        return { divisor: 1, suffix: "", error: "N/A (EBF fehlt)" };
      }
    }
    // Default for 'total' mode
    return { divisor: 1, suffix: "" };
  }
}

import {
  OutputFormats,
  Material,
  UnmodelledMaterial,
  KbobMaterial,
  ImpactResults,
  LcaElement,
} from "../types/lca.types";
import { DisplayMode, LCADisplayHelper } from "./lcaDisplayHelper";
import { LCAFormatter } from "./lcaFormatter";
import { LCAImpactCalculator } from "./lcaImpactCalculator";
import { DEFAULT_AMORTIZATION_YEARS } from "./constants";
import { getAmortizationYears } from "./amortizationUtils";

export class LCACalculator {
  /**
   * Calculates the overall impact of materials, with options for display mode and EBF
   */
  calculateImpact(
    materials: Material[],
    matches: Record<string, string>,
    kbobMaterials: KbobMaterial[],
    unmodelledMaterials: UnmodelledMaterial[] = [],
    materialDensities: Record<string, number> = {},
    displayMode: DisplayMode = "total",
    ebf: number | null = null
  ): {
    gwp: number | null;
    ubp: number | null;
    penr: number | null;
    modelledMaterials: number;
    unmodelledMaterials: number;
  } {
    let totalGWP = 0;
    let totalUBP = 0;
    let totalPENR = 0;
    let modelledMaterialCount = 0;
    let unmodelledMaterialCount = 0;

    const { divisor, error } = LCADisplayHelper.getDivisorAndSuffix(
      displayMode,
      ebf,
      DEFAULT_AMORTIZATION_YEARS
    );

    // If relative mode requested but EBF invalid, return null impacts
    if (error) {
      return {
        gwp: null,
        ubp: null,
        penr: null,
        modelledMaterials: 0,
        unmodelledMaterials: 0,
      };
    }

    // Create a Map for faster lookups
    const kbobMaterialMap = new Map(kbobMaterials.map((k) => [k.id, k]));

    // Calculate impacts for modelled materials
    for (const material of materials) {
      const kbobMaterial = kbobMaterialMap.get(matches[material.id]);
      const impacts = LCAImpactCalculator.calculateMaterialImpact(
        material,
        kbobMaterial,
        materialDensities
      );

      if (impacts.gwp > 0 || impacts.ubp > 0 || impacts.penr > 0) {
        totalGWP += impacts.gwp;
        totalUBP += impacts.ubp;
        totalPENR += impacts.penr;
        modelledMaterialCount++;
      } else {
        unmodelledMaterialCount++;
      }
    }

    // Calculate impacts for unmodelled materials
    for (const material of unmodelledMaterials) {
      const kbobMaterial = kbobMaterialMap.get(material.kbobId);
      if (kbobMaterial) {
        const impacts = LCAImpactCalculator.calculateMaterialImpact(
          material,
          kbobMaterial,
          materialDensities
        );
        totalGWP += impacts.gwp;
        totalUBP += impacts.ubp;
        totalPENR += impacts.penr;
        unmodelledMaterialCount++;
      }
    }

    // Apply divisor based on display mode
    const finalGWP = totalGWP / divisor;
    const finalUBP = totalUBP / divisor;
    const finalPENR = totalPENR / divisor;

    return {
      gwp: finalGWP,
      ubp: finalUBP,
      penr: finalPENR,
      modelledMaterials: modelledMaterialCount,
      unmodelledMaterials: unmodelledMaterialCount,
    };
  }

  /**
   * Format an impact value with the formatter
   */
  formatImpact(
    value: number | string,
    type: OutputFormats,
    includeUnit = false
  ): string {
    return LCAFormatter.formatImpact(value, type, includeUnit);
  }

  /**
   * Calculates and formats a grand total value for display in the UI
   * @deprecated Use calculateGrandTotalWithElements for accurate element-specific amortization
   */
  calculateGrandTotal(
    materials: Material[],
    matches: Record<string, string>,
    kbobMaterials: KbobMaterial[],
    outputFormat: OutputFormats,
    materialDensities: Record<string, number> = {},
    lifetime?: number,
    displayMode: DisplayMode = "total",
    ebf: number | null = null
  ): string {
    const { divisor, suffix, error } = LCADisplayHelper.getDivisorAndSuffix(
      displayMode,
      ebf,
      lifetime || DEFAULT_AMORTIZATION_YEARS
    );

    // Handle error state for relative mode with invalid EBF
    if (error) {
      return error;
    }

    // Calculate total impact value
    const totalValue = LCAImpactCalculator.calculateTotalImpact(
      materials,
      matches,
      kbobMaterials,
      materialDensities,
      outputFormat
    );

    // Apply divisor based on display mode
    const value = totalValue / divisor;

    // <<< ADDED: Call the new formatter method >>>
    return LCAFormatter.formatGrandTotal(
      value,
      outputFormat,
      displayMode,
      suffix
    );
  }

  /**
   * Calculates and formats a grand total value using element-specific amortization years
   */
  calculateGrandTotalWithElements(
    elements: LcaElement[],
    matches: Record<string, string>,
    kbobMaterials: KbobMaterial[],
    outputFormat: OutputFormats,
    materialDensities: Record<string, number> = {},
    displayMode: DisplayMode = "total",
    ebf: number | null = null
  ): string {
    // Handle error state for relative mode with invalid EBF
    if (displayMode === "relative" && (!ebf || ebf <= 0)) {
      return "N/A (EBF fehlt)";
    }

    const kbobMaterialMap = new Map(kbobMaterials.map((k) => [k.id, k]));
    let totalValue = 0;

    // Calculate total with element-specific amortization
    for (const element of elements) {
      // Use element-specific amortization if available
      const amortYears = getAmortizationYears(
        element.properties?.ebkp_code ?? "",
        DEFAULT_AMORTIZATION_YEARS
      );

      for (const material of element.materials || []) {
        const matchedKbobId = matches[material.id];
        if (matchedKbobId) {
          const kbobMaterial = kbobMaterialMap.get(matchedKbobId);
          if (kbobMaterial) {
            const impact = LCAImpactCalculator.calculateMaterialImpact(
              material,
              kbobMaterial,
              materialDensities
            );

            let impactValue = 0;
            switch (outputFormat) {
              case OutputFormats.GWP:
                impactValue = impact.gwp;
                break;
              case OutputFormats.UBP:
                impactValue = impact.ubp;
                break;
              case OutputFormats.PENR:
                impactValue = impact.penr;
                break;
            }

            // Apply element-specific divisor for relative mode
            if (displayMode === "relative" && ebf) {
              impactValue = impactValue / (amortYears * ebf);
            }

            totalValue += impactValue;
          }
        }
      }
    }

    const suffix = displayMode === "relative" ? "/m²·Jahr" : "";
    return LCAFormatter.formatGrandTotal(
      totalValue,
      outputFormat,
      displayMode,
      suffix
    );
  }

  /**
   * Format impact results value with appropriate unit
   */
  formatImpactValue(
    impactResults: ImpactResults,
    outputFormat: OutputFormats,
    showMillions: boolean = true
  ): string {
    return LCAFormatter.formatImpactValue(
      impactResults,
      outputFormat,
      showMillions
    );
  }
}

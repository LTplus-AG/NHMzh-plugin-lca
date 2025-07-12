import {
  Material,
  UnmodelledMaterial,
  KbobMaterial,
  MaterialImpact,
  OutputFormats,
} from "../types/lca.types";

export class LCAImpactCalculator {
  /**
   * Calculates the environmental impact for a given material
   */
  static calculateMaterialImpact(
    material: Material | UnmodelledMaterial | null,
    kbobMaterial: KbobMaterial | undefined,
    materialDensities?: Record<string, number>
  ): MaterialImpact {
    // Initial check for valid inputs
    if (!material || !kbobMaterial) {
      return { gwp: 0, ubp: 0, penr: 0 };
    }

    // --- Safely determine and validate density ---
    let density = materialDensities?.[material.id];
    // If custom density is invalid or missing, try KBOB density
    if (typeof density !== "number" || density <= 0) {
      // Check if KBOB material has a density range
      if (kbobMaterial.densityRange && 
          kbobMaterial.densityRange.min && 
          kbobMaterial.densityRange.max) {
        // Use middle value of density range as default
        density = (kbobMaterial.densityRange.min + kbobMaterial.densityRange.max) / 2;
      } else {
        // Use fixed density if available
        density = kbobMaterial.density;
      }
    }
    // Final validation of density
    if (typeof density !== "number" || density <= 0) {
      return { gwp: 0, ubp: 0, penr: 0 };
    }

    // --- Safely determine and validate volume ---
    const volume = typeof material.volume === "number" ? material.volume : 0;
    if (volume <= 0) {
      // No volume means no impact
      return { gwp: 0, ubp: 0, penr: 0 };
    }

    // --- Safely calculate and validate mass ---
    const mass = volume * density;
    if (isNaN(mass) || mass < 0) {
      return { gwp: 0, ubp: 0, penr: 0 };
    }
    // No need to check if mass is zero, as impacts would be zero anyway

    // --- Safely get impact factors from KBOB data, defaulting to 0 ---
    const gwpFactor =
      typeof kbobMaterial.gwp === "number" ? kbobMaterial.gwp : 0;
    const ubpFactor =
      typeof kbobMaterial.ubp === "number" ? kbobMaterial.ubp : 0;
    const penrFactor =
      typeof kbobMaterial.penr === "number" ? kbobMaterial.penr : 0;

    // --- Return calculated impacts ---
    return {
      gwp: mass * gwpFactor,
      ubp: mass * ubpFactor,
      penr: mass * penrFactor,
    };
  }

  /**
   * Calculates the total impact for all materials
   */
  static calculateTotalImpact(
    materials: Material[],
    matches: Record<string, string>,
    kbobMaterials: KbobMaterial[],
    materialDensities: Record<string, number> = {},
    outputFormat: OutputFormats = OutputFormats.GWP
  ): number {
    // Create a Map for faster lookups
    const kbobMaterialMap = new Map(kbobMaterials.map((k) => [k.id, k]));
    let totalValue = 0;

    // Calculate for modelled materials
    materials.forEach((material) => {
      const matchedKbobId = matches[material.id];
      if (matchedKbobId) {
        const kbobMaterial = kbobMaterialMap.get(matchedKbobId);
        if (kbobMaterial && typeof material.volume === "number") {
          const volume = material.volume;
          
          // Determine density
          let density = materialDensities[material.id];
          if (typeof density !== "number" || density <= 0) {
            // Check for density range
            if (kbobMaterial.densityRange && 
                kbobMaterial.densityRange.min && 
                kbobMaterial.densityRange.max) {
              density = (kbobMaterial.densityRange.min + kbobMaterial.densityRange.max) / 2;
            } else {
              density = kbobMaterial.density || 0;
            }
          }
          
          const mass = volume * density;

          if (mass > 0) {
            switch (outputFormat) {
              case OutputFormats.GWP:
                totalValue += mass * (kbobMaterial.gwp || 0);
                break;
              case OutputFormats.UBP:
                totalValue += mass * (kbobMaterial.ubp || 0);
                break;
              case OutputFormats.PENR:
                totalValue += mass * (kbobMaterial.penr || 0);
                break;
            }
          }
        }
      }
    });

    return totalValue;
  }
}

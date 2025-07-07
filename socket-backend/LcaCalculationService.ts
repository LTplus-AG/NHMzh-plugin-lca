import {
  LcaImpact,
  MaterialInstanceResult,
  LcaCalculationResult,
  QtoElement,
  KbobMaterial,
} from "./types"; // Import types
import { getAmortizationYears } from "./amortizationUtils";

// --- Amortization Configuration ---
// Using fixed lifetime for now
const CURRENT_LIFETIME_YEARS = 45;
const DEFAULT_AMORTIZATION_YEARS_FALLBACK = 50; // Fallback if needed later

// Helper to normalize material names
function normalizeMaterialName(name: string): string {
  return name.replace(/\s*\(\d+\)\s*$/, "");
}

export class LcaCalculationService {
  /**
   * Calculates absolute and relative impacts for all mapped materials in a project.
   *
   * @param qtoElements - Array of elements from the QTO database.
   * @param materialMappings - Record mapping original material names/ids to KBOB IDs.
   * @param kbobMaterials - Array of KBOB material data.
   * @param ebf - Energiebezugsfläche (Energy Reference Area) for relative calculations.
   * @returns An object containing the list of processed material instances and total impacts.
   */
  static calculateLcaResults(
    qtoElements: QtoElement[],
    materialMappings: Record<string, string>,
    kbobMaterials: KbobMaterial[],
    ebf: number | null
  ): LcaCalculationResult {
    const results: MaterialInstanceResult[] = [];
    let totalGwp = 0;
    let totalUbp = 0;
    let totalPenr = 0;
    let errors = 0;

    const kbobMap = new Map(kbobMaterials.map((k) => [k.id, k]));
    const effectiveEbf = ebf !== null && ebf > 0 ? ebf : null;

    for (const qtoElement of qtoElements) {
      const materialsInElement = qtoElement.materials || [];
      const elementEbkcCode = qtoElement.properties?.ebkp_code || null;
      const elementGlobalId =
        qtoElement.global_id ||
        qtoElement.ifc_id ||
        qtoElement._id?.toString() || // Handle ObjectId
        `unknown_element_${Math.random().toString(16).slice(2)}`; // Fallback

      let sequence = 0;

      if (Array.isArray(materialsInElement) && materialsInElement.length > 0) {
        for (const material of materialsInElement) {
          if (!material || typeof material.name !== "string") {
            console.warn(
              `[LCA Calc Elem: ${elementGlobalId}] Skipping invalid material entry: ${JSON.stringify(
                material
              )}`
            );
            errors++;
            continue;
          }

          const normalizedQtoMatName = normalizeMaterialName(material.name);
          let mappedKbobId: string | null = null;

          // Find KBOB mapping (adapt based on how materialMappings keys are structured)
          // This assumes keys in materialMappings might match normalized names
          // Adjust if keys are element-specific IDs from the frontend.
          mappedKbobId =
            materialMappings[material.name] ||
            materialMappings[normalizedQtoMatName] ||
            null;
          // If mappings use element-specific IDs, a different lookup approach is needed here.

          const kbobMat = mappedKbobId ? kbobMap.get(mappedKbobId) : null;
          const volume = parseFloat(material.volume?.toString() || "0");
          const density = kbobMat?.density || 0;

          let gwpAbs = 0,
            ubpAbs = 0,
            penrAbs = 0;
          let gwpRel = 0,
            ubpRel = 0,
            penrRel = 0;
          let amortizationYears = CURRENT_LIFETIME_YEARS; // Use fixed for now

          if (
            kbobMat &&
            !isNaN(volume) &&
            volume > 0 &&
            !isNaN(density) &&
            density > 0
          ) {
            const mass = volume * density;
            gwpAbs = mass * (kbobMat.gwp || 0);
            ubpAbs = mass * (kbobMat.ubp || 0);
            penrAbs = mass * (kbobMat.penr || 0);

            // --- Amortization Period Determination ---
            amortizationYears = elementEbkcCode
              ? getAmortizationYears(elementEbkcCode, DEFAULT_AMORTIZATION_YEARS_FALLBACK)
              : DEFAULT_AMORTIZATION_YEARS_FALLBACK;

            // --- Relative Calculation ---
            const divisor =
              effectiveEbf !== null && effectiveEbf > 0 && amortizationYears > 0
                ? amortizationYears * effectiveEbf
                : null;

            if (divisor !== null) {
              gwpRel = gwpAbs / divisor;
              ubpRel = ubpAbs / divisor;
              penrRel = penrAbs / divisor;
            } else {
              // Relative values remain 0 if divisor is invalid
              if (effectiveEbf === null)
                console.warn(
                  `[LCA Calc Elem: ${elementGlobalId}, Mat: ${material.name}] Cannot calculate relative values: Invalid EBF (${ebf}).`
                );
              // Add warning for amortizationYears if using dynamic lookup later
            }

            // Accumulate totals
            totalGwp += gwpAbs;
            totalUbp += ubpAbs;
            totalPenr += penrAbs;
          } else {
            // Handle unmapped materials or materials with invalid data (volume/density)
            // Impacts remain 0
            if (!kbobMat && mappedKbobId)
              console.warn(
                `[LCA Calc Elem: ${elementGlobalId}, Mat: ${material.name}] KBOB data not found for mapped ID: ${mappedKbobId}`
              );
            else if (!mappedKbobId) {
              /* console.log(`[LCA Calc Elem: ${elementGlobalId}, Mat: ${material.name}] No KBOB mapping found.`) */
            } // Less verbose logging
            else
              console.warn(
                `[LCA Calc Elem: ${elementGlobalId}, Mat: ${material.name}] Skipping calculation: Invalid volume (${volume}) or density (${density}).`
              );
            errors++; // Count as error if calculation couldn't be performed
          }

          results.push({
            id: elementGlobalId,
            sequence: sequence++,
            material_name: material.name,
            kbob_id: mappedKbobId,
            kbob_name:
              kbobMat?.nameDE ||
              (mappedKbobId ? "KBOB Data Missing" : "Not Mapped"),
            ebkp_code: elementEbkcCode,
            amortization_years: amortizationYears,
            gwp_absolute: gwpAbs,
            ubp_absolute: ubpAbs,
            penr_absolute: penrAbs,
            gwp_relative: gwpRel,
            ubp_relative: ubpRel,
            penr_relative: penrRel,
          });
        } // end material loop
      }
    } // end element loop

    console.log(
      `[LCA Calc] Processed ${results.length} material instances. Errors/Skipped: ${errors}`
    );

    return {
      materialInstances: results,
      totalImpact: {
        gwp: totalGwp,
        ubp: totalUbp,
        penr: totalPenr,
      },
      numberOfInstancesProcessed: results.length,
      numberOfInstancesWithErrors: errors,
    };
  }
}

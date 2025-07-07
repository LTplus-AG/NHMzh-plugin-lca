import { useMemo } from 'react';
import { LcaElement, LcaEbkpGroup, HierarchicalLcaEbkpGroup, MaterialImpact } from '../types/lca.types';

// Main EBKP group names mapping
const EBKP_MAIN_GROUP_NAMES: Record<string, string> = {
  A: "Grundstück",
  B: "Vorbereitung", 
  C: "Konstruktion",
  D: "Technik",
  E: "Äussere Wandbekleidung",
  F: "Bedachung",
  G: "Ausbau",
  H: "Nutzungsspezifische Anlage",
  I: "Umgebung",
  J: "Ausstattung",
};

// Helper to normalize EBKP codes to ensure leading zeros
const normalizeEbkpCode = (code: string): string => {
  // Match pattern like C2.3 or C02.03
  const match = code.match(/^([A-J])(\d{1,2})\.(\d{1,2})$/);
  if (match) {
    const [, letter, group, element] = match;
    // Pad with leading zeros to ensure 2 digits
    const paddedGroup = group.padStart(2, '0');
    const paddedElement = element.padStart(2, '0');
    return `${letter}${paddedGroup}.${paddedElement}`;
  }
  return code; // Return original if it doesn't match the pattern
};

// Helper to extract main group letter from EBKP code
const getMainGroupFromEbkpCode = (code: string): string | null => {
  // First normalize the code, then extract the main group
  const normalizedCode = normalizeEbkpCode(code);
  // Check if it's an EBKP code pattern (e.g., C01.03, E02.01)
  const match = normalizedCode.match(/^([A-J])\d{2}\.\d{2}$/);
  return match ? match[1] : null;
};

export const useLcaEbkpGroups = (
  elements: LcaElement[]
) => {
  const { ebkpGroups, hierarchicalGroups } = useMemo(() => {
    // Group elements by EBKP code
    const groupMap = new Map<string, LcaElement[]>();
    
    elements.forEach((element) => {
      const code = element.properties?.ebkp_code || "Unknown";
      const normalizedCode = normalizeEbkpCode(code);
      
      if (!groupMap.has(normalizedCode)) {
        groupMap.set(normalizedCode, []);
      }
      groupMap.get(normalizedCode)!.push(element);
    });

    // Convert to LcaEbkpGroup format
    const ebkpGroups: LcaEbkpGroup[] = Array.from(groupMap.entries()).map(([code, groupElements]) => {
      // Calculate totals for this group
      const totalQuantity = groupElements.reduce((sum, el) => sum + (el.quantity || 0), 0);
      const totalImpact: MaterialImpact = groupElements.reduce(
        (sum, el) => ({
          gwp: sum.gwp + (el.impact?.gwp || 0),
          ubp: sum.ubp + (el.impact?.ubp || 0),
          penr: sum.penr + (el.impact?.penr || 0),
        }),
        { gwp: 0, ubp: 0, penr: 0 }
      );

      return {
        code,
        name: code, // You might want to add name mapping here
        elements: groupElements,
        totalQuantity,
        totalImpact,
        elementCount: groupElements.length,
      };
    });

    // Create hierarchical groups
    const hierarchicalMap = new Map<string, HierarchicalLcaEbkpGroup>();
    
    ebkpGroups.forEach((group) => {
      // Check if this is an EBKP code
      const mainGroup = getMainGroupFromEbkpCode(group.code);
      
      if (mainGroup) {
        // It's an EBKP code - add to hierarchical structure
        if (!hierarchicalMap.has(mainGroup)) {
          hierarchicalMap.set(mainGroup, {
            mainGroup,
            mainGroupName: EBKP_MAIN_GROUP_NAMES[mainGroup] || mainGroup,
            subGroups: [],
            totalElements: 0,
            totalQuantity: 0,
            totalImpact: { gwp: 0, ubp: 0, penr: 0 },
          });
        }
        
        const hierarchicalGroup = hierarchicalMap.get(mainGroup)!;
        hierarchicalGroup.subGroups.push(group);
        hierarchicalGroup.totalElements += group.elementCount;
        hierarchicalGroup.totalQuantity += group.totalQuantity;
        hierarchicalGroup.totalImpact.gwp += group.totalImpact.gwp;
        hierarchicalGroup.totalImpact.ubp += group.totalImpact.ubp;
        hierarchicalGroup.totalImpact.penr += group.totalImpact.penr;
      } else {
        // Not an EBKP code - add to "Other" group
        if (!hierarchicalMap.has("_OTHER_")) {
          hierarchicalMap.set("_OTHER_", {
            mainGroup: "_OTHER_",
            mainGroupName: "Sonstige Klassifikationen",
            subGroups: [],
            totalElements: 0,
            totalQuantity: 0,
            totalImpact: { gwp: 0, ubp: 0, penr: 0 },
          });
        }
        
        const otherGroup = hierarchicalMap.get("_OTHER_")!;
        otherGroup.subGroups.push(group);
        otherGroup.totalElements += group.elementCount;
        otherGroup.totalQuantity += group.totalQuantity;
        otherGroup.totalImpact.gwp += group.totalImpact.gwp;
        otherGroup.totalImpact.ubp += group.totalImpact.ubp;
        otherGroup.totalImpact.penr += group.totalImpact.penr;
      }
    });

    // Sort hierarchical groups: EBKP groups A-J first, then Others
    const sortedHierarchicalGroups = Array.from(hierarchicalMap.values()).sort((a, b) => {
      if (a.mainGroup === "_OTHER_") return 1;
      if (b.mainGroup === "_OTHER_") return -1;
      return a.mainGroup.localeCompare(b.mainGroup);
    });

    // Sort subGroups within each hierarchical group by normalized code
    sortedHierarchicalGroups.forEach((hierarchicalGroup) => {
      hierarchicalGroup.subGroups.sort((a, b) => {
        const normalizedA = normalizeEbkpCode(a.code);
        const normalizedB = normalizeEbkpCode(b.code);
        return normalizedA.localeCompare(normalizedB);
      });
    });

    return { ebkpGroups, hierarchicalGroups: sortedHierarchicalGroups };
  }, [elements]);

  return { ebkpGroups, hierarchicalGroups };
}; 
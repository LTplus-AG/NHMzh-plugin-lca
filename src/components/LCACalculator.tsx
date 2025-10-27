import {
  Box,
  Button,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
  useTheme
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CSSObjectWithLabel } from "react-select";
import { kbobService } from "../services/kbobService";
import {
  ModelledMaterials as DefaultModelledMaterials,
  KbobMaterial,
  LcaElement,
  Material,
  MaterialImpact,
  OutputFormats,
  ProjectData,
} from "../types/lca.types.ts";
import { getFuzzyMatches } from "../utils/fuzzySearch";
import { LCACalculator } from "../utils/lcaCalculator";
import { DisplayMode } from "../utils/lcaDisplayHelper";
import BulkMatchDialog from "./LCACalculator/BulkMatchDialog";
import DisplayModeToggle from "./LCACalculator/DisplayModeToggle";
import ElementImpactTable from "./LCACalculator/ElementImpactTable";
import ModelledMaterialList from "./LCACalculator/ModelledMaterialList";
import ReviewDialog from "./LCACalculator/ReviewDialog";
import Sidebar from "./LCACalculator/Sidebar";
import SuccessDialog from "./LCACalculator/SuccessDialog";
import ProjectMetadataDisplay from "./ui/ProjectMetadataDisplay";
import EmptyState from "./ui/EmptyState";

// Import new lcaApi service
import {
  getProjectMaterials,
  getProjects,
  saveProjectMaterials,
} from "../services/lcaApi";

import {
  IFCResult,
  MaterialOption,
  MaterialOptionGroup,
  ProjectOption
} from "../types/calculator.types";
import { ProjectMetadata } from "../types/lca.types";
import { getAmortizationYears } from "../utils/amortizationUtils";
import { DEFAULT_AMORTIZATION_YEARS } from "../utils/constants";
import { LCAImpactCalculator } from "../utils/lcaImpactCalculator";
import { Upload as UploadIcon, Assessment as AssessmentIcon } from "@mui/icons-material";
import { navigateToIfcUploader, navigateToQto, getCurrentPlugin } from "../utils/navigation";
import logger from '../utils/logger';

const calculator = new LCACalculator();

// Raw data interfaces for API response transformation
interface RawMaterial {
  id?: string;
  name?: string;
  volume?: number | string;
  unit?: string;
  kbob_id?: string;
}

/**
 * IFC ELEMENT IDENTIFICATION SYSTEM - GLOBAL_ID (GUID) USAGE
 *
 * CRITICAL: Throughout the entire system (QTO → LCA → Cost), we use 'global_id'
 * as the ONLY identifier for IFC elements. This ensures consistent element
 * identification across all components.
 *
 * GUID FLOW:
 * 1. QTO System: Parses IFC files, extracts GlobalId → stores as 'global_id' in database
 * 2. LCA System: Receives 'global_id' from QTO API → uses as element identifier
 * 3. Cost System: Receives 'global_id' via Kafka → uses for cost calculations/matching
 * 4. Kafka Messages: Always send 'global_id' as element identifier (never 'id', 'guid', etc.)
 *
 * WHY global_id ONLY:
 * - It's the original IFC GlobalId from the IFC file (standardized identifier)
 * - Consistent across all systems and transformations
 * - Prevents element identification mismatches
 * - Enables proper element tracking from IFC file → final cost calculations
 *
 * NEVER USE: 'id', 'guid', '_id', or any other field for element identification
 */
interface RawElement {
  global_id?: string;  // PRIMARY: Original IFC GUID from database (ONLY identifier used)
  guid?: string;  // Alternative field name (fallback - should not be used)
  id?: string;  // Additional fallback (should not be used)
  name?: string;
  ifc_class?: string;
  element_type?: string;
  type_name?: string;
  quantity?: number | { value: number; type: string; unit: string };  // Can be simple number or QTO edited object
  ebkp?: string;
  materials?: RawMaterial[];
  properties?: Record<string, unknown>;
  classification?: {
    system?: string;
    id?: string;
    name?: string;
  };
  amortization_years?: number;
  updated_at?: string;
  created_at?: string;
  impact?: any;  // Some elements may already have impact data
}

export default function LCACalculatorComponent(): JSX.Element {
  const theme = useTheme();
  const [modelledMaterials, setModelledMaterials] = useState<Material[]>(
    DefaultModelledMaterials
  );
  const [kbobMaterials, setKbobMaterials] = useState<KbobMaterial[]>([]);
  const [kbobLoading, setKbobLoading] = useState(true);
  const [kbobError, setKbobError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState(0);
  const [materialDensities, setMaterialDensities] = useState<
    Record<string, number>
  >({});
  const [outputFormat, setOutputFormat] = useState<OutputFormats>(
    OutputFormats.GWP
  );
  const [ifcResult, setIfcResult] = useState<IFCResult>({
    projectId: "",
    ifcData: {
      materials: [],
      elements: [], // Keep this structure for initial load
      totalImpact: { gwp: 0, ubp: 0, penr: 0 },
    },
    materialMappings: {},
  });
  const [bulkMatchDialogOpen, setBulkMatchDialogOpen] = useState(false);
  const [suggestedMatches, setSuggestedMatches] = useState<
    Record<string, KbobMaterial[]>
  >({});
  // Add state for IFC elements with calculated impacts
  const [ifcElementsWithImpacts, setIfcElementsWithImpacts] = useState<
    LcaElement[]
  >([]);
  const [aggregatedMaterialImpacts, setAggregatedMaterialImpacts] = useState<
    Record<string, MaterialImpact>
  >({});
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(
    null
  );
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [initialLoading, setInitialLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("total");
  const [ebfInput, setEbfInput] = useState<string>("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [projectMetadata, setProjectMetadata] =
    useState<ProjectMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState<boolean>(false);

  // Add debounce timer ref
  const densitySaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized numeric EBF value
  const ebfNumeric = useMemo(() => {
    const val = parseFloat(ebfInput);
    return !isNaN(val) && val > 0 ? val : null;
  }, [ebfInput]);

  // Update currentImpact calculation to use display mode
  const currentImpact: { currentImpact: string; unit: string } = useMemo(() => {
    if (kbobMaterials.length === 0 || ifcElementsWithImpacts.length === 0) return { currentImpact: "0", unit: "" };

    const formattedValue = calculator.calculateGrandTotalWithElements(
      ifcElementsWithImpacts,
      matches,
      kbobMaterials,
      outputFormat,
      materialDensities,
      displayMode,
      ebfNumeric
    );

    return {
      currentImpact: formattedValue,
      unit: "",
    };
  }, [
    ifcElementsWithImpacts,
    matches,
    kbobMaterials,
    materialDensities,
    outputFormat,
    displayMode,
    ebfNumeric,
  ]);

  // Helper function to ensure elements conform to LcaElement type
  const ensureElementsConform = (elements: unknown[]): LcaElement[] => {
    if (!Array.isArray(elements)) return [];
    return elements.map((element: unknown, index: number): LcaElement => {
      const rawElement = element as RawElement;
      
      // Extract user-edited quantity (from QTO) if available
      let userEditedQuantity: number | null = null;
      if (rawElement.quantity) {
        if (typeof rawElement.quantity === 'object' && Number.isFinite(rawElement.quantity.value) && rawElement.quantity.value > 0) {
          // User edited quantity from QTO
          userEditedQuantity = rawElement.quantity.value;
        } else if (typeof rawElement.quantity === 'number' && Number.isFinite(rawElement.quantity) && rawElement.quantity > 0) {
          // Legacy numeric quantity
          userEditedQuantity = rawElement.quantity;
        }
      }
      
      // Get original material volumes
      const originalMaterials = (rawElement.materials || []).map((mat: RawMaterial, matIndex: number) => {
        const parsedVolume = parseFloat(String(mat.volume ?? 0));
        return {
          id: mat.id || mat.name || `mat-${index}-${matIndex}`,
          name: mat.name || "Unknown Material",
          volume: Number.isFinite(parsedVolume) ? parsedVolume : 0,
          unit: mat.unit || "m³",
          kbobMaterialId: mat.kbob_id,
        };
      });
      
      // Calculate original total volume
      const originalTotalVolume = originalMaterials.reduce(
        (sum: number, mat: { volume: number }) => sum + mat.volume,
        0
      );
      
      // Scale material volumes if user edited quantity in QTO
      const materials = originalMaterials.map(mat => {
        if (userEditedQuantity !== null && Number.isFinite(originalTotalVolume) && originalTotalVolume > 0) {
          // Scale material volume proportionally to match user-edited quantity
          const scaleFactor = userEditedQuantity / originalTotalVolume;
          return {
            ...mat,
            volume: mat.volume * scaleFactor
          };
        }
        return mat;
      });

      const properties = rawElement.properties || {};

      if (
        rawElement.classification &&
        (rawElement.classification.system === "EBKP" ||
          rawElement.classification.system === "EBKP-H")
      ) {
        properties.ebkp_code = rawElement.classification.id;
        properties.ebkp_name = rawElement.classification.name;
      } else if (rawElement.ebkp) {
        // Fallback: use direct ebkp field if available
        properties.ebkp_code = rawElement.ebkp;
        properties.ebkp_name = rawElement.ebkp; // Use same value for name as fallback
      }

      // Initialize impact as undefined, it will be calculated later

      /**
       * CRITICAL: Element GUID Extraction
       * We MUST use global_id as the ONLY identifier for IFC elements.
       * This ensures consistency across QTO → LCA → Cost systems.
       *
       * Primary: global_id (original IFC GlobalId from database)
       * Fallbacks: Only used if global_id is missing (should not happen in normal operation)
       */
      let guid = rawElement.global_id ||  // PRIMARY: Original IFC GUID (ONLY field to use)
                 rawElement.guid ||  // Fallback: Alternative naming (avoid if possible)
                 rawElement.id;  // Last fallback: Generic id (avoid if possible)

      if (!guid) {
        // Try to extract from properties or other fields
        if (rawElement.properties && typeof rawElement.properties === 'object') {
          const props = rawElement.properties as Record<string, unknown>;
          guid = (props.globalId as string) || (props.guid as string) || (props.GlobalId as string) || (props.GUID as string);
        }
      }

      if (!guid) {
        // Last resort: use database _id if available, otherwise generate meaningful ID
        if ((rawElement as any)._id) {
          guid = String((rawElement as any)._id);
        } else {
          // Generate a meaningful fallback based on element characteristics
          const namePart = (rawElement.name || rawElement.type_name || 'unknown').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
          const typePart = (rawElement.element_type || rawElement.ifc_class || 'unknown').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4);
          guid = `AUTO-${typePart}-${namePart}-${index}`;
          console.warn(`[ensureElementsConform] Generated fallback GUID for element ${index}: ${guid}`);
        }
      }

      return {
        guid,
        name: rawElement.name || rawElement.type_name || "Unknown Element",
        ifc_class: rawElement.element_type || rawElement.ifc_class || "Unknown",
        element_type: rawElement.element_type || rawElement.ifc_class || "Unknown Element",
        type_name: rawElement.type_name,
        quantity: materials.reduce(
          (sum: number, mat: { volume: number }) => sum + mat.volume,
          0
        ),
        properties: properties,
        materials: materials,
        impact: undefined,
      };
    });
  };

  // --- Function to calculate impacts for a list of elements ---
  const calculateElementImpacts = (
    elements: LcaElement[],
    currentMatches: Record<string, string>,
    currentKbobMaterials: KbobMaterial[],
    currentMaterialDensities: Record<string, number>
  ): LcaElement[] => {
    const kbobMap = new Map(currentKbobMaterials.map((k) => [k.id, k]));

    return elements.map((element) => {
      let elementImpact: MaterialImpact = { gwp: 0, ubp: 0, penr: 0 };
          const amortYears = getAmortizationYears(
      element.properties?.ebkp_code ?? "",
      DEFAULT_AMORTIZATION_YEARS
    );

    element.materials.forEach((material: Material) => {
        const kbobId = currentMatches[material.id];
        const kbobMaterial = kbobId ? kbobMap.get(kbobId) : undefined;

        if (kbobMaterial) {
          // Use the static method from LCAImpactCalculator
          const materialInstanceImpact =
            LCAImpactCalculator.calculateMaterialImpact(
              material, // Pass the single material instance
              kbobMaterial,
              currentMaterialDensities
            );
          elementImpact.gwp += materialInstanceImpact.gwp;
          elementImpact.ubp += materialInstanceImpact.ubp;
          elementImpact.penr += materialInstanceImpact.penr;
        }
      });

      // Return the element with the calculated impact
      return {
        ...element,
        impact: {
          gwp: parseFloat(elementImpact.gwp.toFixed(2)), // Optional: round final impact
          ubp: parseFloat(elementImpact.ubp.toFixed(2)),
          penr: parseFloat(elementImpact.penr.toFixed(2)),
        },
        amortization_years: amortYears,
      };
    });
  };

  // Load project materials when a project is selected
  useEffect(() => {
    // Reset dependent states *immediately* when project changes
    setModelledMaterials([]);
    setMatches({});
    setIfcElementsWithImpacts([]);
    setEbfInput("");
    setProjectMetadata(null);
    setIfcResult({
      projectId: "",
      ifcData: {
        materials: [],
        elements: [],
        totalImpact: { gwp: 0, ubp: 0, penr: 0 },
      },
      materialMappings: {},
    });
    setInitialLoading(true);
    setMetadataLoading(true);

    const loadProjectMaterials = async () => {
      if (!selectedProject) {
        logger.info("[loadProjectMaterials] No project selected");
        setInitialLoading(false);
        setMetadataLoading(false);
        return;
      }

      logger.info("[loadProjectMaterials] Loading materials for project:", selectedProject.label);

      try {
        const projectData: ProjectData = await getProjectMaterials(
          selectedProject.value
        );

        logger.info("[loadProjectMaterials] Received project data:", projectData);

        if (projectData && projectData.ifcData) {
          const rawElements = projectData.ifcData.elements || [];
          logger.info("[loadProjectMaterials] Raw elements count:", rawElements.length);


          const conformingElementsInput = ensureElementsConform(rawElements);
          logger.info("[loadProjectMaterials] Conforming elements count:", conformingElementsInput.length);

          setProjectMetadata({
            filename: projectData.metadata?.filename || "Unbekannte Datei",
            upload_timestamp: projectData.metadata?.upload_timestamp || "",
            element_count: conformingElementsInput.length,
          });

          setIfcResult({
            projectId: selectedProject.value,
            ifcData: {
              ...projectData.ifcData,
              elements: conformingElementsInput,
            },
            materialMappings: projectData.materialMappings || {},
          });

          let materialsArray: Material[] = [];
          const materialMap = new Map<string, { volume: number; id: string }>();
          conformingElementsInput.forEach((element) => {
            element.materials.forEach((material: Material) => {
              if (material.id && material.volume > 0) {
                const existing = materialMap.get(material.id);
                materialMap.set(material.id, {
                  volume: (existing?.volume || 0) + material.volume,
                  id: material.id,
                });
              }
            });
          });
          materialsArray = Array.from(materialMap.values()).map((data) => ({
            id: data.id,
            name: data.id,
            volume: data.volume,
            unit: "m³",
          }));

          logger.info("[loadProjectMaterials] Processed materials count:", materialsArray.length);

          setModelledMaterials(materialsArray);

          // Restore saved material densities
          if (projectData.materialDensities) {
            logger.info("[loadProjectMaterials] Restoring saved material densities");
            setMaterialDensities(projectData.materialDensities);
          } else {
            setMaterialDensities({});
          }

          if (kbobMaterials.length > 0) {
            const elementsWithCalculatedImpacts = calculateElementImpacts(
              conformingElementsInput,
              projectData.materialMappings || {},
              kbobMaterials,
              projectData.materialDensities || materialDensities
            );
            setIfcElementsWithImpacts(elementsWithCalculatedImpacts);
          } else {
            logger.info("[loadProjectMaterials] KBOB materials not loaded yet");
            setIfcElementsWithImpacts(conformingElementsInput);
          }

          if (projectData.materialMappings) {
            logger.info("[loadProjectMaterials] Restoring saved material mappings");
            setMatches(projectData.materialMappings);
          } else {
            setMatches({});
          }

          if (projectData.ebf !== undefined && projectData.ebf !== null) {
            setEbfInput(projectData.ebf.toString());
          } else {
            setEbfInput("");
          }
        } else {
          logger.warn(`[loadProjectMaterials] No project data found for ${selectedProject.value}`);
          setModelledMaterials([]);
          setMatches({});
          setMaterialDensities({});
          setEbfInput("");
          setProjectMetadata(null);
          setIfcResult({
            projectId: selectedProject.value,
            ifcData: {
              materials: [],
              elements: [],
              totalImpact: { gwp: 0, ubp: 0, penr: 0 },
            },
            materialMappings: {},
          });
        }
      } catch (error) {
        logger.error(
          `[loadProjectMaterials] Error loading project data for ${selectedProject.value}:`,
          error
        );
        setModelledMaterials([]);
        setMatches({});
        setMaterialDensities({});
        setEbfInput("");
        setIfcElementsWithImpacts([]);
        setProjectMetadata(null);
        setIfcResult({
          projectId: selectedProject.value,
          ifcData: {
            materials: [],
            elements: [],
            totalImpact: { gwp: 0, ubp: 0, penr: 0 },
          },
          materialMappings: {},
        });
      } finally {
        setInitialLoading(false);
        setMetadataLoading(false);
      }
    };

    if (selectedProject) {
      loadProjectMaterials();
    } else {
      setInitialLoading(false);
      setIfcElementsWithImpacts([]);
    }
  }, [selectedProject, kbobMaterials]);

  // Load KBOB materials
  useEffect(() => {
    const loadKBOBMaterials = async () => {
      try {
        setKbobLoading(true);
        setKbobError(null);
        const materials = await kbobService.getAllMaterials();
        setKbobMaterials(materials);
      } catch (error) {
        setKbobError(
          error instanceof Error
            ? error.message
            : "Failed to load KBOB materials"
        );
      } finally {
        setKbobLoading(false);
      }
    };
    loadKBOBMaterials();
  }, []);

  useEffect(() => {
    if (ifcResult && ifcResult.materialMappings) {
      setMatches(ifcResult.materialMappings);
    }
  }, [ifcResult]);

  const kbobMaterialOptions = useMemo(():
    | MaterialOption[]
    | ((materialId: string) => MaterialOption[] | MaterialOptionGroup[]) => {
    if (kbobLoading) {
      return [
        { value: "", label: "Loading KBOB materials...", isDisabled: true },
      ];
    }

    if (kbobError) {
      return [
        { value: "", label: "Error loading KBOB materials", isDisabled: true },
      ];
    }

    if (kbobMaterials.length === 0) {
      return [
        { value: "", label: "No KBOB materials available", isDisabled: true },
      ];
    }

    // Filter out materials with 0 density unless they have a density range
    const validMaterials = kbobMaterials.filter(
      (kbob) => kbob.densityRange || (!kbob.densityRange && kbob.density > 0)
    );

    const baseOptions = validMaterials.map((kbob) => ({
      value: kbob.id,
      label: `${kbob.nameDE} ${
        kbob.densityRange
          ? `(${kbob.densityRange.min}-${kbob.densityRange.max} kg/m³)`
          : `(${kbob.density} kg/m³)`
      }`,
    }));

    if (activeTab === 0) {
      return (materialId: string): MaterialOption[] | MaterialOptionGroup[] => {
        const material = modelledMaterials.find((m) => m.id === materialId);
        if (!material) return baseOptions;

        const validMaterials = kbobMaterials.filter(
          (kbob) =>
            kbob.densityRange || (!kbob.densityRange && kbob.density > 0)
        );
        const suggestions = getFuzzyMatches(material.name, validMaterials, 1);

        if (suggestions.length === 0) return baseOptions;

        const suggestionOptions = suggestions.map((kbob) => ({
          value: kbob.id,
          label: `✨ ${kbob.nameDE} ${
            kbob.densityRange
              ? `(${kbob.densityRange.min}-${kbob.densityRange.max} kg/m³)`
              : `(${kbob.density} kg/m³)`
          }`,
          className: "suggestion-option",
        }));

        return [
          {
            label: "Vorschläge basierend auf Name",
            options: suggestionOptions,
          },
          {
            label: "Alle Materialien",
            options: baseOptions,
          },
        ];
      };
    }

    return baseOptions;
  }, [kbobMaterials, kbobLoading, kbobError, activeTab, modelledMaterials]);

  const selectStyles = useMemo(
    () => ({
      control: (provided: CSSObjectWithLabel) => ({
        ...provided,
        borderRadius: theme.shape.borderRadius,
        borderColor: theme.palette.divider,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        boxShadow: "none",
        minWidth: "120px",
        minHeight: "40px",
        "&:hover": {
          borderColor: theme.palette.primary.main,
        },
      }),
      option: (provided: CSSObjectWithLabel, state: any) => ({
        ...provided,
        backgroundColor: theme.palette.background.paper,
        color: state.isDisabled
          ? theme.palette.text.disabled
          : theme.palette.text.primary,
        cursor: state.isDisabled ? "not-allowed" : "default",
        fontWeight: (state.data as MaterialOption)?.className === "suggestion-option" ? 500 : 400,
        fontSize: "0.875rem",
        padding: "8px",
        outline: state.isSelected
          ? `1px solid ${theme.palette.primary.main}`
          : "none",
        outlineOffset: "-1px",
        "&:hover": {
          backgroundColor: theme.palette.action.hover,
        },
      }),
      menu: (provided: CSSObjectWithLabel) => ({
        ...provided,
        backgroundColor: theme.palette.background.paper,
        borderColor: theme.palette.divider,
        borderRadius: theme.shape.borderRadius,
        boxShadow: theme.shadows[1],
        zIndex: 1500,
      }),
      singleValue: (provided: CSSObjectWithLabel) => ({
        ...provided,
        color: theme.palette.text.primary,
      }),
      input: (provided: CSSObjectWithLabel) => ({
        ...provided,
        color: theme.palette.text.primary,
      }),
      placeholder: (provided: CSSObjectWithLabel) => ({
        ...provided,
        color: theme.palette.text.secondary,
      }),
      group: (provided: CSSObjectWithLabel) => ({
        ...provided,
        padding: 0,
        "& .css-1rhbuit-multiValue": {
          backgroundColor: theme.palette.primary.light,
        },
      }),
      groupHeading: (provided: CSSObjectWithLabel) => ({
        ...provided,
        fontSize: "0.75rem",
        color: theme.palette.text.secondary,
        fontWeight: 600,
        backgroundColor: theme.palette.grey[50],
        padding: "8px 12px",
        marginBottom: 4,
      }),
    }),
    [theme]
  );

  const findBestMatchesForAll = useCallback(() => {
    if (kbobLoading) {
      alert(
        "Die KBOB-Materialien werden noch geladen. Bitte warten Sie einen Moment."
      );
      return;
    }

    if (kbobMaterials.length === 0) {
      logger.error("No KBOB materials loaded for matching!");
      alert(
        "Keine KBOB-Materialien geladen. Bitte warten Sie, bis die Materialien geladen sind."
      );
      return;
    }

    // Get all materials that need matching
    const materialsToMatch = modelledMaterials;

    if (materialsToMatch.length === 0) {
      alert(
        "Es sind keine Materialien vorhanden. Bitte wählen Sie zuerst ein Projekt aus."
      );
      return;
    }

    const suggestions: Record<string, KbobMaterial[]> = {};

    // Filter valid materials (non-zero density or has density range)
    const validMaterials = kbobMaterials.filter(
      (kbob) => kbob.densityRange || (!kbob.densityRange && kbob.density > 0)
    );

    // Find matches for each material
    materialsToMatch.forEach((material) => {
      const materialMatches = getFuzzyMatches(material.name, validMaterials, 1);
      suggestions[material.id] = materialMatches;
    });

    setSuggestedMatches(suggestions);
    setBulkMatchDialogOpen(true);
  }, [modelledMaterials, matches, kbobMaterials, kbobLoading]);

  // Add function to apply selected matches
  const applyBulkMatches = useCallback(() => {
    const newMatches = { ...matches };
    let matchCount = 0;

    Object.entries(suggestedMatches).forEach(([materialId, suggestions]) => {
      if (suggestions.length > 0) {
        newMatches[materialId] = suggestions[0].id;
        matchCount++;
      }
    });
    setMatches(newMatches);
    setBulkMatchDialogOpen(false);

    // Show a success message
    if (matchCount > 0) {
      alert(`${matchCount} Materialien wurden erfolgreich zugeordnet.`);
    }
  }, [matches, suggestedMatches]);

  // Update the bulk matching dialog content
  const bulkMatchingDialog = (
    <BulkMatchDialog
      open={bulkMatchDialogOpen}
      onClose={() => setBulkMatchDialogOpen(false)}
      onApply={applyBulkMatches}
      suggestedMatches={suggestedMatches}
      modelledMaterials={modelledMaterials}
      onRejectMatch={(materialId) => {
        setSuggestedMatches((prev) => ({
          ...prev,
          [materialId]: [],
        }));
      }}
    />
  );

  // Add success message dialog
  const successDialog = (
    <SuccessDialog
      open={showSuccessMessage}
      onClose={() => setShowSuccessMessage(false)}
    />
  );


  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleAbschliessen = async () => {
    if (!selectedProject?.value) return;

    try {
      await handleSave({}); // Call the refactored handleSave
      setShowSuccessMessage(true);
    } catch (error) {
      logger.error("Error saving and submitting LCA data:", error);
    }
  };

  const handleSave = async (_data: unknown): Promise<void> => {
    if (!selectedProject?.value || !ifcResult?.ifcData?.elements) {
      throw new Error("Project, elements, or metadata not available");
    }

    const finalElementsWithImpact = calculateElementImpacts(
      ifcResult.ifcData.elements,
      matches,
      kbobMaterials,
      materialDensities
    );

    const lcaDataForKafka = {
      project: selectedProject.label,
      filename: projectMetadata?.filename || "Unknown",
      timestamp: projectMetadata?.upload_timestamp || new Date().toISOString(),
      fileId: selectedProject.value,
      data: finalElementsWithImpact.flatMap((el) =>
        (el.materials || []).map((mat: Material, matIndex: number) => {
          const kbobId = matches[mat.id];
          const kbobMat = kbobMaterials.find((k) => k.id === kbobId);
          const impact = kbobMat
            ? LCAImpactCalculator.calculateMaterialImpact(
                mat,
                kbobMat,
                materialDensities
              )
            : { gwp: 0, penr: 0, ubp: 0 };
          const amortization = getAmortizationYears(
            el.properties?.ebkp_code || ""
          );
          const divisor =
            ebfNumeric && amortization > 0 ? ebfNumeric * amortization : null;

          return {
            id: el.guid, // Use element GUID
            sequence: matIndex, // Add sequence number for each material
            mat_kbob: kbobMat?.nameDE || "UNKNOWN", // Ensure mat_kbob is always present
            kbob_name: kbobMat?.nameDE || "UNKNOWN", // Add kbob_name field
            gwp_absolute: impact.gwp,
            penr_absolute: impact.penr,
            ubp_absolute: impact.ubp,
            gwp_relative: divisor ? impact.gwp / divisor : 0,
            penr_relative: divisor ? impact.penr / divisor : 0,
            ubp_relative: divisor ? impact.ubp / divisor : 0,
          };
        })
      ),
    };

    const formattedData = {
      materialMappings: matches,
      ebfValue: parseFloat(ebfInput) || 0,  // Convert to number here
      materialDensities: materialDensities,
      lcaData: lcaDataForKafka,  // Pass the full object, not just the data array
    };

    await saveProjectMaterials(selectedProject.value, formattedData);
  };

  const handleDensityUpdate = (materialId: string, density: number) => {
    setMaterialDensities((prev) => {
      const updated = {
        ...prev,
        [materialId]: density,
      };

      // Auto-save density changes with debouncing
      if (selectedProject?.value) {
        // Clear previous timer
        if (densitySaveTimerRef.current) {
          clearTimeout(densitySaveTimerRef.current);
        }

        // Set new timer for auto-save
        densitySaveTimerRef.current = setTimeout(async () => {
          try {
            // await saveMaterialDensities(selectedProject.value, updated); // Removed as per edit hint

          } catch (error) {
            logger.error("[Auto-save] Failed to save density:", error);
            // Optionally show a user notification here
          }
        }, 1000); // 1 second debounce
      }

      return updated;
    });
  };

  const handleRemoveMaterial = (materialId: string) => {
    setModelledMaterials((prev) =>
      prev.filter((material) => material.id !== materialId)
    );
    setMatches((prev) => {
      const newMatches = { ...prev };
      delete newMatches[materialId];
      return newMatches;
    });
  };

  // Add logging to verify KBOB materials are loaded
  useEffect(() => {
    logger.info("KBOB materials loaded:", kbobMaterials.length);
  }, [kbobMaterials]);

  // Calculate aggregated impacts for the ModelledMaterialList
  const calculateAndSetAggregatedImpacts = useCallback(() => {
    if (
      modelledMaterials.length === 0 ||
      kbobMaterials.length === 0 ||
      Object.keys(matches).length === 0
    ) {
      setAggregatedMaterialImpacts({});
      return;
    }

    const kbobMap = new Map(kbobMaterials.map((k) => [k.id, k]));
    const impacts: Record<string, MaterialImpact> = {};

    modelledMaterials.forEach((material) => {
      const matchedKbobId = matches[material.id];
      if (matchedKbobId) {
        const kbobMaterial = kbobMap.get(matchedKbobId);
        if (kbobMaterial) {
          const impact = LCAImpactCalculator.calculateMaterialImpact(
            material,
            kbobMaterial,
            materialDensities
          );
          impacts[material.id] = impact;
        }
      }
    });

    setAggregatedMaterialImpacts(impacts);
  }, [modelledMaterials, matches, kbobMaterials, materialDensities]);

  // Effect to run the aggregation calculation when dependencies change
  useEffect(() => {
    calculateAndSetAggregatedImpacts();
  }, [calculateAndSetAggregatedImpacts]);

  // Recalculate ELEMENT impacts when dependencies change
  useEffect(() => {
    const elementsToProcess = ifcResult.ifcData.elements; // Get potentially updated elements
    if (
      elementsToProcess &&
      elementsToProcess.length > 0 &&
      kbobMaterials.length > 0
    ) {

      // Ensure elements still conform (might be redundant if ifcResult always holds conformed)
      const conformingElementsInput = ensureElementsConform(elementsToProcess);

      // Use the new helper function to calculate impacts
      const elementsWithCalculatedImpacts = calculateElementImpacts(
        conformingElementsInput,
        matches,
        kbobMaterials,
        materialDensities
      );
      setIfcElementsWithImpacts(elementsWithCalculatedImpacts);
      // DO NOT call calculator.aggregateImpactsByMaterial here - handled by separate effect
    } else if (elementsToProcess && elementsToProcess.length > 0) {
      // Set elements without impacts if KBOB not ready (or other dependencies invalid)
      setIfcElementsWithImpacts(ensureElementsConform(elementsToProcess));
    } else {
      setIfcElementsWithImpacts([]); // Clear if no elements
    }
  }, [
    matches,
    kbobMaterials,
    materialDensities,
    ifcResult.ifcData.elements, // Trigger when base elements change
  ]);

  const autoBulkMatch = useCallback(() => {
    if (modelledMaterials.length === 0) {
      alert(
        "Es sind keine Materialien vorhanden. Bitte wählen Sie zuerst ein Projekt aus."
      );
      return;
    }

    const unmatched: Material[] = [];
    modelledMaterials.forEach((material) => {
      const matchId = matches[material.id];
      const hasValidMatch =
        matchId &&
        matchId.trim() !== "" &&
        kbobMaterials.some((m) => m.id === matchId);

      if (!hasValidMatch) {
        unmatched.push(material);
      }
    });

    if (unmatched.length === 0) {
      alert("Alle Materialien sind bereits korrekt zugeordnet.");
      return;
    }

    const validMaterials = kbobMaterials.filter(
      (kbob) => kbob.densityRange || (!kbob.densityRange && kbob.density > 0)
    );

    const newMatches = { ...matches };
    let matchCount = 0;

    unmatched.forEach((material) => {
      const bestMatches = getFuzzyMatches(material.name, validMaterials, 1);
      if (bestMatches.length > 0) {
        newMatches[material.id] = bestMatches[0].id;
        matchCount++;
      }
    });
    setMatches(newMatches);
    if (matchCount > 0) {
      alert(`${matchCount} Materialien wurden automatisch zugeordnet.`);
    } else {
      alert("Es konnten keine passenden Materialien gefunden werden.");
    }
  }, [modelledMaterials, matches, kbobMaterials]);

  const fetchProjects = async () => {
    try {
      setProjectsLoading(true);

      setInitialLoading(true);
      const projectData = await getProjects();

      const options = projectData.map((project) => ({
        value: project.id,
        label: project.name,
      }));

      setProjectOptions(options);

      if (!selectedProject && options.length > 0) {
        setSelectedProject(options[0]);
      } else {
        setInitialLoading(false);
      }
    } catch (error) {
      logger.error("Error fetching projects:", error);
      setProjectOptions([]);

      setInitialLoading(false);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSubmitReview = () => {
    handleAbschliessen();
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (densitySaveTimerRef.current) {
        clearTimeout(densitySaveTimerRef.current);
      }
    };
  }, []);

  return (
    <Box
      className="w-full flex flex-col md:flex-row"
      sx={{
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Sidebar - Appears above on small screens, to the left on medium and larger screens */}
      <Sidebar
        selectedProject={selectedProject}
        projectOptions={projectOptions}
        projectsLoading={projectsLoading}
        ebfInput={ebfInput}
        outputFormat={outputFormat}
        modelledMaterials={modelledMaterials}
        matches={matches}
        kbobMaterials={kbobMaterials}
        currentImpact={currentImpact.currentImpact}
        onProjectChange={setSelectedProject}
        onEbfChange={setEbfInput}
        onOutputFormatChange={setOutputFormat}
        onBulkMatch={findBestMatchesForAll}
        selectStyles={selectStyles}
      />

      {/* Main Content - Match plugin-cost styling */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          height: { xs: "calc(100vh - 40vh - 64px)", md: "100%" },
          minHeight: { xs: "300px", md: "auto" },
        }}
      >
        <Box sx={{ flexGrow: 1, p: { xs: 2, md: 5 } }}>
          {selectedProject ? (
            <>
              {/* Header with title and review button in top right */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <ProjectMetadataDisplay
                  metadata={projectMetadata}
                  loading={metadataLoading}
                  initialLoading={initialLoading}
                  selectedProject={!!selectedProject}
                />

                {/* Add per year toggle in top right */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <DisplayModeToggle
                    mode={displayMode}
                    onChange={setDisplayMode}
                    isEbfValid={ebfNumeric !== null}
                  />

                  {/* "Ökobilanz überprüfen" button */}
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => setReviewDialogOpen(true)}
                    disabled={modelledMaterials.length === 0}
                    sx={{
                      fontWeight: 500,
                      textTransform: "none",
                      backgroundColor: "#0D0599",
                      "&:hover": {
                        backgroundColor: "#0A0477",
                      },
                    }}
                  >
                    Ökobilanz überprüfen
                  </Button>
                </Box>
              </Box>

              {/* Existing tabs and content */}
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                sx={{
                  borderBottom: 1,
                  borderColor: "divider",
                  mb: 2,
                  "& .MuiTabs-indicator": {
                    backgroundColor: "#0D0599",
                  },
                  "& .Mui-selected": {
                    color: "#0D0599",
                  },
                }}
              >
                <Tab
                  label="Material"
                  sx={{
                    textTransform: "none",
                    fontWeight: 500,
                  }}
                />
                <Tab
                  label="Bauteile"
                  sx={{
                    textTransform: "none",
                    fontWeight: 500,
                  }}
                />
              </Tabs>

              {activeTab === 0 ? (
                <div className="modelled-materials-section">
                  {/* Header with action buttons */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        fontSize: "1.125rem",
                      }}
                    >
                      Modellierte Materialien
                    </Typography>
                    <Box>
                      <Button
                        onClick={() => {
                          autoBulkMatch();
                        }}
                        variant="outlined"
                        color="secondary"
                        sx={{
                          mr: 1,
                          textTransform: "none",
                          fontWeight: 400,
                          borderColor: "rgba(0, 0, 0, 0.23)",
                          color: "text.secondary",
                          "&:hover": {
                            borderColor: "rgba(0, 0, 0, 0.5)",
                            backgroundColor: "rgba(0, 0, 0, 0.04)",
                          },
                        }}
                      >
                        Bulk-Zuordnung
                      </Button>
                    </Box>
                  </Box>

                  {kbobLoading ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", p: 3 }}
                    >
                      <CircularProgress size={40} />
                    </Box>
                  ) : modelledMaterials.length === 0 ? (
                    <Typography>Keine Materialien verfügbar.</Typography>
                  ) : (
                    <ModelledMaterialList
                      modelledMaterials={modelledMaterials}
                      kbobMaterials={kbobMaterials}
                      matches={matches}
                      setMatches={setMatches}
                      kbobMaterialOptions={kbobMaterialOptions}
                      selectStyles={selectStyles}
                      onDeleteMaterial={handleRemoveMaterial}
                      materialDensities={materialDensities}
                      handleDensityUpdate={handleDensityUpdate}
                      outputFormat={outputFormat}
                      aggregatedMaterialImpacts={aggregatedMaterialImpacts}
                    />
                  )}
                </div>
              ) : (
                <ElementImpactTable
                  elements={ifcElementsWithImpacts}
                  outputFormat={outputFormat}
                  displayMode={displayMode}
                  ebfNumeric={ebfNumeric}
                  matches={matches}
                />
              )}
            </>
          ) : initialLoading ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                gap: 3,
              }}
            >
              <CircularProgress size={40} />
              <Typography variant="body1" color="text.secondary">
                Projekt wird geladen...
              </Typography>
            </Box>
          ) : projectOptions.length === 0 && !projectsLoading ? (
            <EmptyState
              icon="assessment"
              title="Keine Projekte mit LCA-Daten verfügbar"
              description="Für die Ökobilanzierung sind IFC-Dateien und bestätigte Mengen aus dem Mengen-Modul erforderlich. Laden Sie zunächst eine IFC-Datei über den IFC Uploader hoch und bestätigen Sie die Mengen, oder wenden Sie sich an die zuständige Person."
              actions={[
                {
                  label: "IFC Uploader öffnen",
                  onClick: () => navigateToIfcUploader(getCurrentPlugin()),
                  variant: "contained",
                  startIcon: <UploadIcon />
                },
                {
                  label: "QTO öffnen",
                  onClick: () => navigateToQto(getCurrentPlugin()),
                  variant: "outlined",
                  startIcon: <AssessmentIcon />
                }
              ]}
            />
          ) : !selectedProject ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
              }}
            >
              <Typography
                variant="h6"
                color="text.secondary"
                align="center"
                sx={{ fontWeight: 500 }}
              >
                Bitte wählen Sie ein Projekt aus, um die Ökobilanz zu berechnen.
              </Typography>
            </Box>
          ) : ifcElementsWithImpacts.length === 0 && !initialLoading ? (
            <EmptyState
              icon="assessment"
              title="Noch keine bestätigten Mengen"
              description="Für dieses Projekt sind noch keine bestätigten Mengen aus dem Mengen-Modul verfügbar. Bestätigen Sie zunächst die Mengen, damit die Ökobilanzberechnung durchgeführt werden kann."
              actions={[
                {
                  label: "QTO öffnen",
                  onClick: () => navigateToQto(getCurrentPlugin()),
                  variant: "contained",
                  startIcon: <AssessmentIcon />
                }
              ]}
            />
          ) : null}
        </Box>
      </Box>
      <ReviewDialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        onSubmit={handleSubmitReview}
        modelledMaterials={modelledMaterials}
        matches={matches}
        currentImpact={currentImpact}
        projectId={selectedProject?.value}
        displayMode={displayMode}
        ebfNumeric={ebfNumeric}
        ifcElementsWithImpacts={ifcElementsWithImpacts}
        onSave={handleSave}
        calculator={calculator}
        materialDensities={materialDensities}
        outputFormat={outputFormat}
        kbobMaterials={kbobMaterials}
        aggregatedMaterialImpacts={aggregatedMaterialImpacts}
      />
      {bulkMatchingDialog}
      {successDialog}
    </Box>
  );
}

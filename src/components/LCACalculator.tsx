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
  ProjectMetadata,
  ProjectOption
} from "../types/calculator.types";
import { getAmortizationYears } from "../utils/amortizationUtils";
import { DEFAULT_AMORTIZATION_YEARS } from "../utils/constants";
import { LCAImpactCalculator } from "../utils/lcaImpactCalculator";
import logger from '../utils/logger';

const calculator = new LCACalculator();

const DEFAULT_PROJECT_OPTIONS: ProjectOption[] = [
  { value: "67e391836c096bf72bc23d97", label: "Recyclingzentrum Juch-Areal" },
  {
    value: "67e392836c096bf72bc23d98",
    label: "Gesamterneuerung Stadthausanlage",
  },
  { value: "67e393836c096bf72bc23d99", label: "Amtshaus Walche" },
  {
    value: "67e394836c096bf72bc23d9a",
    label: "Gemeinschaftszentrum Wipkingen",
  },
];

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
  const ensureElementsConform = (elements: any[]): LcaElement[] => {
    if (!Array.isArray(elements)) return [];
    return elements.map((element: any, index: number): LcaElement => {
      const materials = (element.materials || []).map((mat: any) => ({
        id: mat.id || mat.name || `mat-${index}-${Math.random()}`,
        name: mat.name || "Unknown Material",
        volume: parseFloat(String(mat.volume ?? 0)),
        unit: mat.unit || "m³",
        kbob_id: mat.kbob_id,
      }));

      const properties = element.properties || {};
      if (
        element.classification &&
        (element.classification.system === "EBKP" ||
          element.classification.system === "EBKP-H")
      ) {
        properties.ebkp_code = element.classification.id;
        properties.ebkp_name = element.classification.name;
      }

      // Initialize impact as undefined, it will be calculated later
      return {
        id: element.global_id || element.id || `elem-${index}`,
        guid: element.global_id || element.guid || element.id || `elem-${index}`,
        name: element.name || element.type_name || "Unknown Element",
        ifc_class: element.element_type || element.ifc_class || "Unknown",
        element_type: element.element_type || element.ifc_class || "Unknown Element",
        type_name: element.type_name,
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

      element.materials.forEach((material) => {
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
          logger.debug("[loadProjectMaterials] First 3 raw elements:", rawElements.slice(0, 3));

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
            element.materials.forEach((material) => {
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

          logger.info("[loadProjectMaterials] Materials array:", materialsArray);
          logger.info("[loadProjectMaterials] Materials count:", materialsArray.length);

          setModelledMaterials(materialsArray);

          // Restore saved material densities
          if (projectData.materialDensities) {
            logger.info("[loadProjectMaterials] Restoring material densities:", projectData.materialDensities);
            setMaterialDensities(projectData.materialDensities);
          } else {
            logger.info("[loadProjectMaterials] No saved material densities found");
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
            logger.info("[loadProjectMaterials] Material mappings:", projectData.materialMappings);
            setMatches(projectData.materialMappings);
          } else {
            logger.info("[loadProjectMaterials] No material mappings found");
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
      control: (provided: any) => ({
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
      option: (provided: any, state: any) => ({
        ...provided,
        backgroundColor: theme.palette.background.paper,
        color: state.isDisabled
          ? theme.palette.text.disabled
          : theme.palette.text.primary,
        cursor: state.isDisabled ? "not-allowed" : "default",
        fontWeight: state.data.className === "suggestion-option" ? 500 : 400,
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
      menu: (provided: any) => ({
        ...provided,
        backgroundColor: theme.palette.background.paper,
        borderColor: theme.palette.divider,
        borderRadius: theme.shape.borderRadius,
        boxShadow: theme.shadows[1],
        zIndex: 1500,
      }),
      singleValue: (provided: any) => ({
        ...provided,
        color: theme.palette.text.primary,
      }),
      input: (provided: any) => ({
        ...provided,
        color: theme.palette.text.primary,
      }),
      placeholder: (provided: any) => ({
        ...provided,
        color: theme.palette.text.secondary,
      }),
      group: (provided: any) => ({
        ...provided,
        padding: 0,
        "& .css-1rhbuit-multiValue": {
          backgroundColor: theme.palette.primary.light,
        },
      }),
      groupHeading: (provided: any) => ({
        ...provided,
        fontSize: "0.75rem",
        color: theme.palette.text.secondary,
        fontWeight: 600,
        textTransform: "none",
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

  const handleSave = async (_data: any): Promise<void> => {
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
        (el.materials || []).map((mat, matIndex) => {
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
            id: el.id, // Use element ID directly
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
            logger.info(`[Auto-save] Density saved for material ${materialId}: ${density}`);
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
    if (kbobMaterials.length > 0) {
      logger.debug("Sample KBOB material:", kbobMaterials[0]);
    }
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
      logger.info("[fetchProjects] Starting to fetch projects...");
      setProjectsLoading(true);
      setInitialLoading(true);
      const projectData = await getProjects();
      logger.info("[fetchProjects] Received projects:", projectData);
      
      const options = projectData.map((project) => ({
        value: project.id,
        label: project.name,
      }));

      const finalOptions =
        options.length === 0 ? DEFAULT_PROJECT_OPTIONS : options;
      
      logger.info("[fetchProjects] Final project options:", finalOptions);
      setProjectOptions(finalOptions);

      if (!selectedProject && finalOptions.length > 0) {
        logger.info("[fetchProjects] Auto-selecting first project:", finalOptions[0].label);
        setSelectedProject(finalOptions[0]);
      } else {
        logger.info("[fetchProjects] Selected project already exists or no options available");
        setInitialLoading(false);
      }
    } catch (error) {
      logger.error("[fetchProjects] Error fetching projects:", error);
      setProjectOptions(DEFAULT_PROJECT_OPTIONS);

      if (!selectedProject && DEFAULT_PROJECT_OPTIONS.length > 0) {
        logger.info(
          "[fetchProjects] Auto-selecting first default project:",
          DEFAULT_PROJECT_OPTIONS[0].label
        );
        setSelectedProject(DEFAULT_PROJECT_OPTIONS[0]);
      } else {
        setInitialLoading(false);
      }
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    logger.info("[useEffect] Initial projects fetch on mount");
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
          ) : (
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
          )}
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

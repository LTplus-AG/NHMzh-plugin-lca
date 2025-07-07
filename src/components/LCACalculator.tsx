import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormLabel,
  MenuItem,
  Select as MuiSelect,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { fetchKBOBMaterials } from "../services/kbobService";
import {
  ModelledMaterials as DefaultModelledMaterials,
  KbobMaterial,
  Material,
  OutputFormatLabels,
  OutputFormats,
  MaterialImpact,
  LcaElement,
} from "../types/lca.types.ts";
import { getFuzzyMatches } from "../utils/fuzzySearch";
import { LCACalculator } from "../utils/lcaCalculator";
import { DisplayMode } from "../utils/lcaDisplayHelper";
import DisplayModeToggle from "./LCACalculator/DisplayModeToggle";
import ModelledMaterialList from "./LCACalculator/ModelledMaterialList";
import ReviewDialog from "./LCACalculator/ReviewDialog";
import ElementImpactTable from "./LCACalculator/ElementImpactTable";
import ProjectMetadataDisplay from "./ui/ProjectMetadataDisplay";

// Import WebSocket service
import {
  ConnectionStatus,
  getProjectMaterials,
  getProjects,
  initWebSocket,
  onStatusChange,
  saveProjectMaterials,
  ProjectData,
} from "../services/websocketService";

import { LCAImpactCalculator } from "../utils/lcaImpactCalculator";
import { getAmortizationYears } from "../utils/amortizationUtils";
import { DEFAULT_AMORTIZATION_YEARS } from "../utils/constants";

const calculator = new LCACalculator();

interface MaterialOption {
  value: string;
  label: string;
  isDisabled?: boolean;
}

interface MaterialOptionGroup {
  label: string;
  options: MaterialOption[];
}

interface IFCMaterial {
  name: string;
  volume: number;
}

interface IFCResult {
  projectId: string;
  ifcData: {
    materials?: IFCMaterial[];
    elements?: LcaElement[];
    totalImpact?: {
      gwp: number;
      ubp: number;
      penr: number;
    };
  };
  materialMappings: Record<string, string>;
}

interface ProjectOption {
  value: string;
  label: string;
}

interface ProjectMetadata {
  filename: string;
  upload_timestamp: string;
  element_count?: number;
}

const Instructions = [
  {
    label: "Daten hochladen",
    description:
      "Laden Sie Ihre IFC-Datei hoch oder bearbeiten Sie Materialien manuell.",
  },
  {
    label: "Materialien zuordnen",
    description:
      "Ordnen Sie die erkannten Materialien den entsprechenden KBOB-Materialien zu.",
  },
  {
    label: "Ökobilanz überprüfen",
    description:
      "Überprüfen Sie die berechnete Ökobilanz und senden Sie die Daten.",
  },
];

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

  // Memoized numeric EBF value
  const ebfNumeric = useMemo(() => {
    const val = parseFloat(ebfInput);
    return !isNaN(val) && val > 0 ? val : null;
  }, [ebfInput]);

  // Update currentImpact calculation to use display mode
  const currentImpact: { currentImpact: string; unit: string } = useMemo(() => {
    if (kbobMaterials.length === 0) return { currentImpact: "0", unit: "" };

    const formattedValue = calculator.calculateGrandTotal(
      modelledMaterials,
      matches,
      kbobMaterials,
      outputFormat,
      materialDensities,
      undefined,
      displayMode,
      ebfNumeric
    );

    return {
      currentImpact: formattedValue,
      unit: "",
    };
  }, [
    modelledMaterials,
    matches,
    kbobMaterials,
    materialDensities,
    outputFormat,
    displayMode,
    ebfNumeric,
  ]);

  // Initialize WebSocket connection
  useEffect(() => {
    initWebSocket();

    const handleStatusChange = (status: ConnectionStatus) => {
      console.log("WebSocket status changed:", status);
    };

    onStatusChange(handleStatusChange);

    return () => {};
  }, []);

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
        id:
          element.global_id ||
          `elem-${index}`,
        element_type:
          element.element_type || element.ifc_class || "Unknown Element",
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
        element.properties.ebkp_code ?? "",
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
        setInitialLoading(false);
        setMetadataLoading(false);
        return;
      }

      try {
        const projectData: ProjectData = await getProjectMaterials(
          selectedProject.value
        );

        if (projectData && projectData.ifcData) {
          const rawElements = projectData.ifcData.elements || [];
          const conformingElementsInput = ensureElementsConform(rawElements);

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

          setModelledMaterials(materialsArray);

          if (kbobMaterials.length > 0) {
            const elementsWithCalculatedImpacts = calculateElementImpacts(
              conformingElementsInput,
              projectData.materialMappings || {},
              kbobMaterials,
              materialDensities
            );
            setIfcElementsWithImpacts(elementsWithCalculatedImpacts);
          } else {
            setIfcElementsWithImpacts(conformingElementsInput);
          }

          if (projectData.materialMappings) {
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
          console.warn(`No project data found for ${selectedProject.value}`);
          setModelledMaterials([]);
          setMatches({});
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
        console.error(
          `Error loading project data for ${selectedProject.value}:`,
          error
        );
        setModelledMaterials([]);
        setMatches({});
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
        const materials = await fetchKBOBMaterials();
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

  const outputFormatOptions = useMemo(
    () =>
      Object.entries(OutputFormatLabels).map(([value, label]) => ({
        value,
        label,
      })),
    []
  );

  const findBestMatchesForAll = useCallback(() => {
    if (kbobLoading) {
      alert(
        "Die KBOB-Materialien werden noch geladen. Bitte warten Sie einen Moment."
      );
      return;
    }

    if (kbobMaterials.length === 0) {
      console.error("No KBOB materials loaded for matching!");
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
    <Dialog
      open={bulkMatchDialogOpen}
      onClose={() => setBulkMatchDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexDirection: { xs: "column", sm: "row" },
            gap: { xs: 1, sm: 0 },
          }}
        >
          <Typography variant="h6">
            Vorgeschlagene Zuordnungen überprüfen
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Object.keys(suggestedMatches).length} Materialien
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {Object.entries(suggestedMatches).length === 0 ? (
            <Typography variant="body1" align="center" sx={{ py: 4 }}>
              Keine Materialien zum Zuordnen gefunden.
            </Typography>
          ) : (
            Object.entries(suggestedMatches).map(
              ([materialId, suggestions]) => {
                const material = modelledMaterials.find(
                  (m) => m.id === materialId
                );
                const suggestion =
                  suggestions.length > 0 ? suggestions[0] : null;

                return (
                  <Paper
                    key={materialId}
                    sx={{
                      p: 2,
                      mb: 2,
                      bgcolor: "background.default",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {material?.name || materialId}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          Volumen: {material?.volume.toLocaleString()} m³
                        </Typography>
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 2 }}
                      >
                        {suggestion ? (
                          <>
                            <Box sx={{ textAlign: "right" }}>
                              <Typography variant="subtitle2" color="primary">
                                {suggestion.nameDE}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {suggestion.densityRange
                                  ? `${suggestion.densityRange.min}-${suggestion.densityRange.max} kg/m³`
                                  : `${suggestion.density} kg/m³`}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              color="inherit"
                              onClick={() => {
                                setSuggestedMatches((prev) => ({
                                  ...prev,
                                  [materialId]: [],
                                }));
                              }}
                            >
                              Ablehnen
                            </Button>
                          </>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Keine Übereinstimmung
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                );
              }
            )
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={() => {
            setBulkMatchDialogOpen(false);
          }}
          variant="outlined"
          color="inherit"
        >
          Abbrechen
        </Button>
        <Button
          onClick={() => {
            applyBulkMatches();
          }}
          variant="contained"
          color="primary"
          disabled={Object.entries(suggestedMatches).every(
            ([_, suggestions]) => suggestions.length === 0
          )}
        >
          Zuordnungen übernehmen
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Add success message dialog
  const successDialog = (
    <Dialog
      open={showSuccessMessage}
      onClose={() => setShowSuccessMessage(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: "success.light",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "success.dark",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </Box>
          <Typography variant="h6">Erfolgreich gesendet</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" paragraph>
          Die Ökobilanz wurde erfolgreich im Nachhaltigkeitsmonitoring
          registriert.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Das Dashboard wird in Kürze aktualisiert. Sie können diese Ansicht
          jetzt schliessen.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={() => {
            setShowSuccessMessage(false);
          }}
          variant="contained"
          color="primary"
        >
          Schliessen
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Add progress bar component
  const progressBar = (
    <Box
      sx={{
        width: `${
          (modelledMaterials.filter((material) => {
            const matchId = matches[material.id];
            return (
              matchId &&
              matchId.trim() !== "" &&
              kbobMaterials.some((m) => m.id === matchId)
            );
          }).length /
            modelledMaterials.length) *
          100
        }%`,
        bgcolor: theme.palette.primary.main,
        borderRadius: "9999px",
        height: "100%",
        transition: "width 0.3s ease",
      }}
    />
  );

  // Update the calculation button text - remove duplicate button
  const calculationButton = (
    <Box sx={{ mt: 3 }}>
      {modelledMaterials.filter((material) => {
        const matchId = matches[material.id];
        return (
          matchId &&
          matchId.trim() !== "" &&
          kbobMaterials.some((m) => m.id === matchId)
        );
      }).length === 0 ? (
        <>
          <Box sx={{ mb: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Keine Materialien zugeordnet
            </Typography>
          </Box>
        </>
      ) : null}
      <Box sx={{ display: "flex", justifyContent: "center", mt: 2, mb: 2 }}>
        <Button
          onClick={() => {
            findBestMatchesForAll();
          }}
          variant="outlined"
          color="secondary"
          startIcon={
            <Box component="span" sx={{ fontSize: "1.1em" }}>
              ✨
            </Box>
          }
          sx={{
            textTransform: "none",
            borderColor: "rgba(0, 0, 0, 0.23)",
            color: "text.secondary",
            fontWeight: 400,
            borderRadius: "20px",
            px: 2,
            py: 0.75,
            "&:hover": {
              borderColor: "rgba(0, 0, 0, 0.5)",
              backgroundColor: "rgba(0, 0, 0, 0.04)",
            },
          }}
        >
          Automatische Zuordnung vorschlagen
        </Button>
      </Box>
    </Box>
  );

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleAbschliessen = async () => {
    if (!selectedProject) {
      return;
    }

    try {
      await saveProjectMaterials(selectedProject.value, {
        ifcData: ifcResult.ifcData,
        materialMappings: matches,
        ebfValue: ebfInput,
      });
      setShowSuccessMessage(true);
    } catch (error) {
      console.error("Error saving project materials:", error);
    }
  };

  const handleDensityUpdate = (materialId: string, density: number) => {
    setMaterialDensities((prev) => ({
      ...prev,
      [materialId]: density,
    }));
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
    console.log("KBOB materials loaded:", kbobMaterials.length);
    if (kbobMaterials.length > 0) {
      console.log("Sample KBOB material:", kbobMaterials[0]);
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
      console.log(
        "[Debug LCA Calc] Recalculating element impacts due to dependency change"
      );
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
      await initWebSocket();
      await new Promise((resolve) => setTimeout(resolve, 300));
      const projectData = await getProjects();
      const options = projectData.map((project) => ({
        value: project.id,
        label: project.name,
      }));

      const finalOptions =
        options.length === 0 ? DEFAULT_PROJECT_OPTIONS : options;
      setProjectOptions(finalOptions);

      if (!selectedProject && finalOptions.length > 0) {
        console.log("Auto-selecting first project:", finalOptions[0].label);
        setSelectedProject(finalOptions[0]);
      } else {
        setInitialLoading(false);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjectOptions(DEFAULT_PROJECT_OPTIONS);

      if (!selectedProject && DEFAULT_PROJECT_OPTIONS.length > 0) {
        console.log(
          "Auto-selecting first default project:",
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
    fetchProjects();
  }, []);

  const handleSubmitReview = () => {
    handleAbschliessen();
  };

  const handleSave = async (_data: any): Promise<void> => {
    if (!selectedProject?.value) {
      throw new Error("No project selected");
    }

    const formattedData = {
      ifcData: ifcResult.ifcData,
      materialMappings: matches,
      ebfValue: ebfInput,
    };

    await saveProjectMaterials(selectedProject.value, formattedData);
  };

  return (
    <Box
      className="w-full flex flex-col md:flex-row"
      sx={{
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Sidebar - Appears above on small screens, to the left on medium and larger screens */}
      <Box
        sx={{
          width: { xs: "100%", md: "25%" },
          minWidth: { md: "350px" },
          maxWidth: { xs: "100%", md: "400px" },
          minHeight: { xs: "250px", md: 0 },
          maxHeight: { xs: "40vh", md: "100%" },
          height: { xs: "auto", md: "100%" },
          overflow: "auto",
          bgcolor: "grey.100",
          color: "primary.main",
          display: "flex",
          flexDirection: "column",
          borderBottom: { xs: 1, md: 0 },
          borderRight: 0,
          borderColor: "grey.200",
        }}
      >
        {/* Match plugin-cost padding */}
        <div className="flex flex-col flex-grow p-8">
          <Typography
            variant="h3"
            color="primary"
            className="text-5xl mb-2"
            sx={{
              fontSize: "2.5rem",
              fontWeight: 300,
              mb: 4,
              mt: 2,
              color: "#0D0599",
            }}
          >
            Ökobilanz
          </Typography>

          <Box sx={{ mb: 2 }}>
            <FormLabel focused htmlFor="select-project">
              Projekt:
            </FormLabel>
            <FormControl variant="outlined" fullWidth focused>
              <MuiSelect
                id="select-project"
                size="small"
                value={selectedProject?.value || ""}
                onChange={(e) => {
                  const selectedValue = e.target.value;
                  const projectOption = projectOptions.find(
                    (op) => op.value === selectedValue
                  );
                  if (projectOption) {
                    setSelectedProject(projectOption);
                  }
                }}
                labelId="select-project"
              >
                {projectsLoading ? (
                  <MenuItem disabled>Loading projects...</MenuItem>
                ) : projectOptions.length === 0 ? (
                  <MenuItem disabled>No projects available</MenuItem>
                ) : (
                  projectOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))
                )}
              </MuiSelect>
            </FormControl>
          </Box>

          {/* Project-dependent content */}
          {selectedProject && (
            <>
              {/* Add EBF Input Field */}
              <Box sx={{ mb: 3 }}>
                <Tooltip title="Energiebezugsfläche des Projekts" arrow>
                  <FormControl variant="outlined" fullWidth focused>
                    <FormLabel
                      focused
                      htmlFor="ebf-input"
                      sx={{ mb: 0.5, fontSize: "0.875rem" }}
                    >
                      EBF (m²)
                    </FormLabel>
                    <TextField
                      id="ebf-input"
                      size="small"
                      type="number"
                      value={ebfInput}
                      onChange={(e) => setEbfInput(e.target.value)}
                      InputProps={{
                        inputProps: { min: 0 },
                        sx: { backgroundColor: "white" },
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderColor: theme.palette.divider,
                          },
                          "&:hover fieldset": {
                            borderColor: theme.palette.primary.main,
                          },
                          "&.Mui-focused fieldset": {
                            borderColor: theme.palette.primary.main,
                          },
                        },
                      }}
                    />
                  </FormControl>
                </Tooltip>
              </Box>

              {/* Total Result - Restore original gradient */}
              <Box
                sx={{
                  mb: 3,
                  mt: 2,
                  p: 2,
                  background: "linear-gradient(to right top, #F1D900, #fff176)",
                  borderRadius: "4px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "80px",
                }}
              >
                <Typography
                  variant="h4"
                  component="p"
                  color="common.black"
                  fontWeight="bold"
                >
                  {calculator.calculateGrandTotal(
                    modelledMaterials.filter((m) => matches[m.id]),
                    matches,
                    kbobMaterials,
                    outputFormat,
                    materialDensities,
                    undefined,
                    displayMode,
                    ebfNumeric
                  )}
                </Typography>
              </Box>

              {/* Output Format */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ mb: 1, fontWeight: 600, fontSize: "0.875rem" }}
                >
                  Öko-Indikator
                </Typography>
                <Select
                  value={outputFormatOptions.find(
                    (opt) => opt.value === outputFormat
                  )}
                  onChange={(newValue) =>
                    setOutputFormat(newValue?.value as OutputFormats)
                  }
                  options={outputFormatOptions}
                  styles={{
                    ...selectStyles,
                    control: (base) => ({
                      ...base,
                      backgroundColor: "white",
                      borderColor: theme.palette.divider,
                      "&:hover": {
                        borderColor: theme.palette.primary.main,
                      },
                    }),
                  }}
                  className="w-full"
                />
              </Box>

              {/* Progress */}
              <Box sx={{ pt: 0, mt: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ mb: 1.5, fontWeight: 600, fontSize: "0.875rem" }}
                >
                  Fortschritt
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Modellierte Materialien: {modelledMaterials.length}
                    </Typography>
                    <Box
                      sx={{
                        width: "100%",
                        bgcolor: "rgba(0,0,0,0.05)",
                        borderRadius: "9999px",
                        height: "8px",
                        mt: 0.5,
                      }}
                    >
                      {progressBar}
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {
                      modelledMaterials.filter((material) => {
                        const matchId = matches[material.id];
                        return (
                          matchId &&
                          matchId.trim() !== "" &&
                          kbobMaterials.some((m) => m.id === matchId)
                        );
                      }).length
                    }{" "}
                    von {modelledMaterials.length} zugeordnet
                  </Typography>
                </Box>
              </Box>

              {/* Calculation Button */}
              {calculationButton}
            </>
          )}

          {/* Process Steps Section - Always show, regardless of project selection */}
          <Box
            sx={{
              mt: "auto",
              pt: 3,
            }}
          >
            <Typography
              variant="subtitle1"
              className="font-bold mb-2"
              color="primary"
              sx={{
                fontWeight: 700,
                mb: 1,
                fontSize: "0.875rem",
                color: "#0D0599",
              }}
            >
              Anleitung
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stepper
              orientation="vertical"
              nonLinear
              className="max-w-xs"
              activeStep={-1}
              sx={{
                "& .MuiStepLabel-label": {
                  color: "#0D0599",
                },
                "& .MuiStepIcon-root": {
                  color: "#0D0599",
                },
              }}
            >
              {Instructions.map((step) => (
                <Step key={step.label} active>
                  <StepLabel>
                    <span
                      className="leading-tight font-bold"
                      style={{ color: "#0D0599" }}
                    >
                      {step.label}
                    </span>
                  </StepLabel>
                  <div className="ml-8 -mt-2">
                    <span
                      className="text-sm leading-none"
                      style={{ color: "#0D0599" }}
                    >
                      {step.description}
                    </span>
                  </div>
                </Step>
              ))}
            </Stepper>
          </Box>
        </div>
      </Box>

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

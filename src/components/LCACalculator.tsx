import {
  Box,
  Button,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  Typography,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import Select, { SingleValue } from "react-select";
import { fetchKBOBMaterials } from "../services/kbobService";
import {
  ModelledMaterials as DefaultModelledMaterials,
  KbobMaterial,
  Material,
  OutputFormatLabels,
  OutputFormats,
  OutputFormatUnits,
  UnmodelledMaterial,
  UnmodelledMaterials,
} from "../types/lca.types.ts";
import { LCACalculator } from "../utils/lcaCalculator";
// Import fuzzy search and sorting utilities
import axios from "axios";
import { sortMaterials } from "../utils/sortMaterials";
import { getFuzzyMatches } from "../utils/fuzzySearch";

// Import the new subcomponents
import EditMaterialDialog from "./LCACalculator/EditMaterialDialog";
import MaterialList from "./LCACalculator/MaterialList";
import ModelledMaterialList from "./LCACalculator/ModelledMaterialList";
import UnmodelledMaterialForm from "./LCACalculator/UnmodelledMaterialForm";

const calculator = new LCACalculator();

interface MaterialOption {
  value: string;
  label: string;
  isDisabled?: boolean;
}

// Add new type for sort options
type SortOption = "volume" | "name";

interface FuseResult {
  item: KbobMaterial;
  refIndex: number;
  score?: number;
}

interface MaterialOptionGroup {
  label: string;
  options: MaterialOption[];
}

// Update the MATERIAL_MAPPINGS to include partial matches
const MATERIAL_MAPPINGS: Record<string, string[]> = {
  Beton: ["Hochbaubeton"],
  Concrete: ["Hochbaubeton"],
  Holz: ["Brettschichtholz", "Holz"], // Changed to match partial "Holz" string
  Wood: ["Brettschichtholz", "Holz"],
};

interface IFCMaterial {
  name: string;
  volume: number;
}

interface IFCResult {
  projectId: string;
  ifcData: {
    materials: IFCMaterial[];
  };
  materialMappings: Record<string, string>;
}

// Update API configuration to use import.meta.env
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function LCACalculatorComponent(): JSX.Element {
  const theme = useTheme();
  const [modelledMaterials, setModelledMaterials] = useState<Material[]>(
    DefaultModelledMaterials
  );
  const [unmodelledMaterials, setUnmodelledMaterials] =
    useState<UnmodelledMaterial[]>(UnmodelledMaterials);
  const [kbobMaterials, setKbobMaterials] = useState<KbobMaterial[]>([]);
  const [kbobLoading, setKbobLoading] = useState(true);
  const [kbobError, setKbobError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState(0);
  const [newUnmodelledMaterial, setNewUnmodelledMaterial] =
    useState<UnmodelledMaterial>({
      id: "",
      name: "",
      volume: "",
      ebkp: "",
      kbobId: "",
    });
  const [outputFormat, setOutputFormat] = useState<OutputFormats>(
    OutputFormats.GWP
  );
  const [sortBy, setSortBy] = useState<SortOption>("volume");
  const [sidebarContainer, setSidebarContainer] = useState<HTMLElement | null>(
    null
  );
  const [editingMaterial, setEditingMaterial] =
    useState<UnmodelledMaterial | null>(null);
  const [ifcResult, setIfcResult] = useState<IFCResult>({
    projectId: "",
    ifcData: { materials: [] },
    materialMappings: {},
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [impactPreview, setImpactPreview] = useState({
    currentImpact: 0,
    newImpact: 0,
    unit: "",
  });
  const [bulkMatchDialogOpen, setBulkMatchDialogOpen] = useState(false);
  const [suggestedMatches, setSuggestedMatches] = useState<
    Record<string, KbobMaterial[]>
  >({});

  // Add hardcoded project ID constant
  const DEMO_PROJECT_ID = "juch-areal";

  useEffect(() => {
    const loadKBOBMaterials = async () => {
      try {
        setKbobLoading(true);
        setKbobError(null);
        const materials = await fetchKBOBMaterials();
        console.log("Loaded KBOB materials:", materials.length);
        setKbobMaterials(materials);
      } catch (error) {
        console.error("Error loading KBOB materials:", error);
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
    let container = document.getElementById("sidebar");
    if (!container) {
      container = document.createElement("div");
      container.id = "sidebar";
      document.body.appendChild(container);
    }
    setSidebarContainer(container);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      // Create axios instance with configuration
      const axiosInstance = axios.create({
        timeout: 30000, // 30 second timeout
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
        },
      });

      try {
        const apiUrl = `${API_BASE_URL}/api/ifc-results/${DEMO_PROJECT_ID}`;
        console.log("Attempting API call to:", apiUrl);

        const response = await axiosInstance.get(apiUrl);
        console.log("Raw API response:", response.data);

        const defaultResult = {
          projectId: DEMO_PROJECT_ID,
          ifcData: { materials: [] },
          materialMappings: {},
        };

        if (typeof response.data !== "object" || response.data === null) {
          console.log("Invalid data received, using default:", defaultResult);
          setIfcResult(defaultResult);
          return;
        }

        const processedResult = {
          ...defaultResult,
          ...response.data,
          ifcData: {
            materials: Array.isArray(response.data.ifcData?.materials)
              ? response.data.ifcData.materials
              : [],
          },
          materialMappings: response.data.materialMappings || {},
        };

        console.log("Setting processed IFC result:", processedResult);
        setIfcResult(processedResult);

        // Update modelled materials based on IFC data
        if (Array.isArray(response.data.ifcData?.materials)) {
          const materials = response.data.ifcData.materials.map(
            (material: any) => ({
              id: material.name,
              name: material.name,
              volume: material.volume,
              ebkp: "", // Add if available in your data
              kbobId: response.data.materialMappings?.[material.name] || "",
            })
          );
          console.log("Setting modelled materials:", materials);
          setModelledMaterials(materials);
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error("Axios error details:", {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            url: error.config?.url,
          });

          // Handle specific error cases
          if (error.code === "ECONNABORTED") {
            console.error("Request timed out - check API server status");
          } else if (error.response?.status === 404) {
            console.error("IFC results not found for project");
          } else if (error.response?.status === 403) {
            console.error("Access forbidden - check authentication");
          }
        } else {
          console.error("Non-axios error:", error);
        }

        // Set default state on error
        setIfcResult({
          projectId: DEMO_PROJECT_ID,
          ifcData: { materials: [] },
          materialMappings: {},
        });
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      // Cancel any pending requests if component unmounts
      const source = axios.CancelToken.source();
      source.cancel("Component unmounted");
    };
  }, [DEMO_PROJECT_ID]); // Add any other dependencies

  useEffect(() => {
    if (ifcResult && ifcResult.materialMappings) {
      setMatches(ifcResult.materialMappings);
    }
  }, [ifcResult]);

  const handleMatch = useCallback((modelId: string, kbobId?: string): void => {
    setMatches((prev) => {
      const newMatches = { ...prev };
      if (kbobId === undefined) {
        delete newMatches[modelId];
      } else {
        newMatches[modelId] = kbobId;
      }
      return newMatches;
    });
  }, []);

  const handleAddUnmodelledMaterial = useCallback(
    (e: React.FormEvent<HTMLFormElement>): void => {
      e.preventDefault();
      if (
        newUnmodelledMaterial.name &&
        newUnmodelledMaterial.ebkp &&
        typeof newUnmodelledMaterial.volume === "number" &&
        newUnmodelledMaterial.volume > 0
      ) {
        const newId =
          Math.max(...unmodelledMaterials.map((m) => parseInt(m.id)), 100) + 1;
        setUnmodelledMaterials((prev) => [
          ...prev,
          {
            id: newId.toString(),
            name: newUnmodelledMaterial.name,
            volume: newUnmodelledMaterial.volume,
            ebkp: newUnmodelledMaterial.ebkp,
            kbobId: newUnmodelledMaterial.kbobId,
          },
        ]);
        setNewUnmodelledMaterial({
          id: "",
          name: "",
          volume: "",
          ebkp: "",
          kbobId: "",
        });
      }
    },
    [newUnmodelledMaterial, unmodelledMaterials]
  );

  const handleMaterialSelect = useCallback(
    (selectedOption: SingleValue<MaterialOption>, materialId: string): void => {
      handleMatch(materialId, selectedOption?.value);
    },
    [handleMatch]
  );

  const handleRemoveUnmodelledMaterial = useCallback(
    (index: number): void => {
      setUnmodelledMaterials((prev) => prev.filter((_, i) => i !== index));
    },
    [unmodelledMaterials]
  );

  const kbobMaterialOptions = useMemo(() => {
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

    const validMaterials = kbobMaterials.filter((kbob) => kbob.density > 0);

    // Create base options
    const baseOptions = validMaterials.map((kbob) => ({
      value: kbob.id,
      label: `${kbob.nameDE} (${kbob.density} ${kbob.unit})`,
    }));

    // For modelled materials tab, add suggestions
    if (activeTab === 0) {
      return (materialId: string): MaterialOption[] | MaterialOptionGroup[] => {
        const material = modelledMaterials.find((m) => m.id === materialId);
        if (!material) return baseOptions;

        // Get fuzzy matches for this material's name
        const suggestions = getFuzzyMatches(material.name, validMaterials);

        if (suggestions.length === 0) return baseOptions;

        // Create suggestion options with custom formatting
        const suggestionOptions = suggestions.map((kbob) => ({
          value: kbob.id,
          label: `✨ ${kbob.nameDE} (${kbob.density} ${kbob.unit})`,
          className: "suggestion-option",
        }));

        // Group the suggestions and base options
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

    // For unmodelled materials tab, return flat list
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
        "&:hover": {
          borderColor: theme.palette.primary.main,
        },
      }),
      option: (provided: any, state: any) => ({
        ...provided,
        backgroundColor: state.isSelected
          ? theme.palette.primary.main
          : theme.palette.background.paper,
        color: state.isDisabled
          ? theme.palette.text.disabled
          : theme.palette.text.primary,
        cursor: state.isDisabled ? "not-allowed" : "default",
        fontWeight: state.data.className === "suggestion-option" ? 500 : 400,
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

  const handleExportJSON = useCallback(() => {
    // jsonOperations.handleExportJSON(
    //   modelledMaterials,
    //   unmodelledMaterials,
    //   matches,
    //   kbobMaterials
    // );
  }, [modelledMaterials, unmodelledMaterials, matches, kbobMaterials]);

  const handleUploadClick = () => {
    // fileInputRef.current?.click();
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    // const file = event.target.files?.[0];
    // if (!file) return;
    // try {
    //   const modelledMaterials = await jsonOperations.handleFileUpload(
    //     file,
    //     (progress) => setUploadProgress(progress)
    //   );
    //   setModelledMaterials(modelledMaterials);
    //   setUploadProgress(0);
    //   if (fileInputRef.current) {
    //     fileInputRef.current.value = "";
    //   }
    // } catch (error) {
    //   console.error("Error processing JSON file:", error);
    //   alert("Fehler beim Verarbeiten der JSON-Datei");
    // }
  };

  // Update instructions array
  const instructions = [
    {
      label: "1. BIM-Daten laden",
      description: "Importieren Sie Ihre Materialdaten aus dem BIM-Modell.",
    },
    {
      label: "2. KBOB-Referenzen zuordnen",
      description:
        "Ordnen Sie die Materialien den passenden KBOB-Referenzen zu.",
    },
    {
      label: "3. Ökobilanz berechnen",
      description: "Berechnen Sie die Umweltauswirkungen Ihres Projekts.",
    },
  ];

  // Calculate current step
  const getCurrentStep = () => {
    if (modelledMaterials.length === 0) return 0;
    if (
      modelledMaterials.filter((m) => matches[m.id]).length <
      modelledMaterials.length
    )
      return 1;
    return 2;
  };

  const outputFormatOptions = useMemo(
    () =>
      Object.entries(OutputFormatLabels).map(([value, label]) => ({
        value,
        label,
      })),
    []
  );

  const sortOptions = useMemo(
    () => [
      { value: "volume", label: "Volumen" },
      { value: "name", label: "Name" },
    ],
    []
  );

  // Add handler for confirmation
  const handleConfirmCalculation = async () => {
    setLoading(true);
    try {
      await handleAbschliessen();
      setConfirmationOpen(false);
      // Show success message
      // You might want to add a Snackbar or other notification here
    } catch (error) {
      console.error("Error updating LCA:", error);
      // Show error message
    } finally {
      setLoading(false);
    }
  };

  // Update the showCalculationPreview function to only use matched materials
  const showCalculationPreview = () => {
    // Only calculate with matched materials
    const matchedMaterials = modelledMaterials.filter((m) => matches[m.id]);
    const currentTotal = calculator.calculateGrandTotal(
      matchedMaterials,
      matches,
      kbobMaterials,
      outputFormat,
      unmodelledMaterials
    );

    const previousTotal = parseFloat(currentTotal) * 1.2;

    setImpactPreview({
      currentImpact: previousTotal,
      newImpact: parseFloat(currentTotal),
      unit: OutputFormatUnits[outputFormat],
    });
    setConfirmationOpen(true);
  };

  // Add function to get best matches for all unmatched materials
  const findBestMatchesForAll = useCallback(() => {
    const unmatched = modelledMaterials.filter((m) => !matches[m.id]);
    const suggestions: Record<string, KbobMaterial[]> = {};

    unmatched.forEach((material) => {
      suggestions[material.id] = getFuzzyMatches(
        material.name,
        kbobMaterials,
        1
      );
    });

    setSuggestedMatches(suggestions);
    setBulkMatchDialogOpen(true);
  }, [modelledMaterials, matches, kbobMaterials]);

  // Add function to apply selected matches
  const applyBulkMatches = useCallback(() => {
    const newMatches = { ...matches };
    Object.entries(suggestedMatches).forEach(([materialId, suggestions]) => {
      if (suggestions.length > 0) {
        newMatches[materialId] = suggestions[0].id;
      }
    });
    setMatches(newMatches);
    setBulkMatchDialogOpen(false);
  }, [matches, suggestedMatches]);

  // Add bulk matching dialog component
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
          {Object.entries(suggestedMatches).map(([materialId, suggestions]) => {
            const material = modelledMaterials.find((m) => m.id === materialId);
            const suggestion = suggestions[0];

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
                      {material?.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      Volumen: {material?.volume.toLocaleString()} m³
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {suggestion ? (
                      <>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography variant="subtitle2" color="primary">
                            {suggestion.nameDE}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {suggestion.density} {suggestion.unit}
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
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={() => setBulkMatchDialogOpen(false)}
          variant="outlined"
          color="inherit"
        >
          Abbrechen
        </Button>
        <Button onClick={applyBulkMatches} variant="contained" color="primary">
          Zuordnungen übernehmen
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Update the confirmation dialog content
  const confirmationContent = (
    <Dialog
      open={confirmationOpen}
      onClose={() => setConfirmationOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6">Ökobilanz berechnen</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          {modelledMaterials.filter((m) => !matches[m.id]).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                {modelledMaterials.filter((m) => !matches[m.id]).length} von{" "}
                {modelledMaterials.length} Materialien sind nicht zugeordnet und
                werden nicht berücksichtigt.
              </Typography>
              <Button
                onClick={findBestMatchesForAll}
                variant="text"
                color="primary"
                startIcon={
                  <Box component="span" sx={{ fontSize: "1.1em" }}>
                    ✨
                  </Box>
                }
                sx={{ mt: 1, textTransform: "none" }}
              >
                Automatische Zuordnung vorschlagen
              </Button>
            </Box>
          )}
          <Typography variant="body1" gutterBottom>
            Ihre Materialzuordnungen führen zu folgenden Änderungen:
          </Typography>
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: "grey.50",
              borderRadius: 1,
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography color="text.secondary">
                Bisherige Emissionen:
              </Typography>
              <Typography fontWeight="medium">
                {impactPreview.currentImpact.toLocaleString()}{" "}
                {impactPreview.unit}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography color="text.secondary">Update:</Typography>
              <Typography fontWeight="medium" color="primary.main">
                {impactPreview.newImpact.toLocaleString()} {impactPreview.unit}
              </Typography>
            </Box>
            <Box
              sx={{
                mt: 1,
                pt: 1,
                borderTop: 1,
                borderColor: "divider",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <Typography fontWeight="medium">
                Potentielle Einsparung:
              </Typography>
              <Typography fontWeight="bold" color="primary.main">
                {(
                  impactPreview.currentImpact - impactPreview.newImpact
                ).toLocaleString()}{" "}
                {impactPreview.unit}
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={() => setConfirmationOpen(false)}
          variant="outlined"
          color="inherit"
        >
          Zurück
        </Button>
        <Button
          onClick={handleConfirmCalculation}
          variant="contained"
          color="primary"
        >
          Ökobilanz aktualisieren
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Update progress bar color
  const progressBar = (
    <Box
      sx={{
        width: `${
          (modelledMaterials.filter((m) => matches[m.id]).length /
            modelledMaterials.length) *
          100
        }%`,
        bgcolor: theme.palette.primary.main,
        borderRadius: "9999px",
        height: "100%",
        transition: "width 0.3s",
      }}
    />
  );

  // Update the Output Format section
  const outputFormatSection = (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Öko-Indikator
      </Typography>
      <Select
        value={outputFormatOptions.find((opt) => opt.value === outputFormat)}
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
  );

  // Update the calculation button section
  const calculationButton = (
    <Box sx={{ mt: 3 }}>
      {modelledMaterials.filter((m) => matches[m.id]).length === 0 ? (
        <>
          <Box sx={{ mb: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Keine Materialien zugeordnet
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              onClick={findBestMatchesForAll}
              startIcon={
                <Box component="span" sx={{ fontSize: "1.1em" }}>
                  ✨
                </Box>
              }
              sx={{ textTransform: "none" }}
            >
              Automatische Zuordnung vorschlagen
            </Button>
          </Box>
        </>
      ) : null}
      <Button
        variant="contained"
        color="primary"
        fullWidth
        size="large"
        onClick={showCalculationPreview}
        disabled={loading}
        sx={{
          py: 1.5,
          textTransform: "none",
          fontWeight: 500,
          letterSpacing: "0.3px",
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        }}
      >
        Ökobilanz berechnen
        {modelledMaterials.filter((m) => !matches[m.id]).length > 0 && (
          <Typography
            component="span"
            variant="caption"
            sx={{
              ml: 1,
              opacity: 0.7,
              fontWeight: "normal",
            }}
          >
            ({modelledMaterials.filter((m) => matches[m.id]).length} von{" "}
            {modelledMaterials.length})
          </Typography>
        )}
      </Button>
      {loading && (
        <Box sx={{ mt: 1, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );

  // Update the sidebar content
  const sidebarContent = (
    <>
      <Paper
        elevation={1}
        sx={{
          p: 2,
          height: "fit-content",
          backgroundColor: "background.paper",
          borderRadius: 1,
          width: "100%",
          "& > .MuiBox-root": { width: "100%" },
        }}
      >
        {/* Combined Top Section */}
        <Box sx={{ mb: 3 }}>
          {/* Total Result and Output Format Group */}
          <Box sx={{ mb: 2 }}>
            {/* Total Result */}
            <Box
              sx={{
                p: 2,
                mb: 1.5,
                background: "linear-gradient(to right top, #F1D900, #fff176)",
                borderRadius: 1,
              }}
            >
              <Typography
                variant="h4"
                component="p"
                color="common.black"
                fontWeight="bold"
              >
                {calculator.calculateGrandTotal(
                  modelledMaterials,
                  matches,
                  kbobMaterials,
                  outputFormat,
                  unmodelledMaterials
                )}
                <Typography
                  component="span"
                  variant="h6"
                  sx={{ ml: 1, opacity: 0.7, fontWeight: "normal" }}
                >
                  {OutputFormatUnits[outputFormat]}
                </Typography>
              </Typography>
            </Box>

            {/* Output Format */}
            {outputFormatSection}
          </Box>

          {/* Separator */}
          <Box
            sx={{
              height: "1px",
              bgcolor: "divider",
              my: 2,
              width: "100%",
            }}
          />

          {/* Progress */}
          <Box sx={{ pt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
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
                    bgcolor: theme.palette.grey[100],
                    borderRadius: "9999px",
                    height: "8px",
                    mt: 0.5,
                  }}
                >
                  {progressBar}
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {modelledMaterials.filter((m) => matches[m.id]).length} von{" "}
                {modelledMaterials.length} zugeordnet
              </Typography>
            </Box>
          </Box>

          {/* Calculation Button */}
          {calculationButton}
        </Box>

        {/* Process Steps Section */}
        <Box>
          <Typography variant="subtitle1" fontWeight="600" gutterBottom>
            Prozess
          </Typography>
          <Stepper
            orientation="vertical"
            activeStep={getCurrentStep()}
            sx={{ maxWidth: "320px" }}
          >
            {instructions.map((step, index) => (
              <Step key={step.label} completed={getCurrentStep() > index}>
                <StepLabel>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {step.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    {step.description}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      </Paper>
      {confirmationContent}
    </>
  );

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleEditMaterial = (material: UnmodelledMaterial) => {
    setEditingMaterial(material);
  };

  const handleSaveEdit = (editedMaterial: UnmodelledMaterial) => {
    setUnmodelledMaterials((prev) =>
      prev.map((m) => (m.id === editedMaterial.id ? editedMaterial : m))
    );
    setEditingMaterial(null);
  };

  // Handler for the 'Abschliessen' button click
  const handleAbschliessen = () => {
    setLoading(true);
    const payload = {
      projectId: DEMO_PROJECT_ID,
      materialMappings: matches,
    };

    axios
      .post(`${API_BASE_URL}/api/update-material-mappings`, payload)
      .then((response) => {
        setMessage("Material mappings updated successfully!");
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error updating material mappings:", error);
        setMessage("Error updating material mappings");
        setLoading(false);
      });
  };

  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      {sidebarContainer &&
        ReactDOM.createPortal(sidebarContent, sidebarContainer)}
      {bulkMatchingDialog}
      <Box
        sx={{ display: "flex", flexDirection: "column", gap: 3, width: "100%" }}
      >
        <Paper elevation={1} sx={{ p: 3, width: "100%" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 3,
            }}
          >
            <Typography variant="h5" fontWeight="bold">
              Materialien
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Sortieren nach:
              </Typography>
              <Select
                value={sortOptions.find((opt) => opt.value === sortBy)}
                onChange={(newValue) =>
                  setSortBy(newValue?.value as SortOption)
                }
                options={sortOptions}
                styles={selectStyles}
                className="w-40"
              />
            </Box>
          </Box>

          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              sx={{
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "text.secondary",
                  "&.Mui-selected": {
                    color: "primary.main",
                  },
                },
                "& .MuiTabs-indicator": {
                  backgroundColor: "primary.main",
                },
              }}
            >
              <Tab label="Modellierte Materialien" />
              <Tab label="Nicht modellierte Materialien" />
            </Tabs>
          </Box>

          {activeTab === 0 ? (
            <ModelledMaterialList
              modelledMaterials={modelledMaterials}
              kbobMaterials={kbobMaterials}
              matches={matches}
              handleMaterialSelect={handleMaterialSelect}
              kbobMaterialOptions={kbobMaterialOptions}
              selectStyles={selectStyles}
              sortMaterials={(materials) => sortMaterials(materials, sortBy)}
            />
          ) : (
            <>
              <UnmodelledMaterialForm
                newUnmodelledMaterial={newUnmodelledMaterial}
                setNewUnmodelledMaterial={setNewUnmodelledMaterial}
                handleAddUnmodelledMaterial={handleAddUnmodelledMaterial}
                kbobMaterials={kbobMaterials}
                kbobMaterialOptions={kbobMaterialOptions}
                selectStyles={selectStyles}
              />
              <MaterialList
                unmodelledMaterials={unmodelledMaterials}
                kbobMaterials={kbobMaterials}
                handleMaterialSelect={handleMaterialSelect}
                handleRemoveUnmodelledMaterial={handleRemoveUnmodelledMaterial}
                handleEditMaterial={handleEditMaterial}
                kbobMaterialOptions={kbobMaterialOptions}
                selectStyles={selectStyles}
              />
              <EditMaterialDialog
                open={!!editingMaterial}
                material={editingMaterial}
                onClose={() => setEditingMaterial(null)}
                onSave={handleSaveEdit}
                selectStyles={selectStyles}
                kbobMaterials={kbobMaterials}
                kbobMaterialOptions={kbobMaterialOptions}
              />
            </>
          )}
        </Paper>
      </Box>

      {/* Floating Info Panel */}
      <Paper
        elevation={2}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          maxWidth: { xs: 280, sm: 320 },
          borderRadius: 2,
          overflow: "visible",
          bgcolor: "background.paper",
          transform: "translate3d(0,0,0)", // Force GPU acceleration
          willChange: "transform",
          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          cursor: "default",
          "&:hover": {
            transform: "translate3d(0,-4px,0)",
            "& .expandable-content": {
              opacity: 1,
              transform: "translate3d(0,0,0)",
              visibility: "visible",
            },
          },
        }}
      >
        <Box
          className="expandable-content"
          sx={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            right: 0,
            visibility: "hidden",
            transform: "translate3d(0,20px,0)",
            opacity: 0,
            willChange: "transform, opacity",
            transition:
              "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), visibility 0s linear 0.2s",
            bgcolor: "background.paper",
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
            boxShadow: theme.shadows[8],
            "&::before": {
              content: '""',
              position: "absolute",
              bottom: -8,
              left: 0,
              right: 0,
              height: 8,
              bgcolor: "transparent",
            },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              KBOB Ökobilanzdaten sind die offizielle Datenquelle für die
              Bewertung der Umweltwirkungen von Bauprodukten und -prozessen in
              der Schweiz. Sie ermöglichen eine fundierte und vergleichbare
              Beurteilung der Nachhaltigkeit von Bauprojekten. Mehr Infos unter
              👇
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            p: 1.5,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            display: "flex",
            alignItems: "center",
            gap: 1,
            borderRadius: 2,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 500, fontSize: "0.875rem" }}
          >
            KBOB Ökobilanzdaten 6.2
          </Typography>
          <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
            <Button
              component="a"
              href="https://www.kbob.admin.ch/de/oekobilanzdaten-im-baubereich"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                minWidth: "auto",
                p: 0.5,
                color: "primary.contrastText",
                opacity: 0.8,
                "&:hover": { opacity: 1 },
              }}
            >
              <svg
                height="18"
                width="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
              </svg>
            </Button>
            <Button
              component="a"
              href="https://github.com/LTplus-AG/nhm-react-lca"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                minWidth: "auto",
                p: 0.5,
                color: "primary.contrastText",
                opacity: 0.8,
                "&:hover": { opacity: 1 },
              }}
            >
              <svg
                height="18"
                width="18"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
              </svg>
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

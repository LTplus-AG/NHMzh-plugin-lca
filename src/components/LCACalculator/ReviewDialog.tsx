import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Grid,
} from "@mui/material";
import {
  Material,
  OutputFormats,
  KbobMaterial,
  LcaElement,
  MaterialImpact,
} from "../../types/lca.types";
import { DEFAULT_AMORTIZATION_YEARS } from "../../utils/constants";
import { LCACalculator } from "../../utils/lcaCalculator";
import { DisplayMode } from "../../utils/lcaDisplayHelper";
import ElementImpactTable from "./ElementImpactTable";

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  modelledMaterials: Material[];
  matches: Record<string, string>;
  currentImpact: { currentImpact: string; unit: string };
  projectId?: string;
  displayMode: DisplayMode;
  ebfNumeric: number | null;
  calculator: LCACalculator;
  materialDensities: Record<string, number>;
  outputFormat: OutputFormats;
  ifcElementsWithImpacts: LcaElement[];
  onSave: (data: any) => Promise<void>;
  kbobMaterials: KbobMaterial[];
  aggregatedMaterialImpacts: Record<string, MaterialImpact>;
}

const ReviewDialog: React.FC<ReviewDialogProps> = ({
  open,
  onClose,
  modelledMaterials,
  matches,
  projectId,
  displayMode,
  ebfNumeric,
  calculator,
  materialDensities,
  ifcElementsWithImpacts,
  onSave,
  kbobMaterials,
  outputFormat,
  aggregatedMaterialImpacts,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const formatNumber = (
    num: number | null | undefined,
    decimals: number = 0
  ): string => {
    if (num === null || num === undefined || isNaN(num)) return "N/A";
    return new Intl.NumberFormat("de-CH", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    }).format(num);
  };

  const getDisplayValue = (
    value: number | undefined,
    amortizationYears: number
  ): number | undefined => {
    if (value === undefined) return undefined;
    if (displayMode === "relative" && ebfNumeric !== null && ebfNumeric > 0) {
      return value / (amortizationYears * ebfNumeric);
    }
    return value;
  };

  const getDecimalPrecision = (value: number | undefined): number => {
    if (value === undefined) return 0;
    if (displayMode === "relative" || Math.abs(value) < 1) {
      return 2;
    } else if (Math.abs(value) < 100) {
      return 1;
    }
    return 0;
  };

  const formatDisplayValue = (
    value: number | undefined,
    amortizationYears: number
  ): string => {
    const displayValue = getDisplayValue(value, amortizationYears);
    if (displayValue === undefined) return "N/A";
    const decimals = getDecimalPrecision(displayValue);
    return formatNumber(displayValue, decimals);
  };

  const getUnitForOutputFormat = (format: OutputFormats): string => {
    let baseUnit = "";
    switch (format) {
      case OutputFormats.GWP:
        baseUnit = "kg CO₂-eq";
        break;
      case OutputFormats.UBP:
        baseUnit = "UBP";
        break;
      case OutputFormats.PENR:
        baseUnit = "kWh"; // Or kWh?
        break;
      default:
        baseUnit = "";
    }
    if (displayMode === "relative") {
      return `${baseUnit}/m²·a`;
    }
    return baseUnit;
  };

  const handleSaveAndSubmit = async () => {
    if (!projectId) {
      alert("Kein Projekt ausgewählt.");
      return;
    }

    try {
      setSaving(true);

      // Create a map for quick KBOB lookup
      const kbobMap = new Map(kbobMaterials.map((k) => [k.id, k]));

      // Transform elements to include KBOB names directly in the material name field
      const elementsForKafka = ifcElementsWithImpacts.map((element) => ({
        ...element,
        // Ensure materials array exists and is an array before mapping
        materials: Array.isArray(element.materials)
          ? element.materials.map((material) => {
              // Use material.id (which should be the unique IFC material identifier) to find the match
              const kbobId = matches[material.id];
              const kbobMaterial = kbobId ? kbobMap.get(kbobId) : null;
              // Use KBOB name if available, otherwise fallback to the original material name
              const finalMaterialName = kbobMaterial
                ? kbobMaterial.nameDE
                : material.name;

              return {
                ...material,
                name: finalMaterialName, // Use KBOB name here
                kbob_id: kbobId || null, // Add KBOB ID explicitly
                original_ifc_name: material.name, // Keep original name for reference if needed
              };
            })
          : [], // Provide an empty array if element.materials is not valid
      }));

      // Create the data structure for saving, using the transformed elements
      const dataToSave = {
        ifcData: {
          elements: elementsForKafka, // Send transformed elements
          // We might not need to send the full ifcData structure if only elements are used by backend for Kafka
          // Adjust based on backend requirements
        },
        materialMappings: matches, // Send original mappings as well, backend might still use them
        ebfValue: ebfNumeric !== null ? ebfNumeric.toString() : undefined,
      };

      // Save the transformed data
      await onSave(dataToSave);

      // Execute the submit action after saving
      onClose(); // Close the dialog after successful save/submit
      // Maybe call onSubmit() here if it does something different than just closing?
      // onSubmit(); // <-- Uncomment if onSubmit has separate logic
    } catch (error) {
      console.error("Error saving and submitting LCA data:", error);
      alert(
        "Fehler beim Speichern und Senden der Ökobilanz: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setSaving(false);
    }
  };

  // Calculate required values inside the component
  const totalElementCount = modelledMaterials.filter(
    (m) => matches[m.id]
  ).length;

  // Use calculateGrandTotal for each indicator
  // Note: calculateGrandTotal returns a formatted string. We might need raw numbers later.
  const gwpFormatted = calculator.calculateGrandTotal(
    modelledMaterials,
    matches,
    kbobMaterials,
    OutputFormats.GWP,
    materialDensities,
    undefined,
    displayMode,
    ebfNumeric
  );
  const ubpFormatted = calculator.calculateGrandTotal(
    modelledMaterials,
    matches,
    kbobMaterials,
    OutputFormats.UBP,
    materialDensities,
    undefined,
    displayMode,
    ebfNumeric
  );
  const penrFormatted = calculator.calculateGrandTotal(
    modelledMaterials,
    matches,
    kbobMaterials,
    OutputFormats.PENR,
    materialDensities,
    undefined,
    displayMode,
    ebfNumeric
  );

  // Summary content to show impact results
  const summaryContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: (theme) => theme.spacing(3),
        p: (theme) => theme.spacing(3),
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="h6" component="h3">
        Gesamtbilanz
      </Typography>

      <Grid
        container
        spacing={2}
        sx={{ borderBottom: 1, borderColor: "divider", pb: 3, mb: 2 }}
      >
        <Grid item xs={12} sm={4}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            CO₂-eq
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: "bold" }}>
            {gwpFormatted}
          </Typography>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            UBP
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: "bold" }}>
            {ubpFormatted}
          </Typography>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Primärenergie nicht erneuerbar
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: "bold" }}>
            {penrFormatted}
          </Typography>
        </Grid>
      </Grid>

      <Paper
        elevation={0}
        sx={{
          bgcolor: (theme) => theme.palette.grey[50],
          p: 2,
          borderRadius: 1,
        }}
      >
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: "medium" }}>
          Übersicht
        </Typography>
        <Grid container spacing={1} rowSpacing={1.5}>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Zugeordnete Materialien:
            </Typography>
          </Grid>
          <Grid item xs={6} sx={{ textAlign: "right" }}>
            <Typography variant="body2" fontWeight="medium">
              {totalElementCount}
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Elemente:
            </Typography>
          </Grid>
          <Grid item xs={6} sx={{ textAlign: "right" }}>
            <Typography variant="body2" fontWeight="medium">
              {totalElementCount}
            </Typography>
          </Grid>

          {ebfNumeric !== null && (
            <>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  EBF:
                </Typography>
              </Grid>
              <Grid item xs={6} sx={{ textAlign: "right" }}>
                <Typography variant="body2" fontWeight="medium">
                  {formatNumber(ebfNumeric, 0)} m²
                </Typography>
              </Grid>
            </>
          )}

          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Anzeigemodus:
            </Typography>
          </Grid>
          <Grid item xs={6} sx={{ textAlign: "right" }}>
            <Typography variant="body2" fontWeight="medium">
              {displayMode === "relative"
                ? `pro m²·Jahr (gem. SIA 2032)`
                : "Absolut"}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h6">Ökobilanz überprüfen</Typography>
          <Chip
            label={`${formatNumber(totalElementCount, 0)} Elemente`}
            color={
              totalElementCount >= 80
                ? "success"
                : totalElementCount >= 50
                ? "warning"
                : "error"
            }
            size="small"
          />
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label="Übersicht" />
          <Tab label="Bauteile" />
          <Tab label="Materialien" />
        </Tabs>

        {/* Summary tab */}
        {tabValue === 0 && summaryContent}

        {/* Elements tab */}
        {tabValue === 1 && (
          <ElementImpactTable
            elements={ifcElementsWithImpacts}
            outputFormat={outputFormat}
            displayMode={displayMode}
            ebfNumeric={ebfNumeric}
            matches={matches}
          />
        )}

        {/* Materials tab */}
        {tabValue === 2 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "medium" }}>Material</TableCell>
                  <TableCell sx={{ fontWeight: "medium" }}>Zuordnung</TableCell>
                  <TableCell align="right" sx={{ fontWeight: "medium" }}>
                    Volume (m³)
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "medium" }}>
                    GWP ({getUnitForOutputFormat(OutputFormats.GWP)})
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "medium" }}>
                    UBP ({getUnitForOutputFormat(OutputFormats.UBP)})
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "medium" }}>
                    PENR ({getUnitForOutputFormat(OutputFormats.PENR)})
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modelledMaterials.map((material) => {
                  const impact = aggregatedMaterialImpacts[material.id];
                  return (
                    <TableRow key={material.id}>
                      <TableCell>{material.name}</TableCell>
                      <TableCell>
                        {matches[material.id] ? (
                          <Chip
                            size="small"
                            label="Zugeordnet"
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Chip
                            size="small"
                            label="Nicht zugeordnet"
                            color="error"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                                                        {formatNumber(material.volume, 3)}
                      </TableCell>
                      <TableCell align="right">
                        {formatDisplayValue(impact?.gwp, DEFAULT_AMORTIZATION_YEARS)}
                      </TableCell>
                      <TableCell align="right">
                        {formatDisplayValue(impact?.ubp, DEFAULT_AMORTIZATION_YEARS)}
                      </TableCell>
                      <TableCell align="right">
                        {formatDisplayValue(
                          impact?.penr,
                          DEFAULT_AMORTIZATION_YEARS
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit" variant="outlined">
          Abbrechen
        </Button>
        <Button
          onClick={handleSaveAndSubmit}
          color="primary"
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {saving ? "Wird gespeichert..." : "Ans Dashboard senden"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReviewDialog;

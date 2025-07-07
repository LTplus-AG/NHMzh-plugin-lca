import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Grid,
  Paper,
  Box,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import Select from "react-select";
import {
  Material,
  KbobMaterial,
  OutputFormats,
  MaterialImpact,
} from "../../types/lca.types";

export interface MaterialOption {
  value: string;
  label: string;
  isDisabled?: boolean;
  className?: string;
}

export interface MaterialOptionGroup {
  label: string;
  options: MaterialOption[];
}

export interface ModelledMaterialListProps {
  modelledMaterials: Material[];
  kbobMaterials: KbobMaterial[];
  matches: Record<string, string>;
  setMatches: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  kbobMaterialOptions:
    | MaterialOption[]
    | ((materialId: string) => MaterialOption[] | MaterialOptionGroup[]);
  selectStyles: any;
  onDeleteMaterial: (id: string) => void;
  handleDensityUpdate?: (materialId: string, newDensity: number) => void;
  materialDensities?: Record<string, number>;
  outputFormat?: OutputFormats;
  aggregatedMaterialImpacts: Record<string, MaterialImpact>;
}

interface DensityDialogProps {
  open: boolean;
  onClose: () => void;
  materialId: string;
  materialName: string;
  currentDensity: number;
  densityRange: { min: number; max: number };
  onSave: (density: number) => void;
}

const DensityDialog: React.FC<DensityDialogProps> = ({
  open,
  onClose,
  materialName,
  currentDensity,
  densityRange,
  onSave,
}) => {
  const [density, setDensity] = useState(currentDensity);
  const [error, setError] = useState("");

  const handleDensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setDensity(value);
    if (value < densityRange.min || value > densityRange.max) {
      setError(
        `Dichte muss zwischen ${densityRange.min} und ${densityRange.max} kg/m³ liegen`
      );
    } else {
      setError("");
    }
  };

  const handleSave = () => {
    if (!error) {
      onSave(density);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="h6">Dichte bearbeiten</Typography>
          <Typography variant="subtitle2" color="text.secondary">
            {materialName}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Gültige Dichte: {densityRange.min} - {densityRange.max} kg/m³
          </Typography>
          <TextField
            fullWidth
            type="number"
            label="Dichte (kg/m³)"
            value={density}
            onChange={handleDensityChange}
            error={!!error}
            helperText={error}
            sx={{ mt: 1 }}
            InputProps={{
              inputProps: {
                min: densityRange.min,
                max: densityRange.max,
                step: "0.1",
              },
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Abbrechen
        </Button>
        <Button onClick={handleSave} color="primary" disabled={!!error}>
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ModelledMaterialList: React.FC<ModelledMaterialListProps> = ({
  modelledMaterials,
  kbobMaterials,
  matches,
  setMatches,
  kbobMaterialOptions,
  selectStyles,
  handleDensityUpdate,
  materialDensities = {},
  outputFormat = OutputFormats.GWP,
  aggregatedMaterialImpacts,
}) => {
  const [editingDensity, setEditingDensity] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"none" | "matched" | "unmatched">(
    "none"
  );
  const theme = useTheme();

  const getMatchedOption = (materialId: string) => {
    const matchId = matches[materialId];
    if (!matchId) return null;

    // If kbobMaterialOptions is a function, get the options for this material
    const options =
      typeof kbobMaterialOptions === "function"
        ? kbobMaterialOptions(materialId)
        : kbobMaterialOptions;

    // Handle both flat options and grouped options
    if (Array.isArray(options) && options.length > 0) {
      // Check if this is a group array
      if ("options" in options[0]) {
        // It's a group array, search through all groups
        for (const group of options as MaterialOptionGroup[]) {
          const option = group.options.find((opt) => opt.value === matchId);
          if (option) return option;
        }
        return null;
      } else {
        // It's a flat array
        return (
          (options as MaterialOption[]).find((opt) => opt.value === matchId) ||
          null
        );
      }
    }

    return null;
  };

  const getOptionsForMaterial = (materialId: string) => {
    return typeof kbobMaterialOptions === "function"
      ? kbobMaterialOptions(materialId)
      : kbobMaterialOptions;
  };

  const getEmissionValue = (material: Material) => {
    const impact = aggregatedMaterialImpacts[material.id];
    if (!impact) return null;

    switch (outputFormat) {
      case OutputFormats.GWP:
        return impact.gwp;
      case OutputFormats.UBP:
        return impact.ubp;
      case OutputFormats.PENR:
        return impact.penr;
      default:
        return null;
    }
  };

  const getEmissionUnit = () => {
    switch (outputFormat) {
      case OutputFormats.GWP:
        return "kg CO₂-eq";
      case OutputFormats.UBP:
        return "UBP";
      case OutputFormats.PENR:
        return "kWh";
      default:
        return "";
    }
  };

  const getMatchedKbobMaterial = (materialId: string) => {
    const matchId = matches[materialId];
    if (!matchId) return null;
    return kbobMaterials.find((m) => m.id === matchId) || null;
  };

  const isMaterialMatched = (materialId: string) => {
    const matchId = matches[materialId];
    return (
      !!matchId &&
      matchId.trim() !== "" &&
      kbobMaterials.some((m) => m.id === matchId)
    );
  };

  const sortedMaterials = useMemo(() => {
    const arr = [...modelledMaterials];
    if (sortOrder === "matched") {
      arr.sort((a, b) => {
        const aMatched = isMaterialMatched(a.id);
        const bMatched = isMaterialMatched(b.id);
        if (aMatched === bMatched) return 0;
        return aMatched ? -1 : 1;
      });
    } else if (sortOrder === "unmatched") {
      arr.sort((a, b) => {
        const aMatched = isMaterialMatched(a.id);
        const bMatched = isMaterialMatched(b.id);
        if (aMatched === bMatched) return 0;
        return aMatched ? 1 : -1;
      });
    }
    return arr;
  }, [modelledMaterials, sortOrder, matches, kbobMaterials]);

  const getSelectStylesForMaterial = (materialId: string) => {
    const base = selectStyles;
    if (!isMaterialMatched(materialId)) {
      return {
        ...base,
        control: (provided: any, state: any) => ({
          ...(base.control ? base.control(provided, state) : provided),
          borderColor: theme.palette.primary.main,
          boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.3)}`,
        }),
      };
    }
    return base;
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
        von {modelledMaterials.length} Materialien zugeordnet
      </Typography>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={sortOrder}
          onChange={(_, val) => val && setSortOrder(val)}
        >
          <ToggleButton value="none">Standard</ToggleButton>
          <ToggleButton value="unmatched">Offen zuerst</ToggleButton>
          <ToggleButton value="matched">Erledigt zuerst</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Card Grid Layout */}
      <Grid container spacing={2}>
        {sortedMaterials.map((material) => {
          const matchedKbobMaterial = getMatchedKbobMaterial(material.id);
          const emissionValue = getEmissionValue(material);

          return (
            <Grid item xs={12} sm={6} md={4} key={material.id}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  "&:hover": {
                    boxShadow: (theme) => theme.shadows[2],
                    borderColor: "transparent",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                {/* Header with Material Name and Actions */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                    gap: 1,
                  }}
                >
                  {/* Material Name with conditional tooltip */}
                  {(() => {
                    const textRef = useRef<HTMLSpanElement>(null);
                    const [isOverflowing, setIsOverflowing] = useState(false);

                    useEffect(() => {
                      const element = textRef.current;
                      if (element) {
                        setIsOverflowing(
                          element.scrollWidth > element.clientWidth
                        );
                      }
                    }, [material.name]);

                    const typography = (
                      <Typography
                        ref={textRef}
                        variant="h6"
                        noWrap
                        component="span"
                        sx={{
                          fontWeight: 600,
                          color: "text.primary",
                          fontSize: { xs: "1rem", sm: "1.1rem" },
                          flexGrow: 1,
                          flexShrink: 1,
                          minWidth: 0,
                          display: "block",
                        }}
                      >
                        {material.name}
                      </Typography>
                    );

                    return isOverflowing ? (
                      <Tooltip title={material.name} enterDelay={1000}>
                        {typography}
                      </Tooltip>
                    ) : (
                      typography
                    );
                  })()}
                </Box>

                {/* Volume Badge */}
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    bgcolor: "secondary.lighter",
                    color: "secondary.dark",
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1.5,
                    mb: 2,
                    alignSelf: "flex-start",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: "6px" }}
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  </svg>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, lineHeight: 1 }}
                  >
                    {typeof material.volume === "number"
                      ? material.volume.toFixed(3)
                      : "0.000"}{" "}
                    m³
                  </Typography>
                </Box>

                {/* KBOB Material Selection */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    KBOB-Material:
                  </Typography>
                  <Select
                    value={getMatchedOption(material.id)}
                    onChange={(newValue) => {
                      const newMatches = { ...matches };
                      if (newValue) {
                        newMatches[material.id] = newValue.value;
                      } else {
                        delete newMatches[material.id];
                      }
                      setMatches(newMatches);
                    }}
                    options={getOptionsForMaterial(material.id)}
                    styles={getSelectStylesForMaterial(material.id)}
                    placeholder="KBOB-Material auswählen..."
                    isClearable
                    menuPlacement="auto"
                  />
                </Box>

                {/* Emission Value (if matched) */}
                {matchedKbobMaterial && emissionValue !== null && (
                  <Box sx={{ mt: "auto", pt: 1 }}>
                    <Chip
                      label={`${emissionValue.toLocaleString("de-CH", {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })} ${getEmissionUnit()}`}
                      size="small"
                      sx={{
                        bgcolor: "success.lighter",
                        color: "success.dark",
                        fontWeight: 500,
                        "& .MuiChip-label": {
                          px: 1,
                        },
                      }}
                    />
                  </Box>
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Density Dialog */}
      {editingDensity && (
        <DensityDialog
          open={!!editingDensity}
          onClose={() => setEditingDensity(null)}
          materialId={editingDensity}
          materialName={
            modelledMaterials.find((m) => m.id === editingDensity)?.name || ""
          }
          currentDensity={
            materialDensities[editingDensity] ||
            kbobMaterials.find((k) => k.id === matches[editingDensity])
              ?.density ||
            0
          }
          densityRange={
            kbobMaterials.find((k) => k.id === matches[editingDensity])
              ?.densityRange || { min: 0, max: 5000 }
          }
          onSave={(density) => {
            if (handleDensityUpdate) {
              handleDensityUpdate(editingDensity, density);
            }
            setEditingDensity(null);
          }}
        />
      )}
    </Box>
  );
};

export default ModelledMaterialList;

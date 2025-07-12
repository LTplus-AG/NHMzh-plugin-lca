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
  Slider,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import Select from "react-select";
import { KbobMaterial, Material, MaterialImpact, OutputFormats } from "../../types/lca.types";
import { MaterialOption, MaterialOptionGroup } from "../../types/calculator.types";

interface ModelledMaterialListProps {
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
          const hasDensityRange = matchedKbobMaterial?.densityRange !== undefined && 
                                  matchedKbobMaterial?.densityRange !== null &&
                                  matchedKbobMaterial.densityRange.min !== undefined &&
                                  matchedKbobMaterial.densityRange.max !== undefined;
          const currentDensity = materialDensities[material.id] || 
            (hasDensityRange 
              ? (matchedKbobMaterial.densityRange!.min + matchedKbobMaterial.densityRange!.max) / 2
              : matchedKbobMaterial?.density || 0);

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

                {/* Density Display and Slider (if material is matched) */}
                {matchedKbobMaterial && (
                  <Box 
                    sx={{ 
                      mb: 2,
                      p: 2,
                      bgcolor: theme.palette.grey[50],
                      borderRadius: 1,
                      border: `1px solid ${theme.palette.grey[200]}`,
                    }}
                  >
                    {/* Header Row */}
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      mb: hasDensityRange ? 1.5 : 0,
                    }}>
                      {/* Density */}
                      <Box>
                        <Typography 
                          variant="overline" 
                          sx={{ 
                            color: theme.palette.text.secondary,
                            fontSize: '0.7rem',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {hasDensityRange ? 'Dichte' : 'Dichte (fest)'}
                        </Typography>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            fontWeight: 600,
                            lineHeight: 1,
                            mt: 0.25,
                          }}
                        >
                          {currentDensity.toFixed(0)} <Typography component="span" variant="caption" color="text.secondary">kg/m³</Typography>
                        </Typography>
                      </Box>
                      
                      {/* Impact */}
                      {emissionValue !== null && (
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography 
                            variant="overline" 
                            sx={{ 
                              color: theme.palette.text.secondary,
                              fontSize: '0.7rem',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {outputFormat}
                          </Typography>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 600,
                              lineHeight: 1,
                              mt: 0.25,
                              color: theme.palette.primary.main,
                            }}
                          >
                            {emissionValue.toLocaleString("de-CH", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })} <Typography component="span" variant="caption" color="text.secondary">{getEmissionUnit()}</Typography>
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    
                    {/* Slider for adjustable density */}
                    {hasDensityRange && (
                      <Box sx={{ mb: 0.5 }}>
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          gap: 1,
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              fontSize: '0.65rem',
                              color: theme.palette.text.secondary,
                              minWidth: 20,
                              textAlign: 'right',
                            }}
                          >
                            {matchedKbobMaterial.densityRange!.min}
                          </Typography>
                          
                          <Box sx={{ flex: 1 }}>
                            <Slider
                              value={currentDensity}
                              onChange={(_, value) => {
                                if (handleDensityUpdate && typeof value === 'number') {
                                  handleDensityUpdate(material.id, value);
                                }
                              }}
                              min={matchedKbobMaterial.densityRange!.min}
                              max={matchedKbobMaterial.densityRange!.max}
                              step={1}
                              valueLabelDisplay="auto"
                              size="small"
                              sx={{
                                py: 0,
                                '& .MuiSlider-thumb': {
                                  backgroundColor: theme.palette.common.white,
                                  border: `2px solid ${theme.palette.primary.main}`,
                                  width: 16,
                                  height: 16,
                                  '&:hover': {
                                    boxShadow: 'none',
                                  },
                                },
                                '& .MuiSlider-track': {
                                  backgroundColor: theme.palette.primary.main,
                                  border: 'none',
                                  height: 4,
                                },
                                '& .MuiSlider-rail': {
                                  backgroundColor: theme.palette.grey[300],
                                  height: 4,
                                },
                                '& .MuiSlider-valueLabel': {
                                  backgroundColor: theme.palette.grey[700],
                                  fontSize: 11,
                                },
                              }}
                            />
                          </Box>
                          
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              fontSize: '0.65rem',
                              color: theme.palette.text.secondary,
                              minWidth: 20,
                              textAlign: 'left',
                            }}
                          >
                            {matchedKbobMaterial.densityRange!.max}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    
                    {/* Environmental Impact Scale */}
                    {emissionValue !== null && material.volume > 0 && (
                      <Box sx={{ 
                        mt: hasDensityRange ? 1.5 : 2,
                        pt: hasDensityRange ? 1.5 : 2,
                        borderTop: `1px solid ${theme.palette.grey[200]}`,
                      }}>
                        {/* Scale Header */}
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          mb: 1.5,
                        }}>
                          <Box>
                            <Typography 
                              variant="overline" 
                              sx={{ 
                                fontSize: '0.65rem',
                                color: theme.palette.text.secondary,
                                letterSpacing: '0.05em',
                                display: 'block',
                                lineHeight: 1,
                              }}
                            >
                              Umweltbelastung
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontSize: '0.75rem',
                                color: theme.palette.text.primary,
                                fontWeight: 600,
                                mt: 0.25,
                              }}
                            >
                              {((emissionValue / material.volume)).toFixed(0)} {getEmissionUnit()}/m³
                            </Typography>
                          </Box>
                          
                          {/* Benchmark indicator */}
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              fontSize: '0.65rem',
                              color: (() => {
                                const ratio = (emissionValue / material.volume) / 1000;
                                if (ratio < 0.3) return theme.palette.success.main;
                                if (ratio < 0.6) return theme.palette.warning.main;
                                return theme.palette.error.main;
                              })(),
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {(() => {
                              const ratio = (emissionValue / material.volume) / 1000;
                              if (ratio < 0.3) return 'Niedrig';
                              if (ratio < 0.6) return 'Mittel';
                              return 'Hoch';
                            })()}
                          </Typography>
                        </Box>
                        
                        {/* Scale Visualization */}
                        <Box sx={{ position: 'relative' }}>
                          {/* Background segments */}
                          <Box sx={{ 
                            display: 'flex',
                            height: 8,
                            borderRadius: 1,
                            overflow: 'hidden',
                            bgcolor: theme.palette.grey[100],
                          }}>
                            <Box sx={{ 
                              width: '33.33%',
                              bgcolor: alpha(theme.palette.success.main, 0.2),
                              borderRight: `1px solid ${theme.palette.background.paper}`,
                            }} />
                            <Box sx={{ 
                              width: '33.33%',
                              bgcolor: alpha(theme.palette.warning.main, 0.2),
                              borderRight: `1px solid ${theme.palette.background.paper}`,
                            }} />
                            <Box sx={{ 
                              width: '33.34%',
                              bgcolor: alpha(theme.palette.error.main, 0.2),
                            }} />
                          </Box>
                          
                          {/* Value indicator */}
                          <Box sx={{
                            position: 'absolute',
                            top: -4,
                            left: `${Math.min(((emissionValue / material.volume) / 1000) * 100, 98)}%`,
                            transform: 'translateX(-50%)',
                            transition: 'left 0.3s ease',
                          }}>
                            <Box sx={{
                              width: 16,
                              height: 16,
                              bgcolor: theme.palette.background.paper,
                              border: `2px solid ${(() => {
                                const ratio = (emissionValue / material.volume) / 1000;
                                if (ratio < 0.3) return theme.palette.success.main;
                                if (ratio < 0.6) return theme.palette.warning.main;
                                return theme.palette.error.main;
                              })()}`,
                              borderRadius: '50%',
                              boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.1)}`,
                            }} />
                          </Box>
                        </Box>
                        
                        {/* Scale labels with values */}
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          mt: 1,
                          px: 0.5,
                        }}>
                          <Box sx={{ textAlign: 'center', flex: 1 }}>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontSize: '0.6rem',
                                color: theme.palette.text.disabled,
                                display: 'block',
                                lineHeight: 1,
                              }}
                            >
                              0-300
                            </Typography>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontSize: '0.65rem',
                                color: theme.palette.success.main,
                                fontWeight: 500,
                              }}
                            >
                              Niedrig
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'center', flex: 1 }}>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontSize: '0.6rem',
                                color: theme.palette.text.disabled,
                                display: 'block',
                                lineHeight: 1,
                              }}
                            >
                              300-600
                            </Typography>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontSize: '0.65rem',
                                color: theme.palette.warning.main,
                                fontWeight: 500,
                              }}
                            >
                              Mittel
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'center', flex: 1 }}>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontSize: '0.6rem',
                                color: theme.palette.text.disabled,
                                display: 'block',
                                lineHeight: 1,
                              }}
                            >
                              600+
                            </Typography>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontSize: '0.65rem',
                                color: theme.palette.error.main,
                                fontWeight: 500,
                              }}
                            >
                              Hoch
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}

              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default ModelledMaterialList;

import React from "react";
import {
  Grid,
  Paper,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Chip,
} from "@mui/material";
import { KbobMaterial, Material } from "../../types/lca.types";
import { ebkpData } from "../../data/ebkpData";

interface MaterialListProps {
  unmodelledMaterials: Material[];
  kbobMaterials: KbobMaterial[];
  handleRemoveUnmodelledMaterial: (index: number) => void;
  handleEditMaterial: (material: Material) => void;
}

const MaterialList: React.FC<MaterialListProps> = ({
  unmodelledMaterials,
  kbobMaterials,
  handleRemoveUnmodelledMaterial,
  handleEditMaterial,
}) => {
  return (
    <Grid container spacing={{ xs: 1, sm: 2 }}>
      {unmodelledMaterials.map((material, index) => (
        <Grid item xs={12} sm={6} md={6} lg={4} xl={4} key={material.id}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 3 },
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              "&:hover": {
                boxShadow: (theme) => theme.shadows[4],
                borderColor: "transparent",
              },
              transition: "all 0.3s ease",
              maxWidth: "1200px",
              width: "100%",
              mx: "auto",
            }}
          >
            {/* Header with Actions */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              {/* Material Name */}
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  color: "text.primary",
                  fontSize: { xs: "1rem", sm: "1.25rem" },
                }}
              >
                {material.name}
              </Typography>

              {/* Action Buttons */}
              <Box sx={{ display: "flex", gap: 1 }}>
                <Tooltip title="Bearbeiten">
                  <IconButton
                    onClick={() => handleEditMaterial(material)}
                    size="small"
                    sx={{
                      color: "primary.main",
                      "&:hover": {
                        backgroundColor: "primary.lighter",
                      },
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </IconButton>
                </Tooltip>
                <Tooltip title="Löschen">
                  <IconButton
                    onClick={() => handleRemoveUnmodelledMaterial(index)}
                    size="small"
                    sx={{
                      color: "error.main",
                      "&:hover": {
                        backgroundColor: "error.lighter",
                      },
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1 }}>
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
                    ? material.volume.toFixed(2)
                    : "0.00"}{" "}
                  m³
                </Typography>
              </Box>

              {/* Tags Section */}
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {/* EBKP Tag */}
                {material.ebkp && (
                  <Chip
                    label={`${material.ebkp} - ${
                      ebkpData.find((e) => e.code === material.ebkp)
                        ?.bezeichnung || ""
                    }`}
                    size="small"
                    sx={{
                      bgcolor: "info.lighter",
                      color: "info.dark",
                      fontWeight: 500,
                      "& .MuiChip-label": {
                        px: 1,
                      },
                    }}
                  />
                )}
                {/* KBOB Material Tag */}
                {material.kbobId && (
                  <Chip
                    label={
                      kbobMaterials.find((k) => k.id === material.kbobId)
                        ?.nameDE || ""
                    }
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
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};

export default MaterialList;

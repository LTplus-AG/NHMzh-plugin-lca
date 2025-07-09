import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Typography,
} from "@mui/material";
import { KbobMaterial, Material } from "../../types/lca.types";

interface BulkMatchDialogProps {
  open: boolean;
  suggestedMatches: Record<string, KbobMaterial[]>;
  modelledMaterials: Material[];
  onClose: () => void;
  onApply: () => void;
  onRejectMatch: (materialId: string) => void;
}

export default function BulkMatchDialog({
  open,
  suggestedMatches,
  modelledMaterials,
  onClose,
  onApply,
  onRejectMatch,
}: BulkMatchDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
                              onClick={() => onRejectMatch(materialId)}
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
          onClick={onClose}
          variant="outlined"
          color="inherit"
        >
          Abbrechen
        </Button>
        <Button
          onClick={onApply}
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
} 
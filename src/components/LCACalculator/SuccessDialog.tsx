import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

interface SuccessDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SuccessDialog({ open, onClose }: SuccessDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
          onClick={onClose}
          variant="contained"
          color="primary"
        >
          Schliessen
        </Button>
      </DialogActions>
    </Dialog>
  );
} 
import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  FormLabel,
} from "@mui/material";
import Select from "react-select";
import { StylesConfig } from "react-select";
import {
  UnmodelledMaterial,
  KbobMaterial
} from "../../types/lca.types";
import {
  MaterialOption,
  MaterialOptionGroup
} from "../../types/calculator.types";

interface EditMaterialDialogProps {
  open: boolean;
  material: UnmodelledMaterial | null;
  onClose: () => void;
  onSave: (material: UnmodelledMaterial) => void;
  selectStyles: StylesConfig;
  kbobMaterials: KbobMaterial[];
  kbobMaterialOptions: MaterialOption[] | MaterialOptionGroup[];
}

const EditMaterialDialog: React.FC<EditMaterialDialogProps> = ({
  open,
  material,
  onClose,
  onSave,
  selectStyles,
  kbobMaterials,
  kbobMaterialOptions,
}) => {
  const [editedMaterial, setEditedMaterial] = useState<UnmodelledMaterial>({
    id: "",
    name: "",
    volume: "",
    ebkp: "",
    kbobId: "",
  });

  // Update edited material when the input material changes
  React.useEffect(() => {
    if (material) {
      setEditedMaterial({
        ...material,
      });
    }
  }, [material]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "volume") {
      // Convert volume to number
      const numValue = parseFloat(value);
      if (!isNaN(numValue) || value === "") {
        setEditedMaterial({
          ...editedMaterial,
          [name]: value === "" ? "" : numValue,
        });
      }
    } else {
      setEditedMaterial({
        ...editedMaterial,
        [name]: value,
      });
    }
  };

  const handleSave = () => {
    // Validate required fields
    if (!editedMaterial.name || editedMaterial.volume === "") {
      return;
    }

    onSave(editedMaterial);
  };

  const handleMaterialSelect = (option: MaterialOption | null) => {
    setEditedMaterial({
      ...editedMaterial,
      kbobId: option?.value || "",
    });
  };

  if (!material) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Material bearbeiten</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, pb: 1 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <FormLabel htmlFor="name">Material Name</FormLabel>
            <TextField
              id="name"
              name="name"
              value={editedMaterial.name}
              onChange={handleChange}
              fullWidth
              margin="dense"
              variant="outlined"
            />
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <FormLabel htmlFor="volume">Volumen (m³)</FormLabel>
            <TextField
              id="volume"
              name="volume"
              value={editedMaterial.volume.toString()}
              onChange={handleChange}
              fullWidth
              margin="dense"
              variant="outlined"
              type="number"
              inputProps={{ step: 0.1, min: 0 }}
            />
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <FormLabel htmlFor="ebkp">EBKP Code</FormLabel>
            <TextField
              id="ebkp"
              name="ebkp"
              value={editedMaterial.ebkp}
              onChange={handleChange}
              fullWidth
              margin="dense"
              variant="outlined"
            />
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <FormLabel htmlFor="kbob-select">KBOB-Material</FormLabel>
            <Select
              id="kbob-select"
              options={kbobMaterialOptions}
              styles={selectStyles}
              value={
                editedMaterial.kbobId
                  ? {
                      value: editedMaterial.kbobId,
                      label:
                        kbobMaterials.find(
                          (m) => m.id === editedMaterial.kbobId
                        )?.nameDE || editedMaterial.kbobId,
                    }
                  : null
              }
              onChange={(option) => handleMaterialSelect(option as MaterialOption | null)}
              placeholder="KBOB-Material auswählen..."
              isClearable
            />
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Abbrechen
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditMaterialDialog;

import React from "react";
import { Box, Tooltip, styled } from "@mui/material";
import PublicIcon from "@mui/icons-material/Public"; // Icon for total mode
import SquareFootIcon from "@mui/icons-material/SquareFoot"; // Icon for relative mode
import { DisplayMode } from "../../utils/lcaDisplayHelper"; // Import shared DisplayMode type

interface DisplayModeToggleProps {
  mode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
  isEbfValid: boolean; // Prop to know if EBF is valid
}

// Styled components (similar to YearToggle)
const ToggleContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 20,
  padding: 2,
  width: "fit-content",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  transition: "box-shadow 0.2s ease-in-out",
  "&:hover": {
    boxShadow: "0 2px 5px rgba(0,0,0,0.12)",
  },
}));

const ToggleButton = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active: boolean }>(({ theme, active }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 16,
  padding: "4px 8px",
  cursor: "pointer",
  transition: "all 0.2s",
  backgroundColor: active ? theme.palette.primary.main : "transparent",
  color: active
    ? theme.palette.primary.contrastText
    : theme.palette.text.secondary,
  "&:hover": {
    backgroundColor: active
      ? theme.palette.primary.main
      : theme.palette.action.hover,
  },
  // Style for disabled state
  "&[aria-disabled='true']": {
    cursor: "not-allowed",
    opacity: 0.5,
    backgroundColor: "transparent",
    color: theme.palette.text.disabled,
    "&:hover": {
      backgroundColor: "transparent", // No hover effect when disabled
    },
  },
}));

const DisplayModeToggle: React.FC<DisplayModeToggleProps> = ({
  mode,
  onChange,
  isEbfValid,
}) => {
  return (
    <ToggleContainer>
      {/* Total Mode Button */}
      <Tooltip title="Gesamte Ökobilanz anzeigen" arrow placement="top">
        <ToggleButton
          active={mode === "total"}
          onClick={() => onChange("total")}
          sx={{ mr: 0.5 }} // Add margin between buttons
        >
          <PublicIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>

      {/* Relative Mode Button */}
      <Tooltip
        title={
          isEbfValid
            ? `Ökobilanz pro m² EBF pro Jahr anzeigen (gem. Methodik SIA 2032, Amortisationszeit nach eBKP und Anhang C)`
            : "Bitte gültigen EBF-Wert eingeben, um relative Ansicht zu aktivieren"
        }
        arrow
        placement="top"
      >
        {/* Wrap disabled button in span for tooltip to work */}
        <span
          style={{
            display: "inline-block",
            cursor: !isEbfValid ? "not-allowed" : "pointer",
          }}
        >
          <ToggleButton
            active={mode === "relative"}
            onClick={() => isEbfValid && onChange("relative")}
            aria-disabled={!isEbfValid} // Accessibility attribute
            sx={{
              // Apply disabled styles directly if needed
              pointerEvents: !isEbfValid ? "none" : "auto", // Ensure click doesn't pass through span
            }}
          >
            <SquareFootIcon fontSize="small" />
          </ToggleButton>
        </span>
      </Tooltip>
    </ToggleContainer>
  );
};

export default DisplayModeToggle;

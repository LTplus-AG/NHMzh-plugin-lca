import React from "react";
import { Box, Tooltip, Typography, CircularProgress } from "@mui/material";
import logger from '../../utils/logger';

interface ProjectMetadata {
  filename: string;
  upload_timestamp: string;
  element_count?: number;
}

interface ProjectMetadataDisplayProps {
  metadata: ProjectMetadata | null;
  loading: boolean;
  initialLoading: boolean; // Added to prevent showing 'No metadata' during initial load
  selectedProject: boolean; // Added to know if a project is selected
}

const ProjectMetadataDisplay: React.FC<ProjectMetadataDisplayProps> = ({
  metadata,
  loading,
  initialLoading,
  selectedProject,
}) => {
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mt: 1,
          height: "20px",
        }}
      >
        <CircularProgress
          size={16}
          thickness={5}
          sx={{ color: "text.secondary" }}
        />
        <Typography variant="caption" color="text.secondary">
          Lade Metadaten...
        </Typography>
      </Box>
    );
  }

  if (!selectedProject || initialLoading) {
    // Don't show anything if no project is selected yet or during initial data fetch
    return <Box sx={{ height: "20px", mt: 1 }} />; // Keep space consistent
  }

  if (!metadata) {
    return (
      <Box sx={{ mt: 1, height: "20px" }}>
        <Typography variant="body2" color="text.secondary">
          Keine Metadaten verfügbar.
        </Typography>
      </Box>
    );
  }

  const formatTime = (timestamp: string | Date | undefined): string => {
    if (!timestamp) {
      logger.warn(
        "LCA formatTime: No timestamp provided, returning default value."
      );
      return "N/A";
    }

    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        logger.warn(
          `LCA formatTime: Invalid timestamp '${timestamp}', returning default value.`
        );
        return "N/A";
      }

      const timeStr = date.toLocaleTimeString("de-CH", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return timeStr;
    } catch (e) {
      logger.error(`LCA formatTime: Error for timestamp '${timestamp}':`, e);
      return "N/A";
    }
  };

  const formatFullTimestamp = (
    timestamp: string | Date | undefined
  ): string => {
    if (!timestamp) {
      logger.warn(
        "LCA fullTs: No timestamp provided, returning default value."
      );
      return "N/A";
    }

    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        logger.warn(
          `LCA fullTs: Invalid timestamp '${timestamp}', returning default value.`
        );
        return "N/A";
      }

      const dateStr = date.toLocaleDateString("de-CH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString("de-CH", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${dateStr} ${timeStr}`;
    } catch (e) {
      logger.error(`LCA fullTs: Error for timestamp '${timestamp}':`, e);
      return "N/A";
    }
  };

  const formattedTimestamp = metadata.upload_timestamp
    ? formatFullTimestamp(metadata.upload_timestamp)
    : "N/A";

  const timeString = formatTime(metadata.upload_timestamp);

  const tooltipTitle = `Datei: ${metadata.filename} | Elemente: ${
    metadata.element_count ?? "N/A"
  } | Hochgeladen: ${formattedTimestamp}`;

  return (
    <Box
      sx={{
        mt: 1,
        display: "flex",
        alignItems: "center",
        gap: 1,
        minWidth: 0,
        height: "20px",
      }}
    >
      <Tooltip title={tooltipTitle}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            fontStyle: "italic",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%", // Ensure it doesn't overflow container
          }}
        >
          {metadata.filename} ({metadata.element_count ?? "-"} Elemente)
          {timeString !== "N/A" &&
          timeString !== "Invalid Time" &&
          timeString !== "Invalid Date"
            ? ` - Stand: ${timeString}`
            : ""}
        </Typography>
      </Tooltip>
    </Box>
  );
};

export default ProjectMetadataDisplay;

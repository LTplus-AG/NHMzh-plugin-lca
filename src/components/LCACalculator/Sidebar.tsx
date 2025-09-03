import {
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  MenuItem,
  Select as MuiSelect,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import Select from "react-select";
import { StylesConfig, CSSObjectWithLabel } from "react-select";
import { ProjectOption } from "../../types/calculator.types";
import { OutputFormats, OutputFormatLabels, Material, KbobMaterial } from "../../types/lca.types";

interface SidebarProps {
  selectedProject: ProjectOption | null;
  projectOptions: ProjectOption[];
  projectsLoading: boolean;
  ebfInput: string;
  outputFormat: OutputFormats;
  modelledMaterials: Material[];
  matches: Record<string, string>;
  kbobMaterials: KbobMaterial[];
  currentImpact: string;
  onProjectChange: (project: ProjectOption | null) => void;
  onEbfChange: (value: string) => void;
  onOutputFormatChange: (format: OutputFormats) => void;
  onBulkMatch: () => void;
  selectStyles: StylesConfig;
}

const Instructions = [
  {
    label: "Daten hochladen",
    description:
      "Laden Sie Ihre IFC-Datei hoch oder bearbeiten Sie Materialien manuell.",
  },
  {
    label: "Materialien zuordnen",
    description:
      "Ordnen Sie die erkannten Materialien den entsprechenden KBOB-Materialien zu.",
  },
  {
    label: "Ökobilanz überprüfen",
    description:
      "Überprüfen Sie die berechnete Ökobilanz und senden Sie die Daten.",
  },
];

export default function Sidebar({
  selectedProject,
  projectOptions,
  projectsLoading,
  ebfInput,
  outputFormat,
  modelledMaterials,
  matches,
  kbobMaterials,
  currentImpact,
  onProjectChange,
  onEbfChange,
  onOutputFormatChange,
  onBulkMatch,
  selectStyles,
}: SidebarProps) {
  const theme = useTheme();

  const outputFormatOptions = Object.entries(OutputFormatLabels).map(([value, label]) => ({
    value,
    label,
  }));

  const progressBar = (
    <Box
      sx={{
        width: `${
          (modelledMaterials.filter((material) => {
            const matchId = matches[material.id];
            return (
              matchId &&
              matchId.trim() !== "" &&
              kbobMaterials.some((m) => m.id === matchId)
            );
          }).length /
            modelledMaterials.length) *
          100
        }%`,
        bgcolor: theme.palette.primary.main,
        borderRadius: "9999px",
        height: "100%",
        transition: "width 0.3s ease",
      }}
    />
  );

  const calculationButton = (
    <Box sx={{ mt: 3 }}>
      {modelledMaterials.filter((material) => {
        const matchId = matches[material.id];
        return (
          matchId &&
          matchId.trim() !== "" &&
          kbobMaterials.some((m) => m.id === matchId)
        );
      }).length === 0 ? (
        <>
          <Box sx={{ mb: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Keine Materialien zugeordnet
            </Typography>
          </Box>
        </>
      ) : null}
      <Box sx={{ display: "flex", justifyContent: "center", mt: 2, mb: 2 }}>
        <Button
          onClick={onBulkMatch}
          variant="outlined"
          color="secondary"
          startIcon={
            <Box component="span" sx={{ fontSize: "1.1em" }}>
              ✨
            </Box>
          }
          sx={{
            textTransform: "none",
            fontWeight: 400,
            borderColor: "rgba(0, 0, 0, 0.23)",
            color: "text.secondary",
            "&:hover": {
              borderColor: "rgba(0, 0, 0, 0.5)",
              backgroundColor: "rgba(0, 0, 0, 0.04)",
            },
          }}
        >
          Automatische Zuordnung für alle Materialien
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        width: { xs: "100%", md: "25%" },
        minWidth: { md: "350px" },
        maxWidth: { xs: "100%", md: "400px" },
        minHeight: { xs: "250px", md: 0 },
        maxHeight: { xs: "40vh", md: "100%" },
        height: { xs: "auto", md: "100%" },
        overflow: "auto",
        bgcolor: "grey.100",
        color: "primary.main",
        display: "flex",
        flexDirection: "column",
        borderBottom: { xs: 1, md: 0 },
        borderRight: 0,
        borderColor: "grey.200",
      }}
    >
      <div className="flex flex-col flex-grow p-8">
        <Typography
          variant="h3"
          color="primary"
          className="text-5xl mb-2"
          sx={{
            fontSize: "2.5rem",
            fontWeight: 300,
            mb: 4,
            mt: 2,
            color: "#0D0599",
          }}
        >
          Ökobilanz
        </Typography>

        <Box sx={{ mb: 2 }}>
          <FormLabel focused htmlFor="select-project">
            Projekt:
          </FormLabel>
          <FormControl variant="outlined" fullWidth focused>
            <MuiSelect
              id="select-project"
              size="small"
              value={selectedProject?.value || ""}
              onChange={(e) => {
                const selectedValue = e.target.value;
                const projectOption = projectOptions.find(
                  (op) => op.value === selectedValue
                );
                onProjectChange(projectOption || null);
              }}
              labelId="select-project"
            >
              {projectsLoading ? (
                <MenuItem disabled>Loading projects...</MenuItem>
              ) : projectOptions.length === 0 ? (
                <MenuItem disabled>No projects available</MenuItem>
              ) : (
                projectOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))
              )}
            </MuiSelect>
          </FormControl>
        </Box>

        {/* Project-dependent content */}
        {selectedProject && (
          <>
            {/* Add EBF Input Field */}
            <Box sx={{ mb: 3 }}>
              <Tooltip title="Energiebezugsfläche des Projekts" arrow>
                <FormControl variant="outlined" fullWidth focused>
                  <FormLabel
                    focused
                    htmlFor="ebf-input"
                    sx={{ mb: 0.5, fontSize: "0.875rem" }}
                  >
                    EBF (m²)
                  </FormLabel>
                  <TextField
                    id="ebf-input"
                    size="small"
                    type="number"
                    value={ebfInput}
                    onChange={(e) => onEbfChange(e.target.value)}
                    InputProps={{
                      inputProps: { min: 0 },
                      sx: { backgroundColor: "white" },
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": {
                          borderColor: theme.palette.divider,
                        },
                        "&:hover fieldset": {
                          borderColor: theme.palette.primary.main,
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: theme.palette.primary.main,
                        },
                      },
                    }}
                  />
                </FormControl>
              </Tooltip>
            </Box>

            {/* Total Result */}
            <Box
              sx={{
                mb: 3,
                mt: 2,
                p: 2,
                background: "linear-gradient(to right top, #F1D900, #fff176)",
                borderRadius: "4px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                minHeight: "80px",
              }}
            >
              <Typography
                variant="h4"
                component="p"
                color="common.black"
                fontWeight="bold"
              >
                {currentImpact}
              </Typography>
            </Box>

            {/* Output Format */}
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontWeight: 600, fontSize: "0.875rem" }}
              >
                Öko-Indikator
              </Typography>
              <Select
                value={outputFormatOptions.find(
                  (opt) => opt.value === outputFormat
                )}
                onChange={(newValue) =>
                  onOutputFormatChange((newValue as { value: string })?.value as OutputFormats)
                }
                options={outputFormatOptions}
                styles={{
                  ...(selectStyles as Record<string, unknown>),
                  control: (base: CSSObjectWithLabel) => ({
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

            {/* Progress */}
            <Box sx={{ pt: 0, mt: 3 }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1.5, fontWeight: 600, fontSize: "0.875rem" }}
              >
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
                      bgcolor: "rgba(0,0,0,0.05)",
                      borderRadius: "9999px",
                      height: "8px",
                      mt: 0.5,
                    }}
                  >
                    {progressBar}
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary">
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
                  von {modelledMaterials.length} zugeordnet
                </Typography>
              </Box>
            </Box>

            {/* Calculation Button */}
            {calculationButton}
          </>
        )}

        {/* Process Steps Section - Always show */}
        <Box
          sx={{
            mt: "auto",
            pt: 3,
          }}
        >
          <Typography
            variant="subtitle1"
            className="font-bold mb-2"
            color="primary"
            sx={{
              fontWeight: 700,
              mb: 1,
              fontSize: "0.875rem",
              color: "#0D0599",
            }}
          >
            Anleitung
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stepper
            orientation="vertical"
            nonLinear
            className="max-w-xs"
            activeStep={-1}
            sx={{
              "& .MuiStepLabel-label": {
                color: "#0D0599",
              },
              "& .MuiStepIcon-root": {
                color: "#0D0599",
              },
            }}
          >
            {Instructions.map((step) => (
              <Step key={step.label} active>
                <StepLabel>
                  <span
                    className="leading-tight font-bold"
                    style={{ color: "#0D0599" }}
                  >
                    {step.label}
                  </span>
                </StepLabel>
                <div className="ml-8 -mt-2">
                  <span
                    className="text-sm leading-none"
                    style={{ color: "#0D0599" }}
                  >
                    {step.description}
                  </span>
                </div>
              </Step>
            ))}
          </Stepper>
        </Box>
      </div>
    </Box>
  );
} 
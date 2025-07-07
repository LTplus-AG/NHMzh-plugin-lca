import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Tooltip,
  TextField,
  Box,
  TableSortLabel,
  Autocomplete,
  TablePagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  OutputFormats,
  MaterialImpact,
  LcaElement,
} from "../../types/lca.types";
import { DisplayMode } from "../../utils/lcaDisplayHelper";
import { DEFAULT_AMORTIZATION_YEARS } from "../../utils/constants";

interface ElementImpactTableProps {
  elements: LcaElement[];
  outputFormat: OutputFormats;
  displayMode: DisplayMode;
  ebfNumeric: number | null;
  matches: Record<string, string>;
}

// --- Helper Functions ---
const formatNumber = (
  num: number | null | undefined,
  decimals: number = 3
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
  displayMode: DisplayMode,
  ebfNumeric: number | null,
  amortizationYears: number
): number | undefined => {
  if (value === undefined) return undefined;
  if (displayMode === "relative" && ebfNumeric !== null && ebfNumeric > 0) {
    return value / (amortizationYears * ebfNumeric);
  }
  return value;
};

const getDecimalPrecision = (
  value: number | undefined,
  displayMode: DisplayMode
): number => {
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
  displayMode: DisplayMode,
  ebfNumeric: number | null,
  amortizationYears: number
): string => {
  const displayValue = getDisplayValue(
    value,
    displayMode,
    ebfNumeric,
    amortizationYears
  );
  if (displayValue === undefined) return "N/A";
  // Always use 3 decimal places
  return formatNumber(displayValue, 3);
};

const getUnitForOutputFormat = (
  outputFormat: OutputFormats,
  displayMode: DisplayMode
): string => {
  let baseUnit = "";
  switch (outputFormat) {
    case OutputFormats.GWP:
      baseUnit = "kg CO₂-eq";
      break;
    case OutputFormats.UBP:
      baseUnit = "UBP";
      break;
    case OutputFormats.PENR:
      baseUnit = "MJ";
      break;
    default:
      baseUnit = "";
  }
  if (displayMode === "relative") {
    return `${baseUnit}/m²·a`;
  }
  return baseUnit;
};

const getOutputFormatLabel = (outputFormat: OutputFormats): string => {
  switch (outputFormat) {
    case OutputFormats.GWP:
      return "GWP";
    case OutputFormats.UBP:
      return "UBP";
    case OutputFormats.PENR:
      return "PENR";
    default:
      return "Impact";
  }
};

// Type for sorting configuration
type SortableKeys =
  | "ifc_class"
  | "typeName"
  | "materials"
  | "quantity"
  | "ebkp"
  | "impact"
  | "groupKey"
  | "elementCount"
  | "amortization";
interface SortConfig {
  key: SortableKeys;
  direction: "asc" | "desc";
}

// Type for Grouping
type GroupingMode = "none" | "ifcClass" | "typeName";

// Interface for Grouped Rows
interface GroupedRow {
  groupKey: string;
  elementCount: number;
  totalQuantity: number;
  totalImpact: {
    gwp: number;
    ubp: number;
    penr: number;
  };
  elementsInGroup: LcaElement[];
}

// --- Component ---
const ElementImpactTable: React.FC<ElementImpactTableProps> = ({
  elements,
  outputFormat,
  displayMode,
  ebfNumeric,
  matches,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [selectedValue, setSelectedValue] = useState<LcaElement | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [groupBy, setGroupBy] = useState<GroupingMode>("none");

  const impactUnit = getUnitForOutputFormat(outputFormat, displayMode);
  const impactLabel = getOutputFormatLabel(outputFormat);
  const impactKey = outputFormat.toLowerCase() as keyof MaterialImpact;

  // Memoized filtering, grouping, and sorting
  const processedData = useMemo(() => {
    // 1. Filter based on matched materials first
    let filteredElements = elements.filter((element) =>
      element.materials.every(
        (material) => matches[material.id] && matches[material.id].trim() !== ""
      )
    );

    // 2. Filter by Autocomplete value or input text
    if (selectedValue) {
      filteredElements = filteredElements.filter(
        (el) => el.id === selectedValue.id
      );
    } else if (inputValue) {
      const lowerSearchTerm = inputValue.toLowerCase();
      filteredElements = filteredElements.filter((element) => {
        const materialsString = element.materials
          .map((m) => m.name)
          .join(",")
          .toLowerCase();
        const ebkpCode = element.properties?.ebkp_code?.toLowerCase() || "";
        const ebkpName = element.properties?.ebkp_name?.toLowerCase() || "";
        const ifcClass = element.element_type.toLowerCase();
        const typeName = element.type_name?.toLowerCase() || "";

        return (
          ifcClass.includes(lowerSearchTerm) ||
          (typeName && typeName.includes(lowerSearchTerm)) ||
          materialsString.includes(lowerSearchTerm) ||
          ebkpCode.includes(lowerSearchTerm) ||
          ebkpName.includes(lowerSearchTerm)
        );
      });
    }

    // 3. Apply Sorting to individual elements if *not* grouping
    if (groupBy === "none" && sortConfig !== null) {
      filteredElements.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case "ifc_class":
            aValue = a.element_type || "";
            bValue = b.element_type || "";
            break;
          case "typeName":
            aValue = a.type_name || "";
            bValue = b.type_name || "";
            break;
          case "materials":
            aValue = a.materials.map((m) => m.name).join(",") || "";
            bValue = b.materials.map((m) => m.name).join(",") || "";
            break;
          case "quantity":
            aValue = a.quantity ?? 0;
            bValue = b.quantity ?? 0;
            break;
          case "ebkp":
            aValue = a.properties?.ebkp_code || "";
            bValue = b.properties?.ebkp_code || "";
            break;
          case "impact":
            aValue =
              getDisplayValue(
                a.impact?.[impactKey],
                displayMode,
                ebfNumeric,
                a.amortization_years ?? DEFAULT_AMORTIZATION_YEARS
              ) ?? -Infinity;
            bValue =
              getDisplayValue(
                b.impact?.[impactKey],
                displayMode,
                ebfNumeric,
                b.amortization_years ?? DEFAULT_AMORTIZATION_YEARS
              ) ?? -Infinity;
            break;
          case "amortization":
            aValue = a.amortization_years ?? DEFAULT_AMORTIZATION_YEARS;
            bValue = b.amortization_years ?? DEFAULT_AMORTIZATION_YEARS;
            break;
          default:
            return 0;
        }

        if (typeof aValue === "string" && typeof bValue === "string") {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        } else if (aValue === null || aValue === undefined) {
          aValue = -Infinity;
        } else if (bValue === null || bValue === undefined) {
          bValue = -Infinity;
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
      return filteredElements;
    }

    // 4. Perform Grouping and Aggregation if grouping is enabled
    if (groupBy !== "none") {
      const groups = new Map<string, GroupedRow>();
      filteredElements.forEach((element) => {
        let key: string;
        if (groupBy === "ifcClass") {
          key = element.element_type;
        } else {
          key = element.type_name || element.element_type;
        }

        if (!groups.has(key)) {
          groups.set(key, {
            groupKey: key,
            elementCount: 0,
            totalQuantity: 0,
            totalImpact: { gwp: 0, ubp: 0, penr: 0 },
            elementsInGroup: [],
          });
        }

        const group = groups.get(key)!;
        group.elementCount += 1;
        group.totalQuantity += element.quantity ?? 0;
        group.totalImpact.gwp += element.impact?.gwp ?? 0;
        group.totalImpact.ubp += element.impact?.ubp ?? 0;
        group.totalImpact.penr += element.impact?.penr ?? 0;
        group.elementsInGroup.push(element);
      });

      let groupedArray = Array.from(groups.values());

      // 5. Apply Sorting to Grouped Data
      if (sortConfig !== null) {
        groupedArray.sort((a, b) => {
          let aValue: any;
          let bValue: any;

          switch (sortConfig.key) {
            case "groupKey":
              aValue = a.groupKey || "";
              bValue = b.groupKey || "";
              break;
            case "ifc_class":
              aValue = a.groupKey || "";
              bValue = b.groupKey || "";
              break;
            case "typeName":
              aValue = a.groupKey || "";
              bValue = b.groupKey || "";
              break;
            case "elementCount":
              aValue = a.elementCount ?? 0;
              bValue = b.elementCount ?? 0;
              break;
            case "quantity":
              aValue = a.totalQuantity ?? 0;
              bValue = b.totalQuantity ?? 0;
              break;
            case "impact":
              const impactKeyGroup =
                outputFormat.toLowerCase() as keyof MaterialImpact;
              aValue =
                getDisplayValue(
                  a.totalImpact?.[impactKeyGroup],
                  displayMode,
                  ebfNumeric,
                  DEFAULT_AMORTIZATION_YEARS
                ) ?? -Infinity;
              bValue =
                getDisplayValue(
                  b.totalImpact?.[impactKeyGroup],
                  displayMode,
                  ebfNumeric,
                  DEFAULT_AMORTIZATION_YEARS
                ) ?? -Infinity;
              break;
            case "ebkp":
              aValue = a.groupKey || "";
              bValue = b.groupKey || "";
              break;
                          case "amortization":
                // For grouped rows, amortization doesn't make sense as different elements might have different years
                aValue = 0;
                bValue = 0;
                break;
            default:
              return 0;
          }

          if (typeof aValue === "string" && typeof bValue === "string") {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
          } else if (aValue === null || aValue === undefined) {
            aValue = -Infinity;
          } else if (bValue === null || bValue === undefined) {
            bValue = -Infinity;
          }

          if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        });
      }
      return groupedArray;
    }

    return filteredElements;
  }, [
    elements,
    matches,
    inputValue,
    selectedValue,
    sortConfig,
    groupBy,
    outputFormat,
    displayMode,
    ebfNumeric,
    impactKey,
  ]);

  // Calculate items for the current page
  const displayData = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return processedData.slice(startIndex, startIndex + rowsPerPage);
  }, [processedData, page, rowsPerPage]);

  const handleSortRequest = (key: SortableKeys) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    let effectiveKey = key;
    if (groupBy !== "none") {
      if (key === "ifc_class") effectiveKey = "groupKey";
      if (key === "materials") effectiveKey = "elementCount";
      if (key === "ebkp") effectiveKey = "groupKey";
    }
    setSortConfig({ key: effectiveKey, direction });
  };

  // Function to get label for Autocomplete options
  const getOptionLabelText = (option: LcaElement): string => {
    const typeNamePart = option.type_name ? ` / ${option.type_name}` : "";
    const ebkp = option.properties?.ebkp_code
      ? ` (${option.properties.ebkp_code})`
      : "";
    return `${option.element_type}${typeNamePart}${ebkp}`;
  };

  // Handlers for pagination changes
  const handleChangePage = (
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handler for Grouping Change
  const handleGroupByChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    setGroupBy(event.target.value as GroupingMode);
    setPage(0);
    setSortConfig(null);
  };

  const isGrouped = groupBy !== "none";

  return (
    <Box>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: "300px", flexGrow: 1, maxWidth: "500px" }}>
          <Autocomplete
            id="element-impact-search"
            options={elements}
            getOptionLabel={getOptionLabelText}
            value={selectedValue}
            onChange={(_, newValue) => {
              setSelectedValue(newValue);
              setGroupBy("none");
            }}
            inputValue={inputValue}
            onInputChange={(_, newInputValue, reason) => {
              if (reason === "input") {
                setInputValue(newInputValue);
              }
              if (newInputValue === "" && reason !== "reset") {
                setSelectedValue(null);
              }
            }}
            filterOptions={(options, state) => {
              if (state.inputValue === "") return options.slice(0, 10);

              const lowerSearchTerm = state.inputValue.toLowerCase();
              return options
                .filter((option) => {
                  const materialsString = option.materials
                    .map((m) => m.name)
                    .join(",")
                    .toLowerCase();
                  const ebkpCode =
                    option.properties?.ebkp_code?.toLowerCase() || "";
                  const ebkpName =
                    option.properties?.ebkp_name?.toLowerCase() || "";
                  const ifcClass = option.element_type.toLowerCase();
                  const typeName = option.type_name?.toLowerCase() || "";
                  return (
                    ifcClass.includes(lowerSearchTerm) ||
                    (typeName && typeName.includes(lowerSearchTerm)) ||
                    materialsString.includes(lowerSearchTerm) ||
                    ebkpCode.includes(lowerSearchTerm) ||
                    ebkpName.includes(lowerSearchTerm)
                  );
                })
                .slice(0, 50);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                size="small"
                placeholder="Elemente filtern oder auswählen..."
              />
            )}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props as any;
              return (
                <li key={option.id} {...otherProps}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      width: "100%",
                    }}
                  >
                    <Typography variant="body2" fontWeight={500}>
                      {getOptionLabelText(option)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.materials.map((m) => m.name).join(", ")}
                    </Typography>
                  </Box>
                </li>
              );
            }}
            noOptionsText="Keine passenden Elemente gefunden"
            isOptionEqualToValue={(option, value) => option.id === value.id}
            sx={{ width: "100%" }}
          />
        </Box>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="group-by-label">Gruppieren nach</InputLabel>
          <Select
            labelId="group-by-label"
            id="group-by-select"
            value={groupBy}
            label="Gruppieren nach"
            onChange={handleGroupByChange as any}
          >
            <MenuItem value="none">Keine Gruppierung</MenuItem>
            <MenuItem value="ifcClass">IFC Klasse</MenuItem>
            <MenuItem value="typeName">Typ Name</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "medium" }}>
                <TableSortLabel
                  active={
                    sortConfig?.key === (isGrouped ? "groupKey" : "ifc_class")
                  }
                  direction={
                    sortConfig?.key === (isGrouped ? "groupKey" : "ifc_class")
                      ? sortConfig.direction
                      : "asc"
                  }
                  onClick={() =>
                    handleSortRequest(isGrouped ? "groupKey" : "ifc_class")
                  }
                >
                  IFC Klasse
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: "medium" }}>
                <TableSortLabel
                  active={
                    sortConfig?.key === (isGrouped ? "groupKey" : "typeName")
                  }
                  direction={
                    sortConfig?.key === (isGrouped ? "groupKey" : "typeName")
                      ? sortConfig.direction
                      : "asc"
                  }
                  onClick={() =>
                    handleSortRequest(isGrouped ? "groupKey" : "typeName")
                  }
                  disabled={isGrouped && groupBy === "ifcClass"}
                >
                  Typ Name
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: "medium" }}>
                <TableSortLabel
                  active={
                    sortConfig?.key ===
                    (isGrouped ? "elementCount" : "materials")
                  }
                  direction={
                    sortConfig?.key ===
                    (isGrouped ? "elementCount" : "materials")
                      ? sortConfig.direction
                      : "asc"
                  }
                  onClick={() =>
                    handleSortRequest(isGrouped ? "elementCount" : "materials")
                  }
                >
                  {isGrouped ? "Anzahl Elemente" : "Materialien"}
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: "medium" }}>
                <TableSortLabel
                  active={sortConfig?.key === "quantity"}
                  direction={
                    sortConfig?.key === "quantity"
                      ? sortConfig.direction
                      : "asc"
                  }
                  onClick={() => handleSortRequest("quantity")}
                >
                  Volumen (m³)
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: "medium" }}>
                {isGrouped ? (
                  "EBKP"
                ) : (
                  <TableSortLabel
                    active={sortConfig?.key === "ebkp"}
                    direction={
                      sortConfig?.key === "ebkp" ? sortConfig.direction : "asc"
                    }
                    onClick={() => handleSortRequest("ebkp")}
                  >
                    EBKP
                  </TableSortLabel>
                )}
              </TableCell>
              {displayMode === "relative" && (
                <TableCell align="right" sx={{ fontWeight: "medium" }}>
                  <TableSortLabel
                    active={sortConfig?.key === "amortization"}
                    direction={
                      sortConfig?.key === "amortization" ? sortConfig.direction : "asc"
                    }
                    onClick={() => handleSortRequest("amortization")}
                    disabled={isGrouped}
                  >
                    Amortisationsdauer (Jahre)
                  </TableSortLabel>
                </TableCell>
              )}
              <TableCell align="right" sx={{ fontWeight: "medium" }}>
                <TableSortLabel
                  active={sortConfig?.key === "impact"}
                  direction={
                    sortConfig?.key === "impact" ? sortConfig.direction : "asc"
                  }
                  onClick={() => handleSortRequest("impact")}
                >
                  {impactLabel} ({impactUnit})
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {processedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={displayMode === "relative" ? 7 : 6} align="center">
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ p: 2 }}
                  >
                    {inputValue || selectedValue
                      ? "Keine Elemente entsprechen Ihrer Suche."
                      : "Keine Elemente vorhanden oder alle herausgefiltert."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {displayData.map((item, index) => {
              if (isGrouped) {
                const group = item as GroupedRow;
                const groupImpactValue = group.totalImpact[impactKey];
                const isGroupedByClass = groupBy === "ifcClass";
                const isGroupedByType = groupBy === "typeName";

                return (
                  <TableRow key={group.groupKey + index} hover>
                    <TableCell
                      sx={{
                        maxWidth: 150,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Tooltip
                        title={isGroupedByClass ? group.groupKey : "N/A"}
                        enterDelay={1000}
                      >
                        <span>{isGroupedByClass ? group.groupKey : "N/A"}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 150,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Tooltip
                        title={isGroupedByType ? group.groupKey : "N/A"}
                        enterDelay={1000}
                      >
                        <span>{isGroupedByType ? group.groupKey : "N/A"}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      {formatNumber(group.elementCount, 0)}
                    </TableCell>
                    <TableCell align="right">
                      {formatNumber(group.totalQuantity, 3)}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip
                        title="EBKP nicht relevant für Gruppenansicht"
                        enterDelay={500}
                      >
                        <span>N/A</span>
                      </Tooltip>
                    </TableCell>
                    {displayMode === "relative" && (
                      <TableCell align="right">
                        <Tooltip
                          title="Amortisationsdauer nicht relevant für Gruppenansicht"
                          enterDelay={500}
                        >
                          <span>N/A</span>
                        </Tooltip>
                      </TableCell>
                    )}
                    <TableCell align="right">
                      {formatDisplayValue(
                        groupImpactValue,
                        displayMode,
                        ebfNumeric,
                        DEFAULT_AMORTIZATION_YEARS
                      )}
                    </TableCell>
                  </TableRow>
                );
              } else {
                const element = item as LcaElement;
                const impactValue = element.impact?.[impactKey];
                const materialsString = element.materials
                  .map((m) => m.name)
                  .join(", ");
                const ebkpCode = element.properties?.ebkp_code || "N/A";
                const ebkpName = element.properties?.ebkp_name;
                const ebkpTooltip = ebkpName
                  ? `${ebkpCode} - ${ebkpName}`
                  : ebkpCode;
                const ifcClassDisplay = element.element_type || "N/A";
                const typeNameDisplay = element.type_name || "N/A";

                console.log(
                  `Rendering Element ID: ${element.id}, Type Name:`,
                  element.type_name,
                  "Full Element:",
                  element
                );

                return (
                  <TableRow
                    key={element.id + index}
                    hover
                    selected={selectedValue?.id === element.id}
                  >
                    <TableCell
                      sx={{
                        maxWidth: 150,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Tooltip title={ifcClassDisplay} enterDelay={1000}>
                        <span>{ifcClassDisplay}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 150,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Tooltip title={typeNameDisplay} enterDelay={1000}>
                        <span>{typeNameDisplay}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Tooltip title={materialsString} enterDelay={1000}>
                        <span>{materialsString || "N/A"}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      {formatNumber(element.quantity, 3)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        maxWidth: 100,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Tooltip title={ebkpTooltip} enterDelay={1000}>
                        <span>{ebkpCode}</span>
                      </Tooltip>
                    </TableCell>
                    {displayMode === "relative" && (
                      <TableCell align="right">
                        {formatNumber(element.amortization_years ?? DEFAULT_AMORTIZATION_YEARS, 0)}
                      </TableCell>
                    )}
                    <TableCell align="right">
                      {formatDisplayValue(
                        impactValue,
                        displayMode,
                        ebfNumeric,
                        element.amortization_years ?? DEFAULT_AMORTIZATION_YEARS
                      )}
                    </TableCell>
                  </TableRow>
                );
              }
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={processedData.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50, 100, { label: "Alle", value: -1 }]}
        labelRowsPerPage="Zeilen pro Seite:"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}–${to} von ${count !== -1 ? count : `mehr als ${to}`}`
        }
        sx={{
          border: 1,
          borderColor: "divider",
          borderTop: 0,
          borderBottomLeftRadius: (theme) => theme.shape.borderRadius,
          borderBottomRightRadius: (theme) => theme.shape.borderRadius,
          bgcolor: "background.paper",
        }}
      />
    </Box>
  );
};

export default ElementImpactTable;

import React from 'react';
import { TableRow, TableCell, IconButton, Typography, Box, Tooltip } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { HierarchicalLcaEbkpGroup, OutputFormats } from '../../types/lca.types';
import { DisplayMode } from '../../utils/lcaDisplayHelper';
import { formatNumber, formatDisplayValue, getUnitForOutputFormat } from '../../utils/lcaFormatUtils';
import { isZeroQuantity, getZeroQuantityStyles, getZeroQuantityTooltip } from '../../utils/zeroQuantityHighlight';

interface MainLcaEbkpGroupRowProps {
  group: HierarchicalLcaEbkpGroup;
  isExpanded: boolean;
  onToggle: () => void;
  outputFormat: OutputFormats;
  displayMode: DisplayMode;
  ebfNumeric: number | null;
}



export const MainLcaEbkpGroupRow: React.FC<MainLcaEbkpGroupRowProps> = ({
  group,
  isExpanded,
  onToggle,
  outputFormat,
  displayMode,
  ebfNumeric,
}) => {
  const impactKey = outputFormat.toLowerCase() as keyof typeof group.totalImpact;
  const impactValue = group.totalImpact[impactKey];
  const unit = getUnitForOutputFormat(outputFormat, displayMode);
  
  // Check if main group has zero total quantity
  const hasZeroQuantity = isZeroQuantity(group.totalQuantity);

  return (
    <Tooltip 
      title={hasZeroQuantity ? `${getZeroQuantityTooltip()} - Hauptgruppe ${group.mainGroup}` : ''}
      arrow
      placement="left"
    >
      <TableRow
        sx={getZeroQuantityStyles(hasZeroQuantity, {
          backgroundColor: isExpanded ? 'rgba(25, 118, 210, 0.08)' : 'rgba(0, 0, 0, 0.04)',
          '&:hover': {
            backgroundColor: isExpanded ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.08)',
          },
          cursor: 'pointer',
        })}
        onClick={onToggle}
      >
        <TableCell sx={{ 
          pl: hasZeroQuantity ? 1.5 : 2, // Reduce padding when highlighted to account for border
          py: 2,
          width: '40%' 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              sx={{
                mr: 1,
                p: 0.5,
                transition: 'transform 0.2s ease',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              <ChevronRight />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="subtitle1" fontWeight="bold" color="primary">
                {group.mainGroup === "_OTHER_" ? "" : group.mainGroup}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {group.mainGroup === "_OTHER_" ? "Sonstige Klassifikationen" : group.mainGroupName}
              </Typography>
              <Typography variant="body2" sx={{ 
                color: "text.secondary",
                fontSize: "0.8rem",
                fontWeight: 500,
                ml: 1
              }}>
                {group.subGroups.length} Gruppen • {group.totalElements} Elemente
              </Typography>
            </Box>
          </Box>
        </TableCell>
        <TableCell sx={{ py: 2, width: '15%' }}>
          <Typography variant="body2" fontWeight="medium">
            {group.totalElements} Elemente
          </Typography>
        </TableCell>
        <TableCell align="right" sx={{ py: 2, width: '20%' }}>
          <Typography variant="body2" sx={{ 
            fontWeight: hasZeroQuantity ? 'bold' : 'medium',
            color: hasZeroQuantity ? 'warning.main' : 'inherit'
          }}>
            {formatNumber(group.totalQuantity, 2)} m³
          </Typography>
        </TableCell>
        <TableCell align="right" sx={{ py: 2, width: '25%' }}>
          <Typography variant="body2" fontWeight="medium">
            {formatDisplayValue(impactValue, displayMode, ebfNumeric)} {unit}
          </Typography>
        </TableCell>
      </TableRow>
    </Tooltip>
  );
}; 
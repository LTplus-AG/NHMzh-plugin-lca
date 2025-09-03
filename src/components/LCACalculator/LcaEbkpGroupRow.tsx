import React from 'react';
import { TableRow, TableCell, IconButton, Typography, Box, Tooltip } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { LcaEbkpGroup, LcaElement, OutputFormats } from '../../types/lca.types';
import { DisplayMode } from '../../utils/lcaDisplayHelper';
import { formatNumber, formatDisplayValue, getUnitForOutputFormat } from '../../utils/lcaFormatUtils';
import { isZeroQuantity, getZeroQuantityStyles, getZeroQuantityTooltip } from '../../utils/zeroQuantityHighlight';
import CopyableText from '../ui/CopyableText';

interface LcaEbkpGroupRowProps {
  group: LcaEbkpGroup;
  isExpanded: boolean;
  onToggle: () => void;
  outputFormat: OutputFormats;
  displayMode: DisplayMode;
  ebfNumeric: number | null;
}



const ElementRow: React.FC<{
  element: LcaElement;
  outputFormat: OutputFormats;
  displayMode: DisplayMode;
  ebfNumeric: number | null;
}> = ({ element, outputFormat, displayMode, ebfNumeric }) => {
  const impactKey = outputFormat.toLowerCase() as keyof NonNullable<LcaElement['impact']>;
  const impactValue = element.impact?.[impactKey] || 0;
  const unit = getUnitForOutputFormat(outputFormat, displayMode);
  
  // Check if element has zero quantity
  const hasZeroQuantity = isZeroQuantity(element.quantity);

  return (
    <Tooltip 
      title={hasZeroQuantity ? getZeroQuantityTooltip(element.type_name || element.element_type) : ''}
      arrow
      placement="left"
    >
      <TableRow sx={getZeroQuantityStyles(hasZeroQuantity, { 
        backgroundColor: '#fafafa',
        '&:hover': {
          backgroundColor: '#f0f0f0',
        },
      })}>
        <TableCell sx={{ 
          pl: hasZeroQuantity ? 9 : 10, // Reduce padding when highlighted to account for border
          width: '40%' 
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2" fontWeight="medium">
              {element.type_name || element.element_type}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                ID:
              </Typography>
              <CopyableText
                text={element.guid}
                variant="chip"
                fontSize="0.7rem"
                maxWidth="140px"
                tooltip="Element ID kopieren"
              />
            </Box>
          </Box>
        </TableCell>
        <TableCell sx={{ width: '15%' }}>
          <Typography variant="body2" color="text.secondary">
            1 Element
          </Typography>
        </TableCell>
        <TableCell align="right" sx={{ width: '20%' }}>
          <Typography variant="body2" sx={{ 
            fontWeight: hasZeroQuantity ? 'bold' : 'normal',
            color: hasZeroQuantity ? 'warning.main' : 'inherit'
          }}>
            {formatNumber(element.quantity, 2)} m³
          </Typography>
        </TableCell>
        <TableCell align="right" sx={{ width: '25%' }}>
          <Typography variant="body2">
            {formatDisplayValue(impactValue, displayMode, ebfNumeric)} {unit}
          </Typography>
        </TableCell>
      </TableRow>
    </Tooltip>
  );
};

export const LcaEbkpGroupRow: React.FC<LcaEbkpGroupRowProps> = ({
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
  
  // Check if group has zero total quantity
  const hasZeroQuantity = isZeroQuantity(group.totalQuantity);

  return (
    <>
      <Tooltip 
        title={hasZeroQuantity ? `${getZeroQuantityTooltip()} - Gruppe ${group.code}` : ''}
        arrow
        placement="left"
      >
        <TableRow
          sx={getZeroQuantityStyles(hasZeroQuantity, {
            backgroundColor: '#f9f9f9',
            '&:hover': {
              backgroundColor: '#f0f0f0',
            },
            cursor: 'pointer',
          })}
          onClick={onToggle}
        >
        <TableCell sx={{ 
          pl: hasZeroQuantity ? 5 : 6, // Reduce padding when highlighted to account for border
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
                transition: 'transform 0.2s',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              <ChevronRight sx={{ 
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }} />
            </IconButton>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body1" fontWeight="medium">
                {group.code}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {group.name}
              </Typography>
            </Box>
          </Box>
        </TableCell>
        <TableCell sx={{ width: '15%' }}>
          <Typography variant="body2" color="text.secondary">
            {group.elementCount} Elemente
          </Typography>
        </TableCell>
        <TableCell align="right" sx={{ width: '20%' }}>
          <Typography variant="body2" sx={{ 
            fontWeight: hasZeroQuantity ? 'bold' : 'normal',
            color: hasZeroQuantity ? 'warning.main' : 'inherit'
          }}>
            {formatNumber(group.totalQuantity, 2)} m³
          </Typography>
        </TableCell>
        <TableCell align="right" sx={{ width: '25%' }}>
          <Typography variant="body2">
            {formatDisplayValue(impactValue, displayMode, ebfNumeric)} {unit}
          </Typography>
        </TableCell>
      </TableRow>
      </Tooltip>
      
      {/* Expandable elements */}
      {isExpanded && group.elements.map((element) => (
        <ElementRow
          key={element.guid}
          element={element}
          outputFormat={outputFormat}
          displayMode={displayMode}
          ebfNumeric={ebfNumeric}
        />
      ))}
    </>
  );
}; 
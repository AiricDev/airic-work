import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import type { Execution } from '../types/workbench';
import { executionTag, type TagIcon } from '../utils/selectors';

interface StatusTagProps {
  execution: Execution;
  pendingCount: number;
}

const icons: Record<TagIcon, React.ReactElement> = {
  play: <PlayCircleOutlineIcon />,
  pause: <PauseCircleOutlineIcon />,
  done: <CheckCircleOutlineIcon />,
  hourglass: <HourglassEmptyIcon />,
  stop: <StopCircleOutlinedIcon />
};

export function StatusTag({ execution, pendingCount }: StatusTagProps) {
  const tag = executionTag(execution, pendingCount);
  return (
    <Tooltip title="场景标签，仅辅助理解，不代表正式状态">
      <Chip variant="outlined" color={tag.color} icon={icons[tag.icon]} label={tag.label} sx={{ flexShrink: 0 }} />
    </Tooltip>);

}
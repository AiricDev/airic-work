import { Box,Stack,Typography } from '@mui/material';
import React from 'react';

interface BriefSectionProps {
  title: string;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}

export function BriefSection({ title, icon, aside, children }: BriefSectionProps) {
  return (
    <Box component="section">
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        {icon}
        <Typography variant="overline" color="text.secondary" component="h3">
          {title}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {aside}
      </Stack>
      {children}
    </Box>);

}

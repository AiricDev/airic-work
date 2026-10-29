import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <Box sx={{ mb: 2 }}>
      {breadcrumbs}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }} sx={{ mt: breadcrumbs ? 1 : 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" component="h1">
            {title}
          </Typography>
          {description &&
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          }
        </Box>
        {actions}
      </Stack>
    </Box>);

}
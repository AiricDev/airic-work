import React from 'react';
import { Alert, Button, Chip, Stack } from '@mui/material';
import type { ActionResult } from '../../types/platform';

interface SettingsActionsProps {
  dirty: boolean;
  result: ActionResult | null;
  onSave: () => void;
  onRevert: () => void;
  extra?: React.ReactNode;
}

export function SettingsActions({ dirty, result, onSave, onRevert, extra }: SettingsActionsProps) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        {dirty && <Chip variant="outlined" color="warning" label="未保存" />}
        <Button variant="contained" onClick={onSave} disabled={!dirty}>保存</Button>
        <Button onClick={onRevert} disabled={!dirty}>恢复已保存值</Button>
        {extra}
      </Stack>
      {result && <Alert severity={result.ok ? 'success' : 'error'}>{result.message}</Alert>}
    </Stack>);

}
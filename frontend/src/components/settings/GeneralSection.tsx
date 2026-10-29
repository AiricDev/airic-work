import React from 'react';
import { Autocomplete, Stack, TextField, Typography } from '@mui/material';
import { usePlatform } from '../../contexts/PlatformContext';
import { useSettingsForm } from '../../hooks/useSettingsForm';
import { SettingsActions } from './SettingsActions';
import { UnsavedChangesDialog } from '../UnsavedChangesDialog';

export const timezones = ['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Europe/Berlin', 'America/Los_Angeles', 'UTC'];

export function GeneralSection() {
  const { state, saveGeneral } = usePlatform();
  const form = useSettingsForm(state.general, saveGeneral);
  const nameError = !form.value.orgName.trim();

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" component="h2">基本信息</Typography>
      <Typography variant="body2" color="text.secondary">单组织部署，不提供组织切换、租户或计费。</Typography>
      <TextField
        label="组织显示名称"
        required
        value={form.value.orgName}
        onChange={(e) => form.set({ orgName: e.target.value })}
        error={nameError}
        helperText={nameError ? '请填写组织显示名称' : '仅用于显示，不改变任何业务标识'} />
      
      <Autocomplete
        options={timezones}
        value={form.value.timezone}
        disableClearable
        onChange={(_, v) => v && form.set({ timezone: v })}
        renderInput={(params) => <TextField {...params} label="默认时区（IANA）" />} />
      
      <SettingsActions dirty={form.dirty} result={form.result} onSave={() => !nameError && form.save()} onRevert={form.revert} />
      <UnsavedChangesDialog blocker={form.blocker} onSave={() => !nameError && form.save().ok} onDiscard={form.revert} />
    </Stack>);

}
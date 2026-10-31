import { Alert,Autocomplete,Avatar,Box,FormControl,FormControlLabel,FormLabel,Paper,Radio,RadioGroup,Stack,Switch,TextField,Typography } from '@mui/material';
import { useCallback } from 'react';
import { useBlocker,type BlockerFunction } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { timezones } from '../components/settings/GeneralSection';
import { SettingsActions } from '../components/settings/SettingsActions';
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog';
import { usePlatform } from '../contexts/PlatformContext';
import { useSettingsFormState } from '../hooks/useSettingsForm';
import type { NotificationKind } from '../types/platform';

const notifyLabels: Record<NotificationKind, string> = { decision: '新增待决事项', anomaly: '执行异常', result: '执行结果更新' };

export function ProfileSettings() {
  const { state, account, preference, saveProfile, savePreference } = usePlatform();
  const profile = useSettingsFormState({ name: account.name }, (v) => v.name.trim() ? saveProfile(v.name.trim()) : { ok: false, message: '显示名不能为空。' });
  const pref = useSettingsFormState(preference, savePreference);
  const dirty=profile.dirty||pref.dirty;
  const blocker=useBlocker(useCallback<BlockerFunction>(({currentLocation,nextLocation})=>dirty&&currentLocation.pathname!==nextLocation.pathname,[dirty]));

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <PageHeader title="个人设置" description="仅影响你自己的资料与提示偏好。" />
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" component="h2">资料</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ width: 48, height: 48 }}>{(profile.value.name || account.name).slice(0, 1)}</Avatar>
              <Typography variant="caption" color="text.secondary">头像使用姓名首字母</Typography>
            </Stack>
            <TextField label="显示名" value={profile.value.name} onChange={(e) => profile.set({ name: e.target.value })} error={!profile.value.name.trim()} />
            <TextField label="身份标识（集成方接入）" value={account.id} InputProps={{ readOnly: true }} helperText="只读" />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField label="组织" value={state.general.orgName} InputProps={{ readOnly: true }} />
              <TextField label="角色" value={account.systemRole === 'admin' ? '管理员' : '成员'} InputProps={{ readOnly: true }} />
            </Box>
            <SettingsActions dirty={profile.dirty} result={profile.result} onSave={profile.save} onRevert={profile.revert} />
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" component="h2">偏好</Typography>
            <FormControl>
              <FormLabel id="lang">语言</FormLabel>
              <RadioGroup row aria-labelledby="lang" value={pref.value.language} onChange={(e) => pref.set({ language: e.target.value as 'zh-CN' | 'en-US' })}>
                <FormControlLabel value="zh-CN" control={<Radio size="small" />} label="简体中文" />
                <FormControlLabel value="en-US" control={<Radio size="small" />} label="English (US)" />
              </RadioGroup>
            </FormControl>
            {pref.value.language === 'en-US' && <Alert severity="warning">英文界面尚未实现，保存后界面仍为简体中文。</Alert>}
            <Autocomplete
              options={timezones}
              value={pref.value.timezone}
              disableClearable
              onChange={(_, v) => v && pref.set({ timezone: v })}
              renderInput={(params) => <TextField {...params} label="时区（IANA）" helperText="当前时间按浏览器本地时区显示" />} />

            <Box>
              <Typography variant="subtitle2">站内通知</Typography>
              {(Object.keys(notifyLabels) as NotificationKind[]).map((k) =>
              <FormControlLabel
                key={k}
                sx={{ display: 'flex' }}
                control={<Switch checked={pref.value.notify[k]} onChange={(e) => pref.set({ notify: { ...pref.value.notify, [k]: e.target.checked } })} />}
                label={notifyLabels[k]} />

              )}
              <Typography variant="caption" color="text.secondary">只影响提示，不隐藏待决任务或绕过权限。邮件、短信与浏览器推送不在本轮。</Typography>
            </Box>
            <SettingsActions dirty={pref.dirty} result={pref.result} onSave={pref.save} onRevert={pref.revert} />
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Alert severity="info">身份来自集成方 token，本地 User 自动接入；无需单独绑定账号或授权客户端。</Alert>
        </Paper>
      </Stack>
      <UnsavedChangesDialog
        blocker={blocker}
        onSave={async () => (profile.dirty ? (await profile.save()).ok : true) && (pref.dirty ? (await pref.save()).ok : true)}
        onDiscard={() => {
          profile.revert();
          pref.revert();
        }} />

    </Box>);

}

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Typography } from
'@mui/material';
import { usePlatform } from '../contexts/PlatformContext';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { demoUsers } from '../data/users';

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) return '/projects';
  return value;
}

export function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, signIn } = usePlatform();
  const { currentUser, setUser } = useWorkbench();
  const [selected, setSelected] = useState(currentUser.id);
  const [error, setError] = useState<string | null>(null);
  const returnTo = safeReturnTo(params.get('returnTo'));
  const accounts = state.users.filter((u) => demoUsers.some((d) => d.id === u.id));

  const enter = () => {
    const r = signIn(selected);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setUser(selected);
    navigate(returnTo, { replace: true });
  };

  return (
    <Box component="main" sx={{ minHeight: '100vh', width: '100%', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 440, p: 4 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h5" component="h1" fontWeight={700}>Airic Work</Typography>
          <Chip label="演示数据" color="warning" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {state.general.orgName} · 演示登录页。这里不进行真实身份认证，生产认证与 SSO 机制 TBD。
        </Typography>

        <FormControl sx={{ mt: 3, width: '100%' }}>
          <FormLabel id="login-account">选择演示账户</FormLabel>
          <RadioGroup
            aria-labelledby="login-account"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setError(null);
            }}>
            
            {accounts.map((u) =>
            <FormControlLabel
              key={u.id}
              value={u.id}
              control={<Radio size="small" />}
              label={
              <Box>
                    <Typography variant="body2">
                      {u.name} · {u.systemRole === 'admin' ? '管理员' : '成员'}
                      {u.status === 'disabled' && '（已停用）'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                  </Box>
              }
              sx={{ py: 0.5 }} />

            )}
          </RadioGroup>
        </FormControl>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {returnTo !== '/projects' &&
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
            进入后将返回：{returnTo}
          </Typography>
        }
        <Button variant="contained" fullWidth sx={{ mt: 2 }} onClick={enter}>进入工作台</Button>
      </Paper>
    </Box>);

}
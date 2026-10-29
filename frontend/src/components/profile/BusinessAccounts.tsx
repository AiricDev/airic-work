import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Link, Stack, Typography } from '@mui/material';
import type { ActionResult, Delegation } from '../../types/platform';
import { usePlatform } from '../../contexts/PlatformContext';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { formatTime } from '../../utils/time';

const mask = (id: string) => id.length > 4 ? `${id.slice(0, 3)}***${id.slice(-2)}` : '***';

export function BusinessAccounts() {
  const { state, account, reauthorize, revokeDelegation } = usePlatform();
  const wb = useWorkbench();
  const [busy, setBusy] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Delegation | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const identities = state.identities.filter((i) => i.userId === account.id);
  const delegations = state.delegations.filter((d) => d.userId === account.id);
  const systems = Array.from(new Set([...identities.map((i) => i.system), ...delegations.map((d) => d.system)]));
  const affected = revoking ? wb.state.executions.filter((e) => e.ownerId === account.id && e.source.system === revoking.system && !e.ended) : [];

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1" component="h2">业务账号</Typography>
      <Typography variant="body2" color="text.secondary">平台不会使用共享服务账号或管理员账号代替你执行业务操作。有效映射不等于拥有业务审批权限。</Typography>
      {systems.length === 0 && <Typography variant="body2" color="text.secondary">尚未关联业务系统，请联系管理员建立身份映射。</Typography>}
      {systems.map((sys) => {
        const ident = identities.find((i) => i.system === sys);
        const dg = delegations.find((d) => d.system === sys);
        return (
          <Box key={sys} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="body2" fontWeight={600}>{sys}</Typography>
              {ident && <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{mask(ident.externalId)}</Typography>}
              <Chip variant="outlined" color={ident?.status === '已验证' ? 'success' : 'warning'} label={`身份：${ident?.status ?? '未关联'}`} />
              <Chip variant="outlined" color={dg?.status === '有效' ? 'success' : 'warning'} label={`授权：${dg?.status ?? '未授权'}`} />
            </Stack>
            {dg &&
            <Box component="dl" sx={{ m: 0, mt: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25, '& dd': { m: 0 } }}>
                <Typography component="dt" variant="caption" color="text.secondary">授权范围</Typography>
                <Typography component="dd" variant="caption">{dg.scope}</Typography>
                <Typography component="dt" variant="caption" color="text.secondary">到期</Typography>
                <Typography component="dd" variant="caption">{dg.expiresAt ? formatTime(dg.expiresAt) : '未知'}</Typography>
                <Typography component="dt" variant="caption" color="text.secondary">最近验证</Typography>
                <Typography component="dd" variant="caption">{formatTime(dg.lastVerifiedAt)}</Typography>
              </Box>
            }
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {dg && dg.status !== '有效' && ident?.status === '已验证' &&
              <Button
                size="small"
                variant="outlined"
                disabled={busy === dg.id}
                startIcon={busy === dg.id ? <CircularProgress size={12} /> : undefined}
                onClick={async () => {
                  setBusy(dg.id);
                  setResult(await reauthorize(dg.id));
                  setBusy(null);
                }}>
                
                  重新授权
                </Button>
              }
              {dg?.status === '有效' && <Button size="small" color="error" onClick={() => setRevoking(dg)}>撤销委托</Button>}
              {ident?.status === '待验证' && <Typography variant="caption" color="text.secondary">身份待业务系统验证后才能授权。</Typography>}
            </Stack>
          </Box>);

      })}
      {result && <Alert severity={result.ok ? 'success' : 'error'}>{result.message}</Alert>}

      <Dialog open={Boolean(revoking)} onClose={() => setRevoking(null)} maxWidth="sm" fullWidth>
        <DialogTitle>撤销 {revoking?.system} 委托</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2">受影响的执行</Typography>
          {affected.length === 0 ?
          <Typography variant="body2" color="text.secondary">无进行中执行。</Typography> :

          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {affected.map((e) => <Typography component="li" variant="body2" key={e.id}><Link component={RouterLink} to={`/executions/${e.id}`}>{e.goal}</Link></Typography>)}
            </Box>
          }
          <Alert severity="warning" sx={{ mt: 1.5 }}>撤销后，依赖该委托的后续 MCP 操作将失效；已发生的业务效果不会回滚，历史记录不会改写。</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevoking(null)}>取消</Button>
          <Button color="error" variant="contained" onClick={() => {if (revoking) setResult(revokeDelegation(revoking.id));setRevoking(null);}}>确认撤销</Button>
        </DialogActions>
      </Dialog>
    </Stack>);

}
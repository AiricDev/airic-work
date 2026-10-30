import { Chip, Stack, Typography } from '@mui/material';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import type { Execution } from '../../types/workbench';
export function ExecutionIdentity({ execution }: { execution: Execution }) {
  const { currentUser } = useWorkbench();
  return <Stack direction="row" spacing={1} alignItems="center"><Chip label="集成方身份（模拟）" /><Typography variant="caption">发起人即归属人：{currentUser.name} · Agent 使用同一用户身份 · Session / Workspace：{execution.id}</Typography></Stack>;
}

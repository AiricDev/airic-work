import { Alert,Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,Typography } from '@mui/material';
import type { Execution } from '../../types/workbench';

interface CancelExecutionDialogProps {
  open: boolean;
  execution: Execution;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelExecutionDialog({ open, execution, onClose, onConfirm }: CancelExecutionDialogProps) {
  const confirmed = execution.results.filter((r) => r.status === 'confirmed').map((r) => r.title);
  const inProgress = execution.summary.doing;
  const unknown = [
  ...execution.results.filter((r) => r.status === 'unknown').map((r) => r.title),
  ...execution.logs.filter((l) => l.receiptStatus !== 'confirmed').map((l) => `${l.tool}：${l.call}`)];


  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="cancel-title">
      <DialogTitle id="cancel-title">请求取消执行</DialogTitle>
      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2 }}>
          取消用于停止后续执行，不代表撤销既有业务操作。提交后需等待运行时确认实际停止情况。
        </Alert>
        <Section title="已确认的业务效果（不会撤销）" items={confirmed} />
        <Section title="进行中的操作" items={inProgress} />
        <Section title="效果未知（需要后续核实）" items={unknown} />
        <Typography variant="caption" color="text.secondary">
          取消后待决事项是否仍适用，以服务返回为准。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>返回</Button>
        <Button color="error" variant="contained" onClick={onConfirm}>
          提交取消请求
        </Button>
      </DialogActions>
    </Dialog>);

}

function Section({ title, items }: {title: string;items: string[];}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2">{title}</Typography>
      {items.length === 0 ?
      <Typography variant="body2" color="text.secondary">
          无
        </Typography> :

      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {items.map((i) =>
        <Typography component="li" variant="body2" key={i}>
              {i}
            </Typography>
        )}
        </Box>
      }
    </Box>);

}

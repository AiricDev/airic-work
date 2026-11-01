import { DecisionMarkdown } from '../shared/DecisionMarkdown';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import {
Box,
Breadcrumbs,
Button,
Dialog,
DialogTitle,
DialogContent,
DialogActions,
IconButton,
Link,
ListItemIcon,
ListItemText,
Menu,
MenuItem,
Paper,
Stack,
Tooltip,
Typography
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink,useNavigate } from 'react-router-dom';
import type { Execution,Project } from '../../types/workbench';
import { formatTime } from '../../utils/time';
import { StatusTag } from '../StatusTag';
import { ExecutionIdentity } from './ExecutionIdentity';

interface ExecutionHeaderProps {
  execution: Execution;
  project?: Project;
  from?: string;
  pendingCount: number;
  cancelDisabledReason: string | null;
  onRequestCancel: () => void;
}

export function ExecutionHeader({ execution, project, from, pendingCount, cancelDisabledReason, onRequestCancel }: ExecutionHeaderProps) {
  const navigate = useNavigate();
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const projectPath = project ? from?.startsWith(`/projects/${project.id}`) ? from : `/projects/${project.id}` : '/projects';
  const backPath = from ?? projectPath;

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Tooltip title="返回">
          <IconButton aria-label="返回" onClick={() => navigate(backPath)}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Breadcrumbs aria-label="位置" sx={{ flex: 1, minWidth: 0, '& ol': { flexWrap: 'nowrap' }, '& li': { minWidth: 0 }, '& li:last-child': { overflow: 'hidden', flex: 1 } }}>
          <Link component={RouterLink} to="/projects" underline="hover" color="inherit">
            项目
          </Link>
          {project &&
          <Link component={RouterLink} to={projectPath} underline="hover" color="inherit" noWrap>
              {project.name}
            </Link>
          }
          <Typography color="text.primary" noWrap>
            {execution.goal}
          </Typography>
        </Breadcrumbs>
        <Button
          component={RouterLink}
          to={`/business?ref=${execution.source.ref}`}
          variant="outlined"
          startIcon={<OpenInNewIcon />}
          sx={{ flexShrink: 0 }}>

          返回业务系统
        </Button>
        <IconButton aria-label="更多操作" aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem
            disabled={Boolean(cancelDisabledReason)}
            onClick={() => {
              setAnchor(null);
              onRequestCancel();
            }}>

            <ListItemIcon>
              <StopCircleOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="请求取消执行" secondary={cancelDisabledReason ?? '停止后续执行，不撤销既有业务操作'} />
          </MenuItem>
        </Menu>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ mt: 1, pl: 5 }}>
        <Typography variant="h6" component="h1" sx={{ minWidth: 0, maxWidth: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
          {execution.goal}
        </Typography>
        <Button size="small" onClick={() => setInstructionOpen(true)}>查看完整指示</Button>
        <StatusTag execution={execution} pendingCount={pendingCount} />
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          {execution.id}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" sx={{ mt: 0.5, pl: 5, color: 'text.secondary' }}>
        <Typography variant="caption">
          来源：{execution.source.label}（{execution.source.system}）
        </Typography>
        <Typography variant="caption" sx={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>范围：{execution.scope}</Typography>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <Link
            component={RouterLink}
            to={`/om?commit=${execution.omCommit}&executionId=${execution.id}`}
            variant="caption"
            sx={{ fontFamily: 'monospace' }}>

            OM {execution.omRepo} @ {execution.omCommit}
          </Link>
          <Tooltip title={`实际使用的 OM SHA，启动后不随仓库变更切换。Runtime：${execution.runtimeVersion}；Skill：${execution.skillVersion}`}>
            <InfoOutlinedIcon sx={{ fontSize: 14 }} aria-label="版本详情" />
          </Tooltip>
        </Box>
        <Typography variant="caption">最后同步：{formatTime(execution.lastSyncedAt)}</Typography>
        <Link component={RouterLink} to={`/executions/${execution.id}/trajectory`} variant="caption">
          查看完整轨迹
        </Link>
      </Stack>
      <Box sx={{ mt: 0.5, pl: 5 }}>
        <ExecutionIdentity execution={execution} />
      </Box>
      <Dialog open={instructionOpen} onClose={() => setInstructionOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>执行指示</DialogTitle>
        <DialogContent><DecisionMarkdown>{execution.goal}</DecisionMarkdown></DialogContent>
        <DialogActions><Button onClick={() => setInstructionOpen(false)}>关闭</Button></DialogActions>
      </Dialog>
    </Paper>);

}

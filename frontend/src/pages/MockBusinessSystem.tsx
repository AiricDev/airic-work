import React from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, AlertTitle, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { evidence } from '../data/evidence';
import { projects } from '../data/projects';
import { requestKindLabels } from '../utils/labels';
import { formatTime } from '../utils/time';

export function MockBusinessSystem() {
  const [params] = useSearchParams();
  const ref = params.get('ref') ?? '';
  const { state, simulateExternalResolve } = useWorkbench();

  const project = projects.find((p) => p.businessRef === ref);
  const doc = evidence.find((d) => d.objectId === ref);
  const executions = state.executions.filter((e) => e.source.ref === ref);
  const requests = state.requests.filter((r) => executions.some((e) => e.id === r.executionId));

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Button component={RouterLink} to="/projects" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>
        返回 Airic Work
      </Button>
      <Alert severity="warning" sx={{ mb: 2 }}>
        <AlertTitle>模拟业务系统（未连接真实系统）</AlertTitle>
        本页仅用于演示业务系统与工作台读取同一份执行与决策记录，不代表任何真实业务系统的界面或流程。
      </Alert>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">
          业务对象
        </Typography>
        <Typography variant="h6" component="h1" sx={{ fontFamily: 'monospace' }}>
          {ref || '未指定'}
        </Typography>
        {project && <Typography color="text.secondary">项目：{project.name}（{project.businessTaskRef}）</Typography>}
        {doc &&
        <Typography color="text.secondary">
            文档：{doc.title} · {doc.version} · {doc.locator}
          </Typography>
        }
        {!project && !doc && executions.length === 0 &&
        <Typography color="text.secondary">演示数据中没有与该引用关联的对象。</Typography>
        }
      </Paper>

      {executions.length > 0 &&
      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle1" component="h2">
            关联的 Agent 执行与待决事项
          </Typography>
          <Typography variant="caption" color="text.secondary">
            业务完成状态由本系统管理；Agent 执行结束不等于业务完成。
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            {requests.length === 0 && <Typography color="text.secondary">没有关联的待决事项。</Typography>}
            {requests.map((r) => {
            const exec = executions.find((e) => e.id === r.executionId);
            return (
              <Box key={r.id} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    <Chip variant="outlined" label={requestKindLabels[r.kind]} />
                    <Chip variant="outlined" color={r.status === 'pending' ? 'warning' : 'success'} label={r.status === 'pending' ? '待处理' : '已处理'} />
                    <Typography variant="caption" color="text.secondary">
                      {r.id} · {exec?.goal}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={600} sx={{ mt: 0.75 }}>
                    {r.question}
                  </Typography>
                  {r.resolution &&
                <Typography variant="body2" color="text.secondary">
                      {r.resolution.actorName}（{r.resolution.channel}，{formatTime(r.resolution.at)}）：{r.resolution.content}
                    </Typography>
                }
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button component={RouterLink} to={`/executions/${r.executionId}?request=${r.id}`} variant="outlined">
                      在 Airic Work 中查看
                    </Button>
                    {r.status === 'pending' &&
                  <Button onClick={() => simulateExternalResolve(r.id)}>在业务系统中处理（模拟，王芳）</Button>
                  }
                  </Stack>
                </Box>);

          })}
          </Stack>
        </Paper>
      }
    </Box>);

}
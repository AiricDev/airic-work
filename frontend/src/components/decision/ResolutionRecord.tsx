import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AlertTitle,
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography } from
'@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { DecisionRequest } from '../../types/workbench';
import { actionLabels } from '../../utils/labels';
import { formatTime } from '../../utils/time';
import { DecisionBrief } from './DecisionBrief';

interface ResolutionRecordProps {
  request: DecisionRequest;
  conflictDraft: boolean;
  justSubmitted: boolean;
  onDiscardDraft: () => void;
  onOpenEvidence: (id: string) => void;
}

export function ResolutionRecord({ request, conflictDraft, justSubmitted, onDiscardDraft, onOpenEvidence }: ResolutionRecordProps) {
  const r = request.resolution;
  if (!r) return null;
  const f = request.followUp;
  const rows: {label: string;value: string;}[] = [
  { label: '处理方式', value: actionLabels[r.action] },
  { label: '内容', value: r.content }];

  if (r.reason) rows.push({ label: r.action === 'judgment' ? '理由' : '备注', value: r.reason });
  if (r.source) rows.push({ label: '来源', value: r.source });
  rows.push(
    { label: '处理人', value: `${r.actorName}（${r.channel}）` },
    { label: '时间', value: formatTime(r.at) },
    { label: '依据版本', value: `v${r.basisVersion}` },
    { label: '记录编号', value: r.id }
  );

  return (
    <Stack spacing={2}>
      {conflictDraft &&
      <Alert severity="warning" action={<Button color="inherit" onClick={onDiscardDraft}>放弃我的草稿</Button>}>
          <AlertTitle>此请求已由他人处理</AlertTitle>
          {r.actorName} 已通过{r.channel}处理。你的草稿未提交，也不会覆盖下方的正式记录。
        </Alert>
      }
      {justSubmitted && !conflictDraft && <Alert severity="success">处理结果已记录。下方可查看处理记录与后续执行情况。</Alert>}

      <Box>
        <Typography variant="overline" color="text.secondary" component="h3">
          正式处理记录
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {request.question}
        </Typography>
        <Box component="dl" sx={{ m: 0, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.75, '& dd': { m: 0 } }}>
          {rows.map((row) =>
          <React.Fragment key={row.label}>
              <Typography component="dt" variant="body2" color="text.secondary">
                {row.label}
              </Typography>
              <Typography component="dd" variant="body2">
                {row.value}
              </Typography>
            </React.Fragment>
          )}
        </Box>
      </Box>

      {f?.status === 'confirming' &&
      <Alert severity="info">
          <AlertTitle>处理结果已记录；正在确认后续执行</AlertTitle>
          尚未取得新的执行事件，暂不能确认相关工作已继续。
          <LinearProgress sx={{ mt: 1 }} aria-label="正在确认后续执行" />
        </Alert>
      }
      {f?.status === 'continued' &&
      <Alert severity="success">
          <AlertTitle>{f.message}</AlertTitle>
          {f.remaining.length > 0 ?
        <>
              <Typography variant="body2">该执行仍有其他依赖：</Typography>
              {f.remaining.map((item) =>
          <Typography variant="body2" key={item}>
                  · {item}
                </Typography>
          )}
            </> :

        <Typography variant="body2">该执行没有其他等待人工处理的依赖。</Typography>
        }
        </Alert>
      }
      {f?.status === 'recorded' && <Alert severity="info">{f.message}</Alert>}

      <Typography variant="caption" color="text.secondary">
        此决定不自动更新 OM；业务上的正式审批与完成状态以业务系统为准。
      </Typography>

      <Accordion variant="outlined" disableGutters sx={{ '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={500}>
            查看处理时的 Decision Brief
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <DecisionBrief request={request} onOpenEvidence={onOpenEvidence} />
        </AccordionDetails>
      </Accordion>
    </Stack>);

}
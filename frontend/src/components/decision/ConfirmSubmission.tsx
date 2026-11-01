import { responseText } from '../../utils/decisionResponse';
import { decisionSummary } from '../../utils/decisionSummary';
import { Alert,AlertTitle,Box,Button,CircularProgress,Stack,Typography } from '@mui/material';
import React from 'react';
import type { DecisionRequest,Draft,SubmitOutcome } from '../../types/workbench';
import { submitLabels } from '../../utils/labels';

interface ConfirmSubmissionProps {
  request: DecisionRequest;
  value: Draft;
  submitting: boolean;
  outcome: SubmitOutcome | null;
  lookupMessage: string | null;
  draftStale: boolean;
  onBack: () => void;
  onSubmit: () => void;
  onReviewLatest: () => void;
  onCheckAcceptance: () => void;
}

export function ConfirmSubmission({
  request,
  value,
  submitting,
  outcome,
  lookupMessage,
  draftStale,
  onBack,
  onSubmit,
  onReviewLatest,
  onCheckAcceptance
}: ConfirmSubmissionProps) {
  const action = value.action ?? 'fact';
  const option = request.brief.options.find((o) => o.id === value.choiceId);
  const auth = request.brief.authorization;
  const unknown = outcome?.kind === 'unknown';

  const rows: {label: string;value: string;}[] = [
  { label: '请求', value: `${request.id} · ${decisionSummary(request)}` },
  { label: '回应', value: action === 'judgment' ? option?.label ?? '' : action === 'investigation' ? '需要进一步调查' : action === 'authorization' ? '提供授权' : '补充内容' }];

  if (responseText(value).trim()) rows.push({ label: '补充内容', value: responseText(value) });
  if (value.factSource.trim()) rows.push({ label: '来源', value: value.factSource });
  if (action === 'authorization' && auth) {
    rows.push({ label: '授权对象', value: auth.object }, { label: '允许动作', value: auth.action }, { label: '范围', value: auth.scope });

  }

  if(value.files?.length)rows.push({label:'附件',value:value.files.map(f=>f.name).join('；')});
  rows.push({ label: '影响范围', value: request.brief.affected.join('；') }, { label: '依据版本', value: `v${value.baseVersion}` });

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" component="h2">
        核对并提交
      </Typography>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1, '& dd': { m: 0, whiteSpace: 'pre-wrap' } }}>
        {rows.map((r) =>
        <React.Fragment key={r.label}>
            <Typography component="dt" variant="body2" color="text.secondary">
              {r.label}
            </Typography>
            <Typography component="dd" variant="body2">
              {r.value}
            </Typography>
          </React.Fragment>
        )}
      </Box>

      <Alert severity="info">此决定不自动更新 OM。是否沉淀为可复用知识，需通过 OME 与 Git 评审另行处理。</Alert>
      {action === 'authorization' && <Alert severity="warning">此授权仅在列明范围内有效，不替代业务系统的正式审批。</Alert>}
      {action === 'investigation' && <Alert severity="info">提交后即已回答。Agent 是否继续调查以后续 Session 为准。</Alert>}

      {draftStale &&
      <Alert severity="warning" action={<Button color="inherit" onClick={onReviewLatest}>查看最新内容</Button>}>
          请求已变化，当前草稿基于旧版本，不能直接提交。
        </Alert>
      }
      {outcome?.kind === 'failed' &&
      <Alert severity="error">
          <AlertTitle>提交失败，未被接受</AlertTitle>
          {outcome.message} 你的内容已保留，可修正后重试。
        </Alert>
      }
      {outcome?.kind === 'forbidden' &&
      <Alert severity="error">
          <AlertTitle>没有处理权限</AlertTitle>
          {outcome.reason}
        </Alert>
      }
      {outcome?.kind === 'stale' &&
      <Alert severity="warning" action={<Button color="inherit" onClick={onReviewLatest}>查看最新内容</Button>}>
          <AlertTitle>上下文已过期，未提交</AlertTitle>
          {outcome.changes.map((c) =>
        <Typography key={c.version} variant="body2">
              v{c.version} · {c.source}：{c.summary}。需要复核：{c.scope}
            </Typography>
        )}
        </Alert>
      }
      {unknown &&
      <Alert severity="warning" action={<Button color="inherit" onClick={onCheckAcceptance}>确认原提交（同键重试）</Button>}>
          <AlertTitle>正在核实是否已接受</AlertTitle>
          提交结果未知：这既不代表成功，也不代表失败。请先确认原提交（同键重试），不要重复提交。
          {lookupMessage &&
        <Typography variant="body2" sx={{ mt: 0.5 }}>
              {lookupMessage}
            </Typography>
        }
        </Alert>
      }

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button onClick={onBack} disabled={submitting || unknown || !!value.pending}>
          返回修改
        </Button>
        {!unknown &&
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={submitting || draftStale}
          startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : undefined}>

            {submitting ? '提交中…' : submitLabels[action]}
          </Button>
        }
      </Stack>
    </Stack>);

}

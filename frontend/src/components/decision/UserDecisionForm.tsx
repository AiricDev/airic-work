import { FileInput } from '../FileInput';
import React from 'react';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography } from
'@mui/material';
import type { ActionType, DecisionRequest, Draft } from '../../types/workbench';
import { actionDescriptions, actionLabels } from '../../utils/labels';

interface UserDecisionFormProps {
  request: DecisionRequest;
  value: Draft;
  errors: Record<string, string>;
  showErrors: boolean;
  onChange: (patch: Partial<Draft>) => void;
}

export function UserDecisionForm({ request, value, errors, showErrors, onChange }: UserDecisionFormProps) {
  const err = (key: string) => showErrors ? errors[key] : undefined;
  const auth = request.brief.authorization;

  return (
    <Stack spacing={2} component="form" onSubmit={(e) => e.preventDefault()} aria-label="处理表单">
      <FileInput files={value.files ?? []} onChange={files => onChange({ files })} />
      <FormControl error={Boolean(err('action'))}>
        <FormLabel id="action-label" sx={{ fontWeight: 600, color: 'text.primary' }}>
          选择处理方式
        </FormLabel>
        <RadioGroup aria-labelledby="action-label" value={value.action ?? ''} onChange={(e) => onChange({ action: e.target.value as ActionType })}>
          {request.allowedActions.map((a) =>
          <FormControlLabel
            key={a}
            value={a}
            control={<Radio size="small" />}
            label={
            <Box sx={{ py: 0.25 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {actionLabels[a]}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {actionDescriptions[a]}
                  </Typography>
                </Box>
            } />

          )}
        </RadioGroup>
        <FormHelperText>{err('action') ?? '仅显示此请求允许的处理方式。'}</FormHelperText>
      </FormControl>

      {value.action === 'judgment' &&
      <>
          <FormControl error={Boolean(err('choiceId'))}>
            <FormLabel id="choice-label" sx={{ fontWeight: 600, color: 'text.primary' }}>
              你的判断
            </FormLabel>
            <RadioGroup aria-labelledby="choice-label" value={value.choiceId} onChange={(e) => onChange({ choiceId: e.target.value })}>
              {request.brief.options.map((o) =>
            <FormControlLabel key={o.id} value={o.id} control={<Radio size="small" />} label={<Typography variant="body2">{o.label}</Typography>} />
            )}
            </RadioGroup>
            {err('choiceId') && <FormHelperText>{err('choiceId')}</FormHelperText>}
          </FormControl>
          <TextField
          label="判断理由"
          required
          multiline
          minRows={3}
          value={value.reason}
          onChange={(e) => onChange({ reason: e.target.value })}
          error={Boolean(err('reason'))}
          helperText={err('reason') ?? '将作为处理依据记录，供后续追溯。'} />
        
        </>
      }

      {value.action === 'fact' &&
      <>
          <TextField
          label="补充的事实"
          required
          multiline
          minRows={3}
          value={value.fact}
          onChange={(e) => onChange({ fact: e.target.value })}
          error={Boolean(err('fact'))}
          helperText={err('fact')} />
        
          <TextField
          label="事实来源"
          required
          value={value.factSource}
          onChange={(e) => onChange({ factSource: e.target.value })}
          error={Boolean(err('factSource'))}
          helperText={err('factSource') ?? '例如：业务记录编号、文件名与版本'} />
        
        </>
      }

      {value.action === 'authorization' && auth &&
      <Box>
          <Box component="dl" sx={{ m: 0, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5, '& dd': { m: 0 } }}>
            <Typography component="dt" variant="body2" color="text.secondary">授权对象</Typography>
            <Typography component="dd" variant="body2">{auth.object}</Typography>
            <Typography component="dt" variant="body2" color="text.secondary">允许动作</Typography>
            <Typography component="dd" variant="body2">{auth.action}</Typography>
            <Typography component="dt" variant="body2" color="text.secondary">范围</Typography>
            <Typography component="dd" variant="body2">{auth.scope}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
            {auth.note}
          </Typography>
          <FormControl error={Boolean(err('authorizeConfirm'))} sx={{ mt: 1 }}>
            <FormControlLabel
            control={<Checkbox size="small" checked={value.authorizeConfirm} onChange={(e) => onChange({ authorizeConfirm: e.target.checked })} />}
            label={<Typography variant="body2">我确认仅在上述对象、动作与范围内授权</Typography>} />
          
            {err('authorizeConfirm') && <FormHelperText>{err('authorizeConfirm')}</FormHelperText>}
          </FormControl>
          <TextField label="备注（可选）" fullWidth multiline minRows={2} value={value.note} onChange={(e) => onChange({ note: e.target.value })} sx={{ mt: 1 }} />
        </Box>
      }

      {value.action === 'investigation' &&
      <TextField
        label="需要调查的问题"
        required
        multiline
        minRows={3}
        value={value.investigation}
        onChange={(e) => onChange({ investigation: e.target.value })}
        error={Boolean(err('investigation'))}
        helperText={err('investigation') ?? '提交后即已回答，Agent 可继续调查或另行提问。'} />

      }
    </Stack>);

}
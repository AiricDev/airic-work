import { Box, Button, Checkbox, FormControl, FormControlLabel, FormHelperText, FormLabel, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';
import type { DecisionRequest, Draft } from '../../types/workbench';
import { responsePatch, responseText, selectResponse } from '../../utils/decisionResponse';
import { FileInput } from '../FileInput';

interface UserDecisionFormProps {
  request: DecisionRequest;
  value: Draft;
  errors: Record<string, string>;
  showErrors: boolean;
  readOnly?: boolean;
  onChange: (patch: Partial<Draft>) => void;
}

export function UserDecisionForm({ request, value, errors, showErrors, readOnly = false, onChange }: UserDecisionFormProps) {
  const err = (key: string) => showErrors ? errors[key] : undefined;
  const auth = request.brief.authorization;
  const selected = value.action === 'judgment' && value.choiceId ? `option:${value.choiceId}` : value.action === 'investigation' ? 'investigation' : value.action === 'authorization' ? 'authorization' : '';
  const card = { m: 0, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1, alignItems: 'flex-start', '& .MuiFormControlLabel-label': { flex: 1, pt: 0.25 }, '&:has(input:checked)': { borderColor: 'primary.main', bgcolor: 'action.selected' } };
  return <Stack spacing={2} component="form" onSubmit={e => e.preventDefault()} aria-label="处理表单">
    <FormControl error={Boolean(err('action') || err('choiceId'))}>
      <FormLabel id={`response-${request.id}`} sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>候选方案与风险</FormLabel>
      <RadioGroup aria-labelledby={`response-${request.id}`} value={selected} sx={{ gap: 1 }} onChange={e => {
        const v = e.target.value;
        onChange(selectResponse(value, v.startsWith('option:') ? 'judgment' : v === 'investigation' ? 'investigation' : 'authorization', v.startsWith('option:') ? v.slice(7) : ''));
      }}>
        {request.allowedActions.includes('judgment') && request.brief.options.map(o => <FormControlLabel key={o.id} value={`option:${o.id}`} disabled={readOnly} control={<Radio size="small" />} sx={card} label={<Box>
          <Typography variant="body2" fontWeight={600}>{o.label}</Typography>
          {o.description && <Typography variant="body2" sx={{ mt: 0.5 }}>{o.description}</Typography>}
          {o.risk && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>风险：{o.risk}</Typography>}
        </Box>} />)}
        {request.allowedActions.includes('investigation') && <FormControlLabel value="investigation" disabled={readOnly} control={<Radio size="small" />} sx={card} label={<Box>
          <Typography variant="body2" fontWeight={600}>需要进一步调查</Typography>
          <Typography variant="body2" color="text.secondary">请 Agent 继续核查；可在下方补充希望调查的内容。</Typography>
        </Box>} />}
        {request.allowedActions.includes('authorization') && auth && <FormControlLabel value="authorization" disabled={readOnly} control={<Radio size="small" />} sx={card} label={<Box>
          <Typography variant="body2" fontWeight={600}>在以下范围提供授权</Typography>
          <Typography variant="body2">{auth.object} · {auth.action} · {auth.scope}</Typography>
        </Box>} />}
      </RadioGroup>
      {(err('action') || err('choiceId')) && <FormHelperText>{err('action') || err('choiceId')}</FormHelperText>}
    </FormControl>
    {!readOnly && <>
      {selected && request.allowedActions.includes('fact') && <Button size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => onChange(selectResponse(value, 'fact'))}>清除选择，仅补充内容</Button>}
      <TextField label="补充内容（可选）" multiline minRows={3} value={responseText(value)} onChange={e => {
        const action = value.action ?? (request.allowedActions.includes('fact') ? 'fact' : null);
        onChange({ ...responsePatch(e.target.value, action), ...(action === 'authorization' ? { note: e.target.value } : {}) });
      }} error={Boolean(err('fact'))} helperText={err('fact') ?? (request.allowedActions.includes('fact') ? '也可以不选方案，直接填写事实、条件或其他说明。' : '可补充条件、理由或希望进一步调查的内容。')} />
      {value.factSource && <TextField label="事实来源（可选）" value={value.factSource} onChange={e => onChange({ factSource: e.target.value })} />}
      {value.action === 'authorization' && auth && <Box>
        <Typography variant="body2">{auth.note}</Typography>
        <FormControl error={Boolean(err('authorizeConfirm'))}>
          <FormControlLabel control={<Checkbox checked={value.authorizeConfirm} onChange={e => onChange({ authorizeConfirm: e.target.checked })} />} label="我确认仅在上述对象、动作与范围内授权" />
          {err('authorizeConfirm') && <FormHelperText>{err('authorizeConfirm')}</FormHelperText>}
        </FormControl>
      </Box>}
      <FileInput executionId={request.executionId} files={value.files ?? []} onChange={files => onChange({ files, ...(!value.action && files.length && request.allowedActions.includes('fact') ? { action: 'fact' as const } : {}) })} />
    </>}
  </Stack>;
}

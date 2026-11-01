import { SourceReferences } from './SourceReferences';
import { DecisionContextContent } from './DecisionContextContent';
import { decisionSummary } from '../../utils/decisionSummary';
import { DecisionMarkdown } from '../shared/DecisionMarkdown';
import BlockIcon from '@mui/icons-material/Block';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import {
Box,
Button,
Chip,
Link,
Stack,
Typography
} from '@mui/material';
import type { DecisionRequest, Execution } from '../../types/workbench';

import { requestKindLabels } from '../../utils/labels';
import { BriefSection } from './BriefSection';


interface DecisionBriefProps {
  request: DecisionRequest;
  execution?: Execution;
  onOpenEvidence: (id: string) => void;
}

export function DecisionBrief({ request, execution, onOpenEvidence }: DecisionBriefProps) {
  const { brief } = request;
  const otherEvidence: string[] = [];
  const evidence: import('../../types/workbench').Evidence[] = [];
  const evidenceLabel = (id:string) => id;

  return (
    <Stack spacing={2.25}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
          <Chip color="primary" variant="outlined" label={requestKindLabels[request.kind]} />
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {request.id} · v{request.version}
          </Typography>
        </Stack>
        <Typography variant="subtitle1" component="h2" sx={{ lineHeight: 1.45 }}>
          {decisionSummary(request)}
        </Typography>
        <DecisionMarkdown>{request.question}</DecisionMarkdown>
        {brief.actionNeeded !== request.question && <Typography variant="body2" sx={{ mt: 1 }}>需要你：{brief.actionNeeded}</Typography>}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          <Box component="span" sx={{ fontWeight: 600 }}>
            为什么需要人：
          </Box>
          {brief.trigger}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mt: 1.25 }}>
          <Box sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <BlockIcon sx={{ fontSize: 16 }} color="warning" />
              <Typography variant="subtitle2">受影响的工作</Typography>
            </Stack>
            {brief.affected.map((a) =>
            <Typography key={a} variant="body2">
                · {a}
              </Typography>
            )}
          </Box>
          <Box sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <PlayArrowIcon sx={{ fontSize: 16 }} color="success" />
              <Typography variant="subtitle2">仍在继续</Typography>
            </Stack>
            {brief.continuing.map((a) =>
            <Typography key={a} variant="body2">
                · {a}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      <BriefSection title="Agent 建议" icon={<LightbulbOutlinedIcon sx={{ fontSize: 16 }} color="action" />} aside={<Chip variant="outlined" label="仅为建议 · 未预选" />}>
        {brief.recommendation ?
        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              {brief.recommendation.text}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              依据：{brief.recommendation.rationale}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              主要不确定性：{brief.recommendation.uncertainty}
            </Typography>
          </Box> :

        <Box sx={{ p: 1.5, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              无建议
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {brief.noRecommendationReason ?? '证据不足，Agent 不给出确定性建议。'}
            </Typography>
          </Box>
        }
      </BriefSection>

      <BriefSection title="Decision Context">
        {brief.rawContext !== undefined && <DecisionContextContent value={brief.rawContext} />}

      </BriefSection>

      <BriefSection title="事实 · 假设 · 缺失 Context">
        <Stack spacing={0.75}>
          {brief.facts.map((f) =>
          <Stack key={f.text} direction="row" spacing={1} alignItems="flex-start">
              <Chip icon={<FactCheckOutlinedIcon />} color="success" variant="outlined" label="事实" sx={{ flexShrink: 0 }} />
              <Typography variant="body2" sx={{ pt: 0.25 }}>
                {f.text}
                {f.evidenceId &&
              <>
                    {' '}
                    <Link component="button" variant="body2" onClick={() => onOpenEvidence(f.evidenceId!)} sx={{ verticalAlign: 'baseline' }}>
                      [{evidenceLabel(f.evidenceId)}]
                    </Link>
                  </>
              }
              </Typography>
            </Stack>
          )}
          {brief.assumptions.map((a) =>
          <Stack key={a} direction="row" spacing={1} alignItems="flex-start">
              <Chip icon={<HelpOutlineIcon />} color="info" variant="outlined" label="假设" sx={{ flexShrink: 0 }} />
              <Typography variant="body2" sx={{ pt: 0.25 }}>
                {a}
              </Typography>
            </Stack>
          )}
          {brief.gaps.map((g) =>
          <Stack key={g} direction="row" spacing={1} alignItems="flex-start">
              <Chip icon={<ReportProblemOutlinedIcon />} color="warning" variant="outlined" label="缺失" sx={{ flexShrink: 0 }} />
              <Typography variant="body2" sx={{ pt: 0.25 }}>
                {g}
              </Typography>
            </Stack>
          )}
        </Stack>
      </BriefSection>

      <SourceReferences sources={brief.sourceReferences ?? []} executionId={request.executionId} fixedSha={brief.omCommit} execution={execution} />

      {otherEvidence.length > 0 &&
      <BriefSection title="其他证据引用">
        <Stack spacing={0.5} alignItems="flex-start">
          {otherEvidence.map((id) => {
            const d = evidence.find((e) => e.id === id);
            if (!d) return null;
            return (
              <Button key={id} startIcon={<DescriptionOutlinedIcon />} onClick={() => onOpenEvidence(id)} sx={{ textAlign: 'left', justifyContent: 'flex-start' }}>
                {d.title} · {d.objectId} {d.version} · {d.locator}
              </Button>);

          })}
        </Stack>
      </BriefSection>
      }

    </Stack>);

}

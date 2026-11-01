import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Box, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { Execution } from '../../types/workbench';
import { referenceTemplates, sourceReferenceLink, type SourceReference } from '../../utils/sourceReference';

export function SourceReferences({ sources, executionId, fixedSha, execution }: { sources: unknown[]; executionId: string; fixedSha: string; execution?: Execution }) {
  const references = sources.filter((s): s is SourceReference => !!s && typeof s === 'object' && !Array.isArray(s));
  if (!references.length && !fixedSha) return null;
  const templates = referenceTemplates();
  return <Accordion variant="outlined" disableGutters sx={{ '&:before': { display: 'none' } }}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2" fontWeight={500}>来源引用（{references.length}）</Typography></AccordionSummary>
    <AccordionDetails><Stack spacing={1.5}>
      {references.map((s, i) => {
        const href = sourceReferenceLink(s, executionId, fixedSha, execution?.scope ?? '{}', templates);
        const object = typeof s.objectId === 'string' ? s.objectId : '';
        const kind = object.split('/')[0];
        const label = kind === 'report' ? `报告 · ${object.slice(7, 15)}` : kind === 'assessment' ? `评估项 · ${object.slice(11, 19)}` : object || (typeof s.system === 'string' ? s.system : '来源');
        return <Box key={i} sx={{ overflowWrap: 'anywhere' }}>
          {href ? href.startsWith('/om?') ? <Link component={RouterLink} to={href}>{label}</Link> : <Link href={href} target="_blank" rel="noopener noreferrer">{label}</Link> : <Typography variant="body2">{label}</Typography>}
          <Typography variant="caption" color="text.secondary" component="div">{[s.system, s.version ? `版本 ${s.version}` : '', s.location].filter(v => typeof v === 'string' && v).join(' · ')}</Typography>
          {typeof s.objectId === 'string' && <Typography variant="caption" color="text.secondary" component="div">{s.objectId}</Typography>}
          {!href && <Typography variant="caption" color="text.secondary">未提供可打开的地址</Typography>}
        </Box>;
      })}
      {fixedSha && <Box><Typography variant="caption" color="text.secondary">执行固定 OM</Typography><Link component={RouterLink} to={`/om?commit=${encodeURIComponent(fixedSha)}&executionId=${encodeURIComponent(executionId)}`} display="block" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{fixedSha}</Link></Box>}
    </Stack></AccordionDetails>
  </Accordion>;
}

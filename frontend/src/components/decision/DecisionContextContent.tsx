import { Box, Stack, Typography } from '@mui/material';
import { DecisionMarkdown } from '../shared/DecisionMarkdown';

const labels: Record<string, string> = {
  system: '来源系统', objectId: '来源对象', version: '版本', location: '位置',
  clause: '条款', report: '报告', assessment: '评估项', schema: '采用字段', scope: '范围',
  known: '已知信息', unknown: '尚待确认', impact: '影响', questionFacts: '需要确认的事实',
  notConclusions: '判断边界', subBranches: '判断分支', independentFrom: '与其他问题的关系',
};
/** Present arbitrary Context without changing or inferring its meaning; strings may contain Markdown. */
export function DecisionContextContent({ value }: { value: unknown }) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return <DecisionMarkdown>{value}</DecisionMarkdown>;
  if (Array.isArray(value)) return <Box component="ul" sx={{ pl: 2.5, my: 0, '& > li': { mb: 0.5 } }}>
    {value.map((item, index) => <Box component="li" key={index}><DecisionContextContent value={item} /></Box>)}
  </Box>;
  if (typeof value === 'object') return <Stack spacing={1.5}>
    {Object.entries(value).map(([key, content]) => <Box key={key}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{labels[key] ?? key}</Typography>
      <DecisionContextContent value={content} />
    </Box>)}
  </Stack>;
  return <Typography variant="body2">{String(value)}</Typography>;
}

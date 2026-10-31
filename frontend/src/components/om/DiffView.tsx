import { Box } from '@mui/material';
import { lineDiff } from '../../utils/omRepository';

interface DiffViewProps {
  before: string;
  after: string;
}

export function DiffView({ before, after }: DiffViewProps) {
  const lines = lineDiff(before, after);
  return (
    <Box
      role="table"
      aria-label="文件差异"
      sx={{ fontFamily: 'monospace', fontSize: 12, border: 1, borderColor: 'divider', borderRadius: 1, overflowX: 'auto' }}>

      {lines.map((l, i) =>
      <Box
        role="row"
        key={i}
        sx={{
          display: 'grid',
          gridTemplateColumns: '40px 40px 20px 1fr',
          bgcolor: l.type === 'add' ? 'rgba(46, 125, 50, 0.08)' : l.type === 'del' ? 'rgba(211, 47, 47, 0.08)' : 'transparent'
        }}>

          <Box role="cell" sx={{ color: 'text.disabled', textAlign: 'right', pr: 1 }}>{l.oldNo ?? ''}</Box>
          <Box role="cell" sx={{ color: 'text.disabled', textAlign: 'right', pr: 1 }}>{l.newNo ?? ''}</Box>
          <Box role="cell" aria-label={l.type === 'add' ? '新增' : l.type === 'del' ? '删除' : '未变'} sx={{ color: l.type === 'add' ? 'success.main' : l.type === 'del' ? 'error.main' : 'text.disabled' }}>
            {l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}
          </Box>
          <Box role="cell" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', pr: 1 }}>{l.text || ' '}</Box>
        </Box>
      )}
    </Box>);

}

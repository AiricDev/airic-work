import React, { useState } from 'react';
import { Box, Chip, Link, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { DecisionRequest } from '../../types/workbench';
import type { ContextDependency } from '../../types/platform';
import { usePlatform } from '../../contexts/PlatformContext';
import { dependenciesFor, dependencyStatusColor } from '../../utils/contextDependencies';
import { ContextDependencyDrawer } from './ContextDependencyDrawer';

interface ContextDependencyListProps {
  request: DecisionRequest;
  onOpenEvidence: (id: string) => void;
}

export function ContextDependencyList({ request, onOpenEvidence }: ContextDependencyListProps) {
  const { state } = usePlatform();
  const [open, setOpen] = useState<ContextDependency | null>(null);
  const deps = dependenciesFor(request, state.delegations);

  if (deps.length === 0) {
    return <Typography variant="body2" color="text.secondary">Agent 未记录可展示的 Context 依赖。</Typography>;
  }

  return (
    <>
      <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Table size="small" aria-label="Decision Context 依赖">
          <TableHead>
            <TableRow>
              <TableCell>所需信息</TableCell>
              <TableCell>来源 / 版本</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>影响</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {deps.map((d) =>
            <TableRow key={d.id}>
                <TableCell sx={{ minWidth: 140 }}>
                  <Link
                  component="button"
                  variant="body2"
                  sx={{ textAlign: 'left' }}
                  onClick={() => d.evidenceId ? onOpenEvidence(d.evidenceId) : setOpen(d)}>
                  
                    {d.name}
                  </Link>
                  <Typography variant="caption" color="text.secondary" component="div">{d.kind}</Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  <Typography variant="body2">{d.source}</Typography>
                  {d.version && <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{d.version}</Typography>}
                </TableCell>
                <TableCell>
                  <Chip variant="outlined" color={dependencyStatusColor[d.status]} label={d.status} sx={{ height: 22 }} />
                </TableCell>
                <TableCell sx={{ minWidth: 160 }}>
                  <Typography variant="body2">{d.impact}</Typography>
                  {d.note && <Typography variant="caption" color="text.secondary">{d.note}</Typography>}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
        状态为原型标签，不是完整生命周期。点击名称查看原文、正式记录或授权范围。
      </Typography>
      <ContextDependencyDrawer dependency={open} request={request} onClose={() => setOpen(null)} />
    </>);

}
import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Link,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography } from
'@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import type { EventKind, Execution, ResultStatus } from '../../types/workbench';
import { evidence } from '../../data/evidence';
import { formatTime } from '../../utils/time';

interface ExecutionActivityTabsProps {
  execution: Execution;
  onOpenEvidence: (id: string) => void;
  onOpenRequest: (id: string) => void;
}

const eventMeta: Record<EventKind, {label: string;icon: React.ReactElement;color: 'default' | 'success' | 'warning' | 'info';}> = {
  system: { label: '系统', icon: <SettingsOutlinedIcon />, color: 'default' },
  receipt: { label: '业务回执', icon: <VerifiedOutlinedIcon />, color: 'success' },
  agent: { label: 'Agent 记录', icon: <SmartToyOutlinedIcon />, color: 'info' },
  request: { label: '待决事项', icon: <HelpOutlineIcon />, color: 'warning' },
  human: { label: '人工处理', icon: <PersonOutlineIcon />, color: 'default' },
  resume: { label: '工作继续', icon: <PlayArrowIcon />, color: 'success' }
};

const resultGroups: {status: ResultStatus;title: string;hint: string;}[] = [
{ status: 'confirmed', title: '已确认产物', hint: '有业务回执或人工确认' },
{ status: 'draft', title: '草稿', hint: '尚未写入或未经确认' },
{ status: 'unknown', title: '效果未知', hint: '调用已发起但未收到回执，不能视为成功' }];


const receiptLabels = { confirmed: '已回执', pending: '等待回执', none: '无回执 · 效果未知' } as const;

export function ExecutionActivityTabs({ execution, onOpenEvidence, onOpenRequest }: ExecutionActivityTabsProps) {
  const [tab, setTab] = useState(0);
  const [showLogs, setShowLogs] = useState(false);
  const events = [...execution.events].reverse();

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v: number) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40, '& .MuiTab-root': { minHeight: 40 } }}>
        <Tab label="进展" />
        <Tab label={`结果 (${execution.results.length})`} />
        <Tab label="执行记录" />
      </Tabs>

      {tab === 0 &&
      <Box sx={{ pt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            仅列关键事件。“Agent 记录”为执行方描述，不等同于业务系统回执。
          </Typography>
          <Stack component="ol" spacing={0} sx={{ listStyle: 'none', m: 0, p: 0, mt: 1 }}>
            {events.map((ev) => {
            const meta = eventMeta[ev.kind];
            return (
              <Box component="li" key={ev.id} sx={{ display: 'flex', gap: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ width: 72, flexShrink: 0, pt: 0.25 }}>
                    {formatTime(ev.at)}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                      <Chip variant="outlined" color={meta.color} icon={meta.icon} label={meta.label} />
                      <Typography variant="body2" fontWeight={500}>
                        {ev.title}
                      </Typography>
                    </Stack>
                    {ev.detail &&
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {ev.detail}
                      </Typography>
                  }
                    <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.25 }}>
                      {ev.requestId &&
                    <Link component="button" variant="caption" onClick={() => onOpenRequest(ev.requestId!)}>
                          请求 {ev.requestId}
                        </Link>
                    }
                      {ev.evidenceIds?.map((id) => {
                      const doc = evidence.find((d) => d.id === id);
                      return doc ?
                      <Link key={id} component="button" variant="caption" onClick={() => onOpenEvidence(id)}>
                            证据 {doc.objectId} {doc.version}
                          </Link> :
                      null;
                    })}
                    </Stack>
                  </Box>
                </Box>);

          })}
          </Stack>
        </Box>
      }

      {tab === 1 &&
      <Stack spacing={2} sx={{ pt: 1.5 }}>
          {execution.results.length === 0 &&
        <Typography variant="body2" color="text.secondary">
              尚无可确认的产物。
            </Typography>
        }
          {resultGroups.map((g) => {
          const items = execution.results.filter((r) => r.status === g.status);
          if (items.length === 0) return null;
          return (
            <Box key={g.status}>
                <Typography variant="subtitle2">{g.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {g.hint}
                </Typography>
                <Stack spacing={1} sx={{ mt: 0.75 }}>
                  {items.map((r) =>
                <Box key={r.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.25 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {r.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {r.detail}
                      </Typography>
                      {r.evidenceIds?.map((id) =>
                  <Button key={id} size="small" startIcon={<DescriptionOutlinedIcon />} onClick={() => onOpenEvidence(id)} sx={{ mt: 0.5, px: 0.5 }}>
                          查看 {evidence.find((d) => d.id === id)?.objectId}
                        </Button>
                  )}
                    </Box>
                )}
                </Stack>
              </Box>);

        })}
          <Typography variant="caption" color="text.secondary">
            执行结果与业务完成状态分开；业务完成以业务系统为准。
          </Typography>
        </Stack>
      }

      {tab === 2 &&
      <Box sx={{ pt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" component="p">
            工具调用发起不等于已生效，以回执为准。Runtime：{execution.runtimeVersion}；Skill：{execution.skillVersion}。
          </Typography>
          <Button sx={{ mt: 1 }} variant="outlined" onClick={() => setShowLogs((v) => !v)} aria-expanded={showLogs}>
            {showLogs ? '收起工具调用与回执摘要' : `展开工具调用与回执摘要（${execution.logs.length}）`}
          </Button>
          {showLogs &&
        <Box sx={{ overflowX: 'auto', mt: 1 }}>
              {execution.logs.length === 0 ?
          <Typography variant="body2" color="text.secondary">
                  暂无工具调用记录。
                </Typography> :

          <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>时间</TableCell>
                      <TableCell>工具</TableCell>
                      <TableCell>调用</TableCell>
                      <TableCell>回执</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {execution.logs.map((l) =>
              <TableRow key={l.id}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTime(l.at)}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{l.tool}</TableCell>
                        <TableCell>{l.call}</TableCell>
                        <TableCell>
                          <Chip
                    variant="outlined"
                    color={l.receiptStatus === 'confirmed' ? 'success' : l.receiptStatus === 'pending' ? 'default' : 'warning'}
                    label={receiptLabels[l.receiptStatus]} />
                  
                          <Typography variant="caption" color="text.secondary" component="div">
                            {l.receipt}
                          </Typography>
                        </TableCell>
                      </TableRow>
              )}
                  </TableBody>
                </Table>
          }
            </Box>
        }
        </Box>
      }
    </Box>);

}
import React, { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography } from
'@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SendIcon from '@mui/icons-material/Send';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import type { ChatMessage, DecisionRequest, Execution } from '../../types/workbench';
import { answerQuestion } from '../../utils/askAgent';
import { createId } from '../../utils/decisionService';
import { nowIso } from '../../utils/time';

interface AskExecutionPanelProps {
  execution: Execution;
  requests: DecisionRequest[];
  onLocateRequest: (requestId: string) => void;
}

export function AskExecutionPanel({ execution, requests, onLocateRequest }: AskExecutionPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const send = () => {
    const text = input.trim();
    if (!text || thinking) return;
    setMessages((m) => [...m, { id: createId('msg'), role: 'user', text, at: nowIso() }]);
    setInput('');
    setThinking(true);
    window.setTimeout(() => {
      const reply = answerQuestion(text, execution, requests);
      setMessages((m) => [...m, { id: createId('msg'), role: 'agent', at: nowIso(), ...reply }]);
      setThinking(false);
    }, 700);
  };

  return (
    <Accordion variant="outlined" disableGutters sx={{ '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ChatBubbleOutlineIcon fontSize="small" color="action" />
          <Typography variant="subtitle2">询问执行情况</Typography>
          <Typography variant="caption" color="text.secondary">
            询问不构成正式决定
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.25} aria-live="polite">
          {messages.length === 0 &&
          <Typography variant="body2" color="text.secondary">
              例如：“为什么这部分仍在等待？”答复仅依据已记录的事件和请求；关闭面板不影响后台执行。
            </Typography>
          }
          {messages.map((m) =>
          m.role === 'user' ?
          <Box key={m.id} sx={{ alignSelf: 'flex-end', maxWidth: '85%', bgcolor: 'action.selected', borderRadius: 1.5, px: 1.5, py: 1 }}>
                <Typography variant="body2">{m.text}</Typography>
              </Box> :
          m.kind === 'redirect' ?
          <Alert
            key={m.id}
            severity="warning"
            action={
            m.requestId ?
            <Button color="inherit" onClick={() => onLocateRequest(m.requestId!)}>
                      定位到请求
                    </Button> :
            undefined
            }>
            
                <Typography variant="body2" fontWeight={600}>
                  正式决定请到右侧请求提交
                </Typography>
                {m.text}
              </Alert> :

          <Box key={m.id} sx={{ maxWidth: '90%', border: 1, borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Chip variant="outlined" color="info" label="Agent 说明" />
                  {m.kind === 'unknown' && <Chip variant="outlined" label="无法确认" />}
                </Stack>
                <Typography variant="body2">{m.text}</Typography>
                {m.requestId &&
            <Button size="small" sx={{ mt: 0.5, px: 0.5 }} onClick={() => onLocateRequest(m.requestId!)}>
                    关联请求 {m.requestId}
                  </Button>
            }
              </Box>

          )}
          {thinking &&
          <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                正在依据已记录信息作答…
              </Typography>
            </Stack>
          }
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="询问进展、等待原因或结果"
              inputProps={{ 'aria-label': '询问执行情况' }} />
            
            <IconButton color="primary" aria-label="发送询问" onClick={send} disabled={!input.trim() || thinking}>
              <SendIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            本轮不支持通过对话改变目标、范围、权限或执行方向。
          </Typography>
        </Stack>
      </AccordionDetails>
    </Accordion>);

}
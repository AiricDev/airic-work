import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { api, type Result } from "../../api/client";
import { useApiQuery } from "../../api/useApiQuery";
import type { Execution } from "../../types/workbench";
import { formatTime } from "../../utils/time";
const labels = { read: "读取", write: "写入", unknown: "类型未知" };
export function McpCalls({ execution }: { execution: Execution }) {
  const [filter, setFilter] = useState("all"),
    [cursor, setCursor] = useState<string>(),
    [pages, setPages] = useState<Result<"calls">[]>([]),
    [expanded, setExpanded] = useState<string>();
  const pagesByCursor = useRef(new Map<string, Result<"calls">>());
  const query = useApiQuery(["calls", execution.id, filter, cursor], () =>
    api("calls", {
      params: { id: execution.id },
      query: { type: filter === "all" ? undefined : filter, cursor },
    }),
  );
  const detail = useApiQuery(
    ["call", execution.id, expanded],
    () => api("call", { params: { id: execution.id, callId: expanded! } }),
    !!expanded,
  );
  useEffect(() => {
    if (query.data) {
      pagesByCursor.current.set(cursor ?? "", query.data);
      setPages([...pagesByCursor.current.values()]);
    }
  }, [query.data, cursor]);
  const items = pages.flatMap((p) => p.items);
  return (
    <Stack spacing={1.5} sx={{ pt: 2 }}>
      <Alert severity="info">
        调用来自本执行 Session；参数与返回不自动证明业务操作已完成。
      </Alert>
      <TextField
        select
        label="操作类型"
        value={filter}
        onChange={(e) => {
          pagesByCursor.current.clear();
          setFilter(e.target.value);
          setCursor(undefined);
          setPages([]);
          setExpanded(undefined);
        }}
      >
        <MenuItem value="all">全部调用</MenuItem>
        <MenuItem value="read">读取</MenuItem>
        <MenuItem value="write">写入</MenuItem>
        <MenuItem value="unknown">类型未知</MenuItem>
      </TextField>
      {pages[0] && (
        <Alert severity="warning">
          类型未知：{pages[0].unknownCount ?? "无法完整统计"}
          。写入筛选不能证明其余均为读取。
        </Alert>
      )}
      {pages
        .flatMap((p) => p.limitations)
        .map((s, i) => (
          <Alert key={i} severity="warning">
            {s}
          </Alert>
        ))}
      {(query.error || detail.error) && (
        <Alert severity="error">{query.error ?? detail.error}</Alert>
      )}
      {items.map((l) => (
        <Accordion
          key={l.id}
          disableGutters
          expanded={expanded === l.id}
          onChange={(_, open) => setExpanded(open ? l.id : undefined)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                {formatTime(l.at)} · {l.connection} · {l.tool}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip label={labels[l.type]} />
                <Chip label={l.status} />
              </Stack>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="caption">
              分类来源：{l.classificationSource ?? "未声明"} · {l.id}
            </Typography>
            <Typography variant="subtitle2">工具参数与返回</Typography>
            <Box
              component="pre"
              sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {expanded === l.id && detail.data
                ? JSON.stringify(detail.data, null, 2)
                : "正在读取…"}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
      {!query.loading && !items.length && (
        <Typography>当前筛选下没有调用。</Typography>
      )}
      {pages.some((p) => !p.complete) && (
        <Alert severity="warning">调用历史覆盖不完整。</Alert>
      )}
      {pages.at(-1)?.cursor && (
        <Button
          disabled={query.loading}
          onClick={() => setCursor(pages.at(-1)?.cursor)}
        >
          加载更多
        </Button>
      )}
    </Stack>
  );
}

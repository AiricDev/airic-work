import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { api } from "../../api/client";
import { useApiQuery } from "../../api/useApiQuery";
export function ExecutionConnections({ executionId }: { executionId: string }) {
  const q = useApiQuery(["connections", executionId], () =>
    api("connections", { params: { id: executionId } }),
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function change(id: string, revoke: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (revoke) {
        await api("revoke", { params: { id: executionId, connection: id } });
        setMessage("后台凭据已撤销，已发生的业务效果不会撤回。");
      } else {
        const r = await api("connect", {
          params: { id: executionId, connection: id },
        });
        setMessage(`本执行后台凭据已连接，有效期至 ${r.expiresAt}。`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作结果未确认，请查询或重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">本执行的业务 MCP 连接</Typography>
        <Typography variant="caption">
          使用本人身份换取执行专用后台凭据。工作台退出不会自动撤销它。
        </Typography>
        {q.data?.map((id) => (
          <Stack direction="row" key={id} alignItems="center">
            <Typography sx={{ flex: 1 }}>{id}</Typography>
            <Button disabled={busy} onClick={() => void change(id, false)}>
              连接 / 续期
            </Button>
            <Button disabled={busy} onClick={() => void change(id, true)}>
              撤销
            </Button>
          </Stack>
        ))}
        {q.data?.length === 0 && (
          <Typography variant="body2">实例尚未启用业务连接。</Typography>
        )}
        {(q.error || error) && (
          <Alert severity="error">{q.error || error}</Alert>
        )}
        {message && <Alert severity="info">{message}</Alert>}
      </Stack>
    </Paper>
  );
}

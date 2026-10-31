import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import type {
  DecisionRequest,
  Execution,
  PrototypeFile,
} from "../../types/workbench";
import { FileInput } from "../FileInput";
/** A pending network outcome keeps the original command frozen, including after reload. */
export function AskExecutionPanel({
  execution,
}: {
  execution: Execution;
  requests: DecisionRequest[];
  onLocateRequest: (id: string) => void;
}) {
  const { sendSteering, currentUser } = useWorkbench();
  const storageKey = `airic-steering:${currentUser.id}:${execution.id}`;
  type Command = {
    text: string;
    files: PrototypeFile[];
    key: string;
  };
  const initial = () => {
    try {
      return JSON.parse(
        localStorage.getItem(storageKey) ?? "null",
      ) as Command | null;
    } catch {
      return null;
    }
  };
  const [pending, setPending] = useState<Command | null>(initial),
    [text, setText] = useState(() => initial()?.text ?? ""),
    [files, setFiles] = useState<PrototypeFile[]>(() => initial()?.files ?? []),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  async function send() {
    const command = pending ?? { text, files, key: crypto.randomUUID() };
    setPending(command);
    setBusy(true);
    setError("");
    try {
      localStorage.setItem(storageKey, JSON.stringify(command));
      await sendSteering(
        execution.id,
        command.text,
        command.files,
        command.key,
      );
      localStorage.removeItem(storageKey);
      setPending(null);
      setText("");
      setFiles([]);
      setNotice("消息已保存；Runtime 接收、Agent 继续和业务完成请分别查看。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "结果未知，请同键重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">
          向 Agent 发消息 · Steering Input
        </Typography>
        <Typography variant="caption">
          补充指示、询问或提供文件。不会自动回答
          DecisionRequest；结束后的续行沿用原 Session 和 OM。
        </Typography>
        <TextField
          multiline
          minRows={2}
          label="工作消息"
          disabled={busy || !!pending}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <BoxedFiles disabled={busy || !!pending}>
          <FileInput
            executionId={execution.id}
            files={files}
            onChange={setFiles}
          />
        </BoxedFiles>
        <Button
          variant="contained"
          disabled={busy || (!text.trim() && !files.length)}
          onClick={() => void send()}
        >
          {pending ? "确认原消息（同键重试）" : "发送消息"}
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
        {pending && (
          <Alert severity="warning">
            原消息结果尚未确认，内容与幂等键保持固定。
          </Alert>
        )}
        {notice && <Alert severity="success">{notice}</Alert>}
      </Stack>
    </Paper>
  );
}
function BoxedFiles({
  disabled,
  children,
}: {
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
      {children}
    </fieldset>
  );
}

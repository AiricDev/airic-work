import { Alert, Stack, TextField, Typography } from "@mui/material";
import { usePlatform } from "../../contexts/PlatformContext";
import { useSettingsForm } from "../../hooks/useSettingsForm";
import { UnsavedChangesDialog } from "../UnsavedChangesDialog";
import { SettingsActions } from "./SettingsActions";
/** Keep the original business-connection settings section; endpoints/secrets remain host owned. */
export function BusinessSection() {
  const { settings, configure } = usePlatform();
  const form = useSettingsForm(
    {
      version: settings?.version,
      connections: settings?.connections.join(",") ?? "",
    },
    (v) =>
      configure(
        {
          connections: v.connections
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        v.version,
      ),
  );
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" component="h2">
        业务连接（业务 MCP）
      </Typography>
      <Typography variant="body2" color="text.secondary">
        业务 MCP、Git 与只读轨迹 MCP
        分开配置。每个执行使用归属人的专用后台凭据。
      </Typography>
      <Alert severity="info">
        MCP Endpoint、签发/撤销接口、身份来源和密钥统一由宿主 dotenv
        配置。这里只选择宿主允许的连接 ID。
      </Alert>
      <TextField
        label="MCP Endpoint"
        value="由宿主配置"
        InputProps={{ readOnly: true }}
      />
      <TextField
        label="身份来源"
        value="集成方用户身份"
        InputProps={{ readOnly: true }}
      />
      <TextField
        label="启用的连接 ID"
        value={form.value.connections}
        onChange={(e) => form.set({ connections: e.target.value })}
        helperText="多个 ID 用逗号分隔；服务端验证允许列表。"
      />
      <SettingsActions
        dirty={form.dirty}
        result={form.result}
        onSave={form.save}
        onRevert={form.revert}
      />
      <Typography variant="subtitle1" component="h2">
        标准任务与决策 API 接入
      </Typography>
      <Alert severity="info">
        API 使用 /api/v1。业务系统携带集成方 Bearer token
        创建执行；网页使用工作台会话。连接、续期及撤销在本执行的业务连接区完成。
      </Alert>
      <UnsavedChangesDialog
        blocker={form.blocker}
        onSave={async () => (await form.save()).ok}
        onDiscard={form.revert}
      />
    </Stack>
  );
}

import { Alert, Button, Link, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { api } from "../api/client";
import type { PrototypeFile } from "../types/workbench";
export type { PrototypeFile } from "../types/workbench";
export function FileInput({
  files,
  onChange,
  executionId,
}: {
  files: PrototypeFile[];
  onChange: (files: PrototypeFile[]) => void;
  executionId: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Stack spacing={1}>
      <Button component="label" variant="outlined" disabled={busy}>
        {busy ? "上传中…" : "上传文件（可选）"}
        <input
          hidden
          multiple
          type="file"
          onChange={async (e) => {
            const selected = Array.from(e.target.files ?? []);
            e.target.value = "";
            setBusy(true);
            setError("");
            const added: PrototypeFile[] = [];
            try {
              for (const f of selected) {
                if (f.size > 20 * 1024 * 1024)
                  throw new Error("单文件不能超过 20 MiB");
                const body = new FormData();
                body.append("file", f);
                const upload = await api("upload", {
                  params: { id: executionId },
                  body,
                });
                added.push({
                  id: upload.id,
                  name: upload.name,
                  size: upload.size,
                  content: `/api/v1/input-files/${encodeURIComponent(upload.id)}/content`,
                });
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : "上传失败");
            } finally {
              if (added.length) onChange([...files, ...added]);
              setBusy(false);
            }
          }}
        />
      </Button>
      {files.map((f, i) => (
        <Typography key={f.id ?? i}>
          <Link href={f.content} download={f.name}>
            {f.name}
          </Link>{" "}
          · {f.size} bytes{" "}
          <Button
            disabled={busy}
            size="small"
            onClick={() => onChange(files.filter((_, j) => j !== i))}
          >
            移除
          </Button>
        </Typography>
      ))}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

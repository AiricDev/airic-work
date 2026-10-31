import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkbench } from "../contexts/WorkbenchContext";
function safeReturnTo(value: string | null) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/login")
    ? value
    : "/projects";
}
/** Original login card with trusted token handoff; no demo user selector. */
export function Login() {
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const wb = useWorkbench();
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const returnTo = safeReturnTo(params.get("returnTo"));
  useEffect(() => {
    if (wb.identity) navigate(returnTo, { replace: true });
  }, [wb.identity, navigate, returnTo]);
  async function enter() {
    setBusy(true);
    setError("");
    const value = token;
    setToken("");
    try {
      await wb.signIn(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "接入失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        width: "100%",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper variant="outlined" sx={{ width: "100%", maxWidth: 440, p: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1" fontWeight={700}>
            Airic Work
          </Typography>
          <Typography variant="body2" color="text.secondary">
            请从业务系统进入，工作台沿用集成方身份。
          </Typography>
          {wb.authLoading && <Typography>正在确认身份…</Typography>}
          {import.meta.env.DEV && (
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                void enter();
              }}
            >
              <TextField
                fullWidth
                label="集成方 token（仅开发联调）"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                sx={{ mt: 2 }}
                disabled={busy || !token}
              >
                进入工作台
              </Button>
            </Box>
          )}
          {(error || wb.error) && (
            <Alert severity="error">{error || wb.error}</Alert>
          )}
          {returnTo !== "/projects" && (
            <Typography variant="caption">进入后将返回：{returnTo}</Typography>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

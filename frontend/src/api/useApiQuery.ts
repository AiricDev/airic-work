import { useEffect, useRef, useState } from "react";
/** Query lifecycle for original components. Resource changes clear data; refresh failures keep that resource's last result. */
export function useApiQuery<T>(
  key: unknown[],
  read: () => Promise<T>,
  enabled = true,
) {
  const serialized = JSON.stringify(key);
  const latest = useRef(read);
  latest.current = read;
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: string;
    loading: boolean;
  }>({ key: serialized, loading: enabled });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((r) => r + 1);
    window.addEventListener("airic:invalidate", refresh);
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("airic:invalidate", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState({ key: serialized, loading: false });
      return;
    }
    setState((s) =>
      s.key === serialized
        ? { ...s, loading: !s.data, error: undefined }
        : { key: serialized, loading: true },
    );
    void latest
      .current()
      .then((data) => {
        if (active) setState({ key: serialized, data, loading: false });
      })
      .catch((e) => {
        if (active)
          setState((s) => ({
            ...(s.key === serialized ? s : {}),
            key: serialized,
            error: e instanceof Error ? e.message : "读取失败",
            loading: false,
          }));
      });
    return () => {
      active = false;
    };
  }, [serialized, enabled, revision]);
  return {
    ...(state.key === serialized
      ? state
      : { loading: enabled, data: undefined, error: undefined }),
    reload: () => setRevision((r) => r + 1),
  };
}

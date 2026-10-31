import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, ApiError, resetIdentity, type Result } from "../api/client";
import { readDrafts, writeDrafts } from "../api/drafts";
import {
  decisionView,
  executionView,
  projectView,
  requestView,
  userView,
} from "../api/views";
import type {
  Draft,
  LookupResult,
  PrototypeFile,
  SubmitOutcome,
  WorkbenchState,
} from "../types/workbench";
const emptyState: WorkbenchState = {
  userId: "",
  executions: [],
  requests: [],
  viewed: {},
  settings: {
    submitMode: "normal",
    evidenceUnavailable: true,
    cancelDelayed: false,
    connectionLostAt: null,
    briefLoadFail: false,
    sessionExpired: false,
  },
};
/** Existing UI context backed by server queries. Only drafts/viewed revisions are local state. */
function useProvideWorkbench() {
  const [state, setState] = useState<WorkbenchState>(emptyState);
  const [projects, setProjects] = useState<ReturnType<typeof projectView>[]>(
    [],
  );
  const [identity, setIdentity] = useState<Result<"me"> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true),
    [authLoading, setAuthLoading] = useState(true),
    [error, setError] = useState("");
  const [draftError, setDraftError] = useState("");
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const generation = useRef(0),
    refreshing = useRef<number | null>(null);
  const clearIdentity = useCallback(() => {
    generation.current++;
    resetIdentity();
    identityRef.current = null;
    setIdentity(null);
    setState(emptyState);
    setProjects([]);
    setDrafts({});
    setAuthLoading(false);
    setLoading(false);
  }, []);
  const refresh = useCallback(async () => {
    if (!identityRef.current || refreshing.current === generation.current)
      return;
    const epoch = generation.current,
      owner = identityRef.current;
    refreshing.current = epoch;
    try {
      const es: Result<"executions">["items"] = [],
        ps: Result<"projects">["items"] = [],
        rs: Result<"requests">["items"] = [];
      let cursor: string | undefined;
      do {
        const p = await api("executions", { query: { cursor, limit: "100" } });
        es.push(...p.items);
        cursor = p.cursor;
      } while (cursor);
      cursor = undefined;
      do {
        const p: Result<"projects"> = await api("projects", {
          query: { cursor, limit: "100" },
        });
        ps.push(...p.items);
        cursor = p.cursor;
      } while (cursor);
      cursor = undefined;
      do {
        const p: Result<"requests"> = await api("requests", {
          query: { cursor, limit: "100" },
        });
        rs.push(...p.items);
        cursor = p.cursor;
      } while (cursor);
      const executions = es.map(executionView);
      const requests = await Promise.all(
        rs.map(async (r) => {
          const [decisions, inputs] = await Promise.all([
            api("decisions", { params: { id: r.id } }),
            api("inputs", { params: { id: r.executionId } }),
          ]);
          const view = requestView(
            r,
            executions.find((e) => e.id === r.executionId)!,
            owner.name,
            decisions,
            inputs,
          );
          for (const decision of [
            ...(view.decisionHistory ?? []),
            ...(view.userDecision ? [view.userDecision] : []),
          ]) {
            decision.files = await Promise.all(
              (decision.files ?? []).map(async (f) => {
                try {
                  const meta = await api("file", { params: { id: f.id! } });
                  return { ...f, name: meta.name, size: meta.size };
                } catch {
                  return f;
                }
              }),
            );
          }
          return view;
        }),
      );
      if (epoch !== generation.current) return;
      setProjects(ps.map(projectView));
      setState((s) => ({
        ...s,
        userId: owner.id,
        executions,
        requests,
        settings: { ...s.settings, connectionLostAt: null },
      }));
      setError("");
    } catch (e) {
      if (epoch === generation.current) {
        setError(e instanceof Error ? e.message : "读取失败");
        setState((s) => ({
          ...s,
          settings: {
            ...s.settings,
            connectionLostAt:
              s.settings.connectionLostAt ?? new Date().toISOString(),
          },
        }));
      }
    } finally {
      if (refreshing.current === epoch) refreshing.current = null;
      if (epoch === generation.current) setLoading(false);
    }
  }, []);
  const acceptIdentity = useCallback((user: Result<"me">) => {
    generation.current++;
    identityRef.current = user;
    setIdentity(user);
    setProjects([]);
    setState({ ...emptyState, userId: user.id });
    setDrafts(readDrafts(user.id));
    setLoading(true);
    setAuthLoading(false);
  }, []);
  useEffect(() => {
    let active = true;
    const lost = () => clearIdentity();
    const ready = () => {
      void api("session")
        .then((s) => {
          if (active) acceptIdentity(s.user);
        })
        .catch(() => {});
    };
    window.addEventListener("airic:identity-lost", lost);
    window.addEventListener("airic:session-ready", ready);
    void api("session")
      .then((s) => {
        if (active) acceptIdentity(s.user);
      })
      .catch((e) => {
        if (active) {
          setAuthLoading(false);
          setLoading(false);
          if (!(e instanceof ApiError && e.status === 401)) setError(e.message);
        }
      });
    return () => {
      active = false;
      window.removeEventListener("airic:identity-lost", lost);
      window.removeEventListener("airic:session-ready", ready);
    };
  }, [acceptIdentity, clearIdentity]);
  useEffect(() => {
    if (!identity) return;
    void refresh();
    const invalidate = () => void refresh();
    const interval = setInterval(invalidate, 15000);
    window.addEventListener("focus", invalidate);
    window.addEventListener("airic:invalidate", invalidate);
    const stream = new EventSource("/api/v1/stream");
    stream.addEventListener("invalidate", () =>
      window.dispatchEvent(new Event("airic:invalidate")),
    );
    stream.addEventListener("identity-lost", clearIdentity);
    return () => {
      clearInterval(interval);
      stream.close();
      window.removeEventListener("focus", invalidate);
      window.removeEventListener("airic:invalidate", invalidate);
    };
  }, [identity, refresh, clearIdentity]);
  const persist = useCallback((next: Record<string, Draft>) => {
    draftsRef.current = next;
    setDrafts(next);
    if (identityRef.current)
      try {
        writeDrafts(identityRef.current.id, next);
        setDraftError("");
      } catch {
        setDraftError("草稿无法保存到浏览器，请勿刷新或关闭页面。");
      }
  }, []);
  const saveDraft = useCallback(
    (d: Draft) => persist({ ...draftsRef.current, [d.requestId]: d }),
    [persist],
  );
  const discardDraft = useCallback(
    (id: string) => {
      const next = { ...draftsRef.current };
      delete next[id];
      persist(next);
    },
    [persist],
  );
  const submitUserDecision = useCallback(
    async (id: string, draft: Draft): Promise<SubmitOutcome> => {
      const option = state.requests
        .find((r) => r.id === id)
        ?.brief.options.find((o) => o.id === draft.choiceId);
      const payload = draft.pending ?? {
        contextRevision: draft.baseVersion,
        text: [
          draft.action === "judgment"
            ? draft.reason
            : draft.action === "investigation"
              ? draft.investigation
              : draft.fact,
          draft.factSource,
          draft.note,
        ]
          .filter((s) => s?.trim())
          .join("\n\n"),
        files: (draft.files ?? []).map((f) => f.id!).filter(Boolean),
        ...(option ? { optionId: option.id } : {}),
        ...(draft.correctionOf ? { correctionOf: draft.correctionOf } : {}),
      };
      saveDraft({ ...draft, pending: payload });
      try {
        const d = await api("answer", {
          params: { id },
          body: payload,
          key: draft.idempotencyKey,
        });
        const raw = await api("request", { params: { id } });
        const value = decisionView(
          d,
          raw,
          identityRef.current?.name ?? d.userId,
          draft.idempotencyKey,
        );
        discardDraft(id);
        await refresh();
        return { kind: "accepted", userDecision: value };
      } catch (e) {
        if (
          e instanceof ApiError &&
          [400, 403, 404, 409, 413].includes(e.status)
        ) {
          saveDraft({ ...draft, pending: undefined });
          return { kind: "failed", message: e.message };
        }
        return { kind: "unknown" };
      }
    },
    [state.requests, saveDraft, discardDraft, refresh],
  );
  const currentUser = useMemo(
    () =>
      userView(
        identity ?? {
          id: "",
          name: "",
          enabled: true,
          admin: false,
          version: 0,
        },
        projects.map((p) => p.id),
      ),
    [identity, projects],
  );
  return {
    state,
    projects,
    identity,
    currentUser,
    drafts,
    loading,
    authLoading,
    error,
    draftError,
    refresh,
    saveDraft,
    discardDraft,
    submitUserDecision,
    markViewed: (id: string) =>
      setState((s) => ({
        ...s,
        viewed: {
          ...s.viewed,
          [id]: s.requests.find((r) => r.id === id)?.version ?? 1,
        },
      })),
    lookupSubmission: async (
      id: string,
      _key: string,
    ): Promise<LookupResult> => {
      const d = draftsRef.current[id];
      if (!d) return { status: "notFound" };
      const r = await submitUserDecision(id, d);
      return r.kind === "accepted" || r.kind === "duplicate"
        ? { status: "found", userDecision: r.userDecision }
        : { status: "notFound" };
    },
    requestCancel: async (id: string) => {
      await api("cancel", { params: { id } });
      await refresh();
    },
    queryCancel: refresh,
    sendSteering: async (
      id: string,
      text: string,
      files: PrototypeFile[] = [],
      key: string = crypto.randomUUID(),
    ) => {
      await api("steering", {
        params: { id },
        body: { text, files: files.map((f) => f.id) },
        key,
      });
      await refresh();
    },
    signIn: async (token: string) => {
      const s = await api("login", { token });
      acceptIdentity(s.user);
    },
    signOut: async () => {
      await api("logout");
      clearIdentity();
    },
    reloadIdentity: async () => {
      const s = await api("session");
      identityRef.current = s.user;
      setIdentity(s.user);
    },
  };
}
type WorkbenchValue = ReturnType<typeof useProvideWorkbench>;
const WorkbenchContext = createContext<WorkbenchValue | null>(null);
export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
  const value = useProvideWorkbench();
  return (
    <WorkbenchContext.Provider value={value}>
      {children}
    </WorkbenchContext.Provider>
  );
}
export function useWorkbench() {
  const c = useContext(WorkbenchContext);
  if (!c) throw new Error("WorkbenchProvider required");
  return c;
}

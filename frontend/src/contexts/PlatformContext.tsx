import React, { createContext, useContext, useEffect, useState } from "react";
import { api, type Result } from "../api/client";
import { userView } from "../api/views";
import type {
  ActionResult,
  BusinessConnection,
  GeneralSettings,
  OMSourceConfig,
  TestResult,
  TrajectoryMcpPolicy,
  UserPreference,
} from "../types/platform";
import type { DemoUser } from "../types/workbench";
import { useWorkbench } from "./WorkbenchContext";
export interface Responsibilities {
  executions: number;
  requests: number;
}
export interface McpReadRequest {
  grantId: string;
  resource: string;
  executionId: string;
  page: number;
}
const unavailable = (): ActionResult => ({
  ok: false,
  message: "此能力尚未接入；没有保存或执行任何操作。",
});
const preference: UserPreference = {
  language: "zh-CN",
  timezone: "Asia/Shanghai",
  notify: { decision: true, anomaly: true, result: true },
};
function useProvidePlatform() {
  const wb = useWorkbench();
  const [users, setUsers] = useState<DemoUser[]>([]),
    [settings, setSettings] = useState<Result<"settings">>();
  const [status, setStatus] = useState<Result<"methodStatus">>();
  const [snapshot, setSnapshot] = useState<Result<"methodSnapshot">>();
  const [gitTest, setGitTest] = useState<TestResult | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setUsers([]);
    setSettings(undefined);
    setSnapshot(undefined);
    setStatus(undefined);
    setError("");
    if (!wb.identity) return;
    async function read() {
      try {
        if (wb.identity?.admin) {
          const all: DemoUser[] = [];
          let cursor: string | undefined;
          do {
            const p = await api("users", { query: { cursor, limit: "100" } });
            all.push(...p.items.map((u) => userView(u)));
            cursor = p.cursor;
          } while (cursor);
          const s = await api("settings");
          if (active) {
            setUsers(all);
            setSettings(s);
          }
        }
        const s = await api("methodStatus");
        if (active) setStatus(s);
        try {
          const m = await api("methodSnapshot");
          if (active) setSnapshot(m);
        } catch {
          /* Unconfirmed OM has an explicit empty state in its page. */
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "读取失败");
      }
    }
    void read();
    const t = setInterval(() => void read(), 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [wb.identity?.id, wb.identity?.admin]);
  const run = async (work: () => Promise<unknown>): Promise<ActionResult> => {
    try {
      await work();
      return { ok: true, message: "已保存。" };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "操作失败",
      };
    }
  };
  const configure = async (
    change: Partial<Result<"settings">>,
    expected = settings?.version,
  ) => {
    if (!settings) return unavailable();
    return run(async () => {
      const s = await api("configure", {
        body: { ...settings, ...change, expected, version: undefined },
      });
      setSettings(s);
    });
  };
  const manage = async (id: string, body: unknown) =>
    run(async () => {
      const u = await api("manage", { params: { id }, body });
      setUsers((us) => us.map((v) => (v.id === id ? userView(u) : v)));
      if (id === wb.identity?.id) await wb.reloadIdentity();
    });
  const account = wb.currentUser;
  const state = {
    users: users.length ? users : wb.identity ? [account] : [],
    identities: [] as import("../types/platform").BusinessIdentity[],
    delegations: [] as import("../types/platform").Delegation[],
    grants: [] as import("../types/platform").ExternalClientGrant[],
    readLogs: [] as import("../types/platform").McpReadLog[],
    audit: [] as import("../types/platform").AuditRecord[],
    notifications: [] as import("../types/platform").AppNotification[],
    preferences: {},
    omSource: {
      version: settings?.version,
      root: settings?.root,
      hostType: "宿主配置",
      repo: settings?.omSource ?? status?.source ?? "",
      repoUrl: "",
      branch: settings?.branch ?? "",
      credentialRef: "",
    } as OMSourceConfig,
    omSync: {
      latestConfirmedSha: snapshot?.sha ?? "",
      lastSuccessAt: "",
      lastAttempt:
        null as import("../types/platform").OMSyncState["lastAttempt"],
    },
    gitTest,
    syncRecords: [] as import("../types/platform").SyncRecord[],
    business: {
      sourceId: "",
      displayName: "业务 MCP",
      jumpTemplate: "",
      mcpEndpoint: "由宿主配置",
      identitySource: "集成方身份",
      credentialRef: "",
    } as BusinessConnection,
    businessTest: null,
    mcpPolicy: {
      enabled: false,
      recordScope: "",
      redaction: "",
      pageSize: 100,
    } as TrajectoryMcpPolicy,
    general: { orgName: "", timezone: "Asia/Shanghai" } as GeneralSettings,
    demo: {
      gitSyncFail: false,
      trajectoryMissing: false,
      mcpReadDenied: false,
      connectionTestFailure: "none" as const,
    },
    signedOut: !wb.identity,
  };
  return {
    state,
    account,
    isAdmin: !!wb.identity?.admin,
    preference: (wb.identity?.preferences ?? preference) as UserPreference,
    error,
    settings,
    status,
    syncOM: async () => {
      if (!status?.sync.enabled)
        return {
          ok: false,
          message: status?.sync.message ?? "当前来源不可同步",
        };
      return run(async () => {
        setSnapshot(await api("methodSync"));
        await wb.refresh();
      });
    },
    saveOMSource: async (v: OMSourceConfig) =>
      configure(
        { omSource: v.repo, branch: v.branch, root: v.root },
        v.version,
      ),
    testBusiness: async () => ({
      at: new Date().toISOString(),
      ok: false,
      message: "连接端点由宿主配置，未执行连通测试。",
    }),
    testGit: async () => {
      try {
        const s = await api("methodStatus");
        setStatus(s);
        const r = {
          at: new Date().toISOString(),
          ok: true,
          message: s.sync.message ?? "已读取本地连接配置；未测试远端认证。",
        };
        setGitTest(r);
        return r;
      } catch (e) {
        const r = {
          at: new Date().toISOString(),
          ok: false,
          message: e instanceof Error ? e.message : "读取失败",
        };
        setGitTest(r);
        return r;
      }
    },
    saveProfile: async (name: string) =>
      run(async () => {
        await api("profile", { body: { name } });
        await wb.reloadIdentity();
      }),
    savePreference: async (v: UserPreference) =>
      run(async () => {
        await api("preferences", { body: v });
        await wb.reloadIdentity();
      }),
    configure,
    changeRole: async (id: string, role: DemoUser["systemRole"]) =>
      manage(id, { admin: role === "admin" }),
    setUserStatus: async (
      id: string,
      status: DemoUser["status"],
      _r?: Responsibilities,
    ) => manage(id, { enabled: status === "active" }),
    saveGeneral: (_v: GeneralSettings) => unavailable(),
    saveBusiness: (_v: BusinessConnection) => unavailable(),
    saveMcpPolicy: (_v: TrajectoryMcpPolicy) => unavailable(),
    createUser: (_v: unknown) => unavailable(),
    updateUserName: (_id: string, _name: string) => unavailable(),
    addIdentity: (_v: unknown) => unavailable(),
    removeIdentity: (_id: string) => unavailable(),
    verifyIdentity: async (_id: string) => unavailable(),
    reauthorize: async (_id: string) => unavailable(),
    revokeDelegation: (_id: string) => unavailable(),
    testDelegation: async (_id: string) => unavailable(),
    expireDelegation: (_id: string) => {},
    renewGrant: async (_id: string) => unavailable(),
    revokeGrant: (_id: string) => unavailable(),
    mcpRead: async (_r: McpReadRequest) => unavailable(),
    markRead: (_id: string) => {},
    markAllRead: () => {},
    signIn: wb.signIn,
    signOut: wb.signOut,
  };
}
type PlatformValue = ReturnType<typeof useProvidePlatform>;
const PlatformContext = createContext<PlatformValue | null>(null);
export function PlatformProvider({ children }: { children: React.ReactNode }) {
  return (
    <PlatformContext.Provider value={useProvidePlatform()}>
      {children}
    </PlatformContext.Provider>
  );
}
export function usePlatform() {
  const v = useContext(PlatformContext);
  if (!v) throw new Error("PlatformProvider required");
  return v;
}
export const grantActive = () => false;

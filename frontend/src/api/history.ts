import type { Execution } from "../types/workbench";
import { api } from "./client";
/** Only actual Session entries, never generated from control state. */
export async function loadHistory(id: string) {
  const events: Execution["events"] = [],
    limitations: string[] = [];
  let cursor: string | undefined;
  do {
    const p = await api("history", { params: { id }, query: { cursor } });
    events.push(
      ...p.items.map((e) => ({
        id: e.id,
        at: e.at,
        kind:
          e.kind === "assistant"
            ? ("agent" as const)
            : e.kind === "user"
              ? ("human" as const)
              : ("system" as const),
        title: e.kind,
        detail: JSON.stringify(e.data, null, 2),
        requestId: e.requestId,
      })),
    );
    limitations.push(...p.limitations);
    if (!p.complete) limitations.push("Session 覆盖不完整");
    cursor = p.cursor;
  } while (cursor);
  return { events, limitations };
}

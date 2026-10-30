import type { Execution, EventKind } from '../types/workbench';
import type { Confirmation, TrajectoryEvent, TrajectoryType } from '../types/platform';
const kindMap: Record<EventKind, {type: TrajectoryType;confirmation: Confirmation}> = {
  system: {type:'system',confirmation:'权威回执'}, receipt:{type:'receipt',confirmation:'权威回执'},
  agent:{type:'action',confirmation:'Agent 描述'},request:{type:'request',confirmation:'权威回执'},
  human:{type:'intervention',confirmation:'人工记录'},resume:{type:'action',confirmation:'Agent 描述'}
};
export const trajectoryTypeLabels: Record<TrajectoryType,string> = {action:'动作',observation:'观察',receipt:'工具返回',intervention:'用户输入',request:'DecisionRequest',system:'系统'};
export function trajectoryFor(execution: Execution, hideGap: boolean): {events:TrajectoryEvent[];gapNote:string|null} {
  const events: TrajectoryEvent[] = execution.events.map(e=>({id:e.id,executionId:execution.id,at:e.at,type:kindMap[e.kind].type,confirmation:kindMap[e.kind].confirmation,summary:e.title,input:e.detail,requestId:e.requestId,episodeId:e.requestId ? `EP-${e.requestId.replace('DR-','')}` : undefined,sensitivity:'normal',evidenceIds:e.evidenceIds}));
  events.push(...execution.logs.map(l=>({id:l.id,executionId:execution.id,at:l.at,type:'action' as const,confirmation:l.receiptStatus==='confirmed'?'权威回执' as const:'未确认' as const,summary:l.tool,input:l.call,output:l.receipt,sensitivity:'normal' as const})));
  return {events:events.sort((a,b)=>a.at.localeCompare(b.at)),gapNote:hideGap?'模拟历史缺失：当前记录不保证覆盖完整执行。':null};
}

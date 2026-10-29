import type { ChatMessage, DecisionRequest, Execution } from '../types/workbench';
import { formatTime } from './time';

type AgentReply = Pick<ChatMessage, 'text' | 'kind' | 'requestId'>;

const AUTHORIZATION_PATTERN = /(同意|批准|授权|继续吧|可以继续|就这样|通过|接受|按建议|没问题)/;

export function answerQuestion(question: string, execution: Execution, requests: DecisionRequest[]): AgentReply {
  const pending = requests.filter((r) => r.executionId === execution.id && r.status === 'pending');
  if (AUTHORIZATION_PATTERN.test(question)) {
    return {
      kind: 'redirect',
      text: '这条消息不会被记录为正式决定，也不会改变执行。若要作出判断或授权，请在右侧对应请求中提交。',
      requestId: pending[0]?.id
    };
  }
  if (/(为什么|等待|卡住|阻塞|在等|停)/.test(question)) {
    if (pending.length === 0) {
      return { kind: 'answer', text: '根据已记录的事件，目前没有等待人工处理的事项。' };
    }
    const r = pending[0];
    return {
      kind: 'answer',
      text: `目前有 ${pending.length} 项工作在等待人工处理。「${r.waitingItem}」等待的是 ${r.id}：${r.question} 触发原因：${r.brief.trigger} 不依赖该事项的工作（${r.brief.continuing.join('、')}）仍可继续。`,
      requestId: r.id
    };
  }
  if (/(进展|在做|做什么|进度|现在)/.test(question)) {
    const last = execution.events[execution.events.length - 1];
    const doing = execution.summary.doing.join('；') || '尚无可确认信息';
    return {
      kind: 'answer',
      text: `最近一条已记录事件：「${last?.title ?? '无'}」（${last ? formatTime(last.at) : '—'}）。当前正在进行：${doing}。`
    };
  }
  if (/(结果|产物|完成|做完)/.test(question)) {
    const confirmed = execution.results.filter((r) => r.status === 'confirmed').map((r) => r.title);
    const unknown = execution.results.filter((r) => r.status === 'unknown').map((r) => r.title);
    return {
      kind: 'answer',
      text: `已确认产物：${confirmed.join('、') || '无'}。效果未知：${unknown.join('、') || '无'}。业务完成状态请以业务系统为准。`
    };
  }
  return {
    kind: 'unknown',
    text: '已记录的事件和请求中没有能回答这个问题的依据，因此无法确认。你可以查看「执行记录」或在业务系统中核实。'
  };
}
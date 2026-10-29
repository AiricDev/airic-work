import type { ActionType, RequestKind } from '../types/workbench';

export const actionLabels: Record<ActionType, string> = {
  fact: '补充事实',
  judgment: '提供专业判断',
  authorization: '提供授权',
  investigation: '请求进一步调查'
};

export const actionDescriptions: Record<ActionType, string> = {
  fact: '提供缺失的事实及其来源',
  judgment: '在候选方案中作出选择并说明理由',
  authorization: '在列明的对象、动作与范围内授权',
  investigation: '说明需要 Agent 继续调查的问题；不视为原事项已解决'
};

export const submitLabels: Record<ActionType, string> = {
  fact: '提交事实',
  judgment: '提交判断',
  authorization: '提交授权',
  investigation: '提交调查请求'
};

export const requestKindLabels: Record<RequestKind, string> = {
  judgment: '专业判断',
  fact: '补充事实',
  authorization: '授权'
};
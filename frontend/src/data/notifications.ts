import type { AppNotification } from '../types/platform';
import { minutesAgo } from '../utils/time';

export const seedNotifications: AppNotification[] = [
{ id: 'N-01', userId: 'u-zhang', kind: 'decision', title: '新增待决事项', detail: 'DR-1047 例外材料有效性判断', link: '/executions/EX-7F3A21?request=DR-1047', at: minutesAgo(40), read: false },
{ id: 'N-02', userId: 'u-zhang', kind: 'anomaly', title: '执行出现效果未知的调用', detail: 'EX-7F3A21 · certlab.send_notice 未收到回执', link: '/executions/EX-7F3A21/trajectory', at: minutesAgo(41), read: false },
{ id: 'N-03', userId: 'u-zhang', kind: 'result', title: '执行结果更新', detail: 'EX-7F3A21 · 申请人营业执照有效性核对已确认', link: '/executions/EX-7F3A21', at: minutesAgo(94), read: true },
{ id: 'N-04', userId: 'u-chen', kind: 'anomaly', title: 'OM 同步曾失败', detail: '来源分支 main 同步超时；已在后续同步中确认', link: '/om/history', at: minutesAgo(3100), read: false }];
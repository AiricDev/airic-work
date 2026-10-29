import type { DemoUser } from '../types/workbench';
import { minutesAgo } from '../utils/time';

export const demoUsers: DemoUser[] = [
{
  id: 'u-zhang',
  name: '张敏',
  role: '专业审核员',
  email: 'zhangmin@demo.invalid',
  systemRole: 'member',
  status: 'active',
  lastLoginAt: minutesAgo(15),
  visibleProjectIds: ['p-meter', 'p-charger', 'p-device'],
  canRequestCancel: true
},
{
  id: 'u-li',
  name: '李卫',
  role: '项目观察者（无处理权限）',
  email: 'liwei@demo.invalid',
  systemRole: 'member',
  status: 'active',
  lastLoginAt: minutesAgo(1440),
  visibleProjectIds: ['p-meter', 'p-charger'],
  canRequestCancel: false
},
{
  id: 'u-wang',
  name: '王芳',
  role: '业务审核员',
  email: 'wangfang@demo.invalid',
  systemRole: 'member',
  status: 'active',
  lastLoginAt: minutesAgo(300),
  visibleProjectIds: ['p-charger'],
  canRequestCancel: true
},
{
  id: 'u-chen',
  name: '陈立',
  role: '平台管理员',
  email: 'chenli@demo.invalid',
  systemRole: 'admin',
  status: 'active',
  lastLoginAt: minutesAgo(60),
  visibleProjectIds: ['p-meter'],
  canRequestCancel: false
},
{
  id: 'u-zhao',
  name: '赵强',
  role: '前专业审核员',
  email: 'zhaoqiang@demo.invalid',
  systemRole: 'member',
  status: 'disabled',
  lastLoginAt: minutesAgo(43200),
  visibleProjectIds: [],
  canRequestCancel: false
}];
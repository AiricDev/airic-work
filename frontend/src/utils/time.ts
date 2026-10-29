import { format, formatDistanceToNowStrict } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60000).toISOString();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatTime(iso: string): string {
  return format(new Date(iso), 'MM-dd HH:mm');
}

export function fromNow(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { locale: zhCN, addSuffix: true });
}

export function duration(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { locale: zhCN });
}
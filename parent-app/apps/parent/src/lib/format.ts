export const pct = (value: number | null, digits = 0): string =>
  value === null ? "—" : `${(value * 100).toFixed(digits)}%`;

export const secs = (ms: number | null): string =>
  ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`;

export const minutes = (ms: number): string => {
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m} 分钟` : `${(m / 60).toFixed(1)} 小时`;
};

export const dateLabel = (ts: number): string =>
  new Date(ts).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

export const timeLabel = (ts: number): string =>
  new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });

export function relativeDay(ts: number, now = Date.now()): string {
  const startOf = (t: number): number => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOf(now) - startOf(ts)) / 86_400_000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return dateLabel(ts);
}

/** 从生日算月龄——CVI 的评估是看月龄的，不是看年龄 */
export function ageInMonths(birthDate: string, now = new Date()): number {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 0;
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

export function ageLabel(birthDate: string, now = new Date()): string {
  const months = ageInMonths(birthDate, now);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${months} 个月`;
  return rest === 0 ? `${years} 岁` : `${years} 岁 ${rest} 个月`;
}

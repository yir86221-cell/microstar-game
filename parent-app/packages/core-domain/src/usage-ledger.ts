/**
 * 用量积分——在"读不到电量"的前提下，用亮灯时长折算消耗。
 *
 * 为什么不做电量百分比（架构文档 2.5）：
 * 硬件没有电池采样，读数不稳定；**错的数字比没有数字更糟**。
 * 家长一旦依赖"62%"来安排训练，某次中途灯灭就会崩掉对产品的信任。
 *
 * 这里算出来的不是电量，是一个"大概还能练几次"的提示。
 * 算不准的后果只是提示偏早或偏晚，不会误导。
 */

export const NOMINAL_CAPACITY_MAH = 400;
/** 低温、老化、截止电压，按 90% 可用打 */
export const USABLE_FRACTION = 0.9;
export const USABLE_MAH = NOMINAL_CAPACITY_MAH * USABLE_FRACTION;

/**
 * 电池侧平均电流（mA）随灯环亮度（0–255，固件上限 128）的曲线。
 * 来源：架构文档 2.4 的估算表，测出真实值后应改为云端下发配置。
 */
const CURRENT_TABLE: ReadonlyArray<readonly [brightness: number, currentMa: number]> = [
  [0, 45],
  [25, 140],
  [50, 230],
  [75, 320],
  [100, 410],
  [128, 500],
];

const MAX_TABLE_BRIGHTNESS = CURRENT_TABLE[CURRENT_TABLE.length - 1]![0];

/** 分段线性插值，超出上限按上限算 */
export function batteryCurrentMa(brightness: number): number {
  const b = Math.max(0, Math.min(MAX_TABLE_BRIGHTNESS, brightness));
  const first = CURRENT_TABLE[0]!;
  if (b <= first[0]) return first[1];

  for (let i = 1; i < CURRENT_TABLE.length; i += 1) {
    const [b1, c1] = CURRENT_TABLE[i]!;
    const [b0, c0] = CURRENT_TABLE[i - 1]!;
    if (b <= b1) {
      const t = (b - b0) / (b1 - b0);
      return c0 + (c1 - c0) * t;
    }
  }
  return CURRENT_TABLE[CURRENT_TABLE.length - 1]![1];
}

export interface UsageEntry {
  /** 本次点亮的分钟数 */
  litMinutes: number;
  /** 当时的亮度档位 */
  brightness: number;
}

/** 自上次充满以来消耗的 mAh */
export function consumedMah(entries: readonly UsageEntry[]): number {
  return entries.reduce(
    (sum, e) => sum + (e.litMinutes / 60) * batteryCurrentMa(e.brightness),
    0,
  );
}

export function remainingMah(entries: readonly UsageEntry[]): number {
  return Math.max(0, USABLE_MAH - consumedMah(entries));
}

export interface SessionEstimate {
  remainingMah: number;
  perSessionMah: number;
  /** 还能练几次（可能是小数） */
  sessions: number;
  /** 向下取整后的次数，UI 直接用这个 */
  wholeSessions: number;
  litMinutes: number;
}

export function estimateRemaining(
  entries: readonly UsageEntry[],
  options: { sessionMinutes?: number; brightness?: number } = {},
): SessionEstimate {
  const sessionMinutes = options.sessionMinutes ?? 15;
  const brightness = options.brightness ?? 75;
  const perSessionMah = (batteryCurrentMa(brightness) * sessionMinutes) / 60;
  const remain = remainingMah(entries);
  const sessions = perSessionMah === 0 ? 0 : remain / perSessionMah;
  const litMinutes = entries.reduce((sum, e) => sum + e.litMinutes, 0);

  return {
    remainingMah: remain,
    perSessionMah,
    sessions,
    wholeSessions: Math.floor(sessions),
    litMinutes,
  };
}

/**
 * 给家长的一句话。
 * 用"次数"不用"分钟"——"还能练 3 次"家长立刻懂，
 * "已亮灯 52 分钟"他没有参照系。
 */
export function chargingHint(
  entries: readonly UsageEntry[],
  options: { sessionMinutes?: number; brightness?: number } = {},
): string {
  const est = estimateRemaining(entries, options);
  const minutes = Math.round(est.litMinutes);

  if (minutes === 0) return "今天还没亮过灯。";
  if (est.wholeSessions <= 0) {
    return `这盏灯已累计亮灯 ${minutes} 分钟，基本到充电的时候了。`;
  }
  return `这盏灯自上次充电已亮灯 ${minutes} 分钟，大约还能练 ${est.wholeSessions} 次。`;
}

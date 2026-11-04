import type { TrialRecord } from "./types.js";

/**
 * 分位数，线性插值（R-7，和 Excel 的 PERCENTILE.INC 一致）。
 *
 * 反应潜伏期**必须**用分位数而不是均值：CVI 儿童的分布长尾极重，
 * 一次 90 秒的走神就能把均值拉走 20 秒，看起来像"退步了"，
 * 其实中位数没动。
 */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  if (p < 0 || p > 100) throw new RangeError(`p 必须在 0–100，收到 ${p}`);

  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;

  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const a = sorted[lo]!;
  const b = sorted[hi]!;
  return a + (b - a) * (rank - lo);
}

/**
 * 计入统计的回合：命中或无反应。
 * 中途放弃的（含"设备一直没放下"）不算——那不是孩子的表现。
 */
export function isCountedTrial(trial: TrialRecord): boolean {
  return trial.outcome === "hit" || trial.outcome === "noResponse";
}

export interface RateResult {
  hits: number;
  valid: number;
  /** 0–1；分母为 0 时返回 null，而不是 0 */
  rate: number | null;
}

export function hitRate(trials: readonly TrialRecord[]): RateResult {
  const counted = trials.filter(isCountedTrial);
  const hits = counted.filter((t) => t.outcome === "hit").length;
  return {
    hits,
    valid: counted.length,
    rate: counted.length === 0 ? null : hits / counted.length,
  };
}

export interface LatencyStats {
  p50: number | null;
  p90: number | null;
  count: number;
}

export function latencyStats(trials: readonly TrialRecord[]): LatencyStats {
  const latencies = trials
    .filter((t) => t.outcome === "hit" && t.latencyMs !== null)
    .map((t) => t.latencyMs!);

  return {
    p50: percentile(latencies, 50),
    p90: percentile(latencies, 90),
    count: latencies.length,
  };
}

/**
 * 疲劳斜率：会话内前 1/3 与后 1/3 的命中率之差。
 * 负数表示越练越差——这通常不是孩子的问题，是单次时长该缩短了。
 */
export function fatigueSlope(trials: readonly TrialRecord[]): number | null {
  const counted = trials.filter(isCountedTrial);
  if (counted.length < 3) return null;

  const third = Math.max(1, Math.floor(counted.length / 3));
  const head = counted.slice(0, third);
  const tail = counted.slice(-third);

  const rate = (group: readonly TrialRecord[]): number =>
    group.filter((t) => t.outcome === "hit").length / group.length;

  return rate(head) - rate(tail);
}

export interface StreakInfo {
  /** 最长连续命中 */
  longestHit: number;
  /** 最长连续无反应 */
  longestMiss: number;
}

/**
 * 连续命中 / 连续无反应的最长串。
 *
 * 命中率是平均数，看不出"一直很稳"和"一好一坏来回跳"的区别。
 * 连续 4 次没反应往往不是能力问题，是注意断掉了——这条比命中率更能说明状态。
 */
export function streaks(trials: readonly TrialRecord[]): StreakInfo {
  let hit = 0;
  let miss = 0;
  let bestHit = 0;
  let bestMiss = 0;

  for (const t of trials) {
    // abort 是家长跳过或孩子哭闹，不是表现：跳过它，既不打断连续也不计入
    if (t.outcome === "abort") continue;

    if (t.outcome === "hit") {
      hit += 1;
      miss = 0;
      bestHit = Math.max(bestHit, hit);
    } else if (t.outcome === "noResponse") {
      miss += 1;
      hit = 0;
      bestMiss = Math.max(bestMiss, miss);
    }
  }

  return { longestHit: bestHit, longestMiss: bestMiss };
}

/**
 * 反应时间的变异系数（标准差 ÷ 均值）。
 *
 * 平均值一样，忽快忽慢和稳定输出在康复上是两回事。
 * 少于 3 个样本不给结论——两个数的离散度没有意义。
 */
export function latencyCv(trials: readonly TrialRecord[]): number | null {
  const values = trials
    .filter((t) => t.outcome === "hit" && t.latencyMs !== null)
    .map((t) => t.latencyMs!);

  if (values.length < 3) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return null;

  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/** 稳定的判断口径，别让家长自己读小数 */
export function describeCv(cv: number | null): string {
  if (cv === null) return "样本太少";
  if (cv <= 0.25) return "很稳";
  if (cv <= 0.5) return "还可以";
  return "忽快忽慢";
}

/**
 * 平均落点偏离：命中点离目标中心的距离 ÷ 目标半径。
 *
 * 只在精准点击时有意义。从"擦边点到"到"稳稳点中"，命中率都是 100%，
 * 只有这个数会动。
 */
export function averageOffset(trials: readonly TrialRecord[]): number | null {
  const values = trials
    .filter((t) => t.outcome === "hit" && typeof t.offsetRatio === "number")
    .map((t) => t.offsetRatio as number);

  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface SessionSummary {
  total: number;
  hits: number;
  noResponse: number;
  aborted: number;
  rate: number | null;
  p50: number | null;
  p90: number | null;
  fatigue: number | null;
  longestHit: number;
  longestMiss: number;
  cv: number | null;
  avgOffset: number | null;
}

export function summarize(trials: readonly TrialRecord[]): SessionSummary {
  const rate = hitRate(trials);
  const latency = latencyStats(trials);
  const streak = streaks(trials);
  return {
    total: trials.length,
    hits: rate.hits,
    noResponse: trials.filter((t) => t.outcome === "noResponse").length,
    aborted: trials.filter((t) => t.outcome === "abort").length,
    rate: rate.rate,
    p50: latency.p50,
    p90: latency.p90,
    fatigue: fatigueSlope(trials),
    longestHit: streak.longestHit,
    longestMiss: streak.longestMiss,
    cv: latencyCv(trials),
    avgOffset: averageOffset(trials),
  };
}

/** 给 UI 用的一句话，避免家长自己换算 */
export function describeRate(rate: number | null): string {
  if (rate === null) return "还没有数据";
  return `${Math.round(rate * 100)}%`;
}

/** 兼容旧调用：返回 {hit, noResponse} 形状 */
export interface StreakResult {
  hit: number;
  noResponse: number;
}

export function longestStreak(trials: readonly TrialRecord[]): StreakResult {
  const s = streaks(trials);
  return { hit: s.longestHit, noResponse: s.longestMiss };
}

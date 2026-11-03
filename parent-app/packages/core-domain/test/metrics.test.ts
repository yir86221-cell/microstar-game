import { describe, expect, it } from "vitest";
import {
  fatigueSlope,
  hitRate,
  latencyStats,
  percentile,
  summarize,
  type TrialRecord,
} from "@microstar/core-domain";

const trial = (over: Partial<TrialRecord> = {}): TrialRecord => ({
  id: "x",
  index: 0,
  tStim: 0,
  tFirstMotion: null,
  tHit: null,
  tRelease: null,
  outcome: "hit",
  judge: "touch",
  latencyMs: 1_000,
  pickedUpAtStart: false,
  abortReason: null,
  ...over,
});

describe("分位数", () => {
  it("空数组返回 null，不是 0", () => {
    expect(percentile([], 50)).toBeNull();
  });

  it("单值直接返回", () => {
    expect(percentile([5], 90)).toBe(5);
  });

  it("线性插值，和 Excel PERCENTILE.INC 一致", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 90)).toBeCloseTo(3.7, 10);
    expect(percentile([10, 20, 30], 0)).toBe(10);
    expect(percentile([10, 20, 30], 100)).toBe(30);
  });

  it("乱序输入也能算对", () => {
    expect(percentile([4, 1, 3, 2], 50)).toBe(2.5);
  });

  it("越界 p 直接报错", () => {
    expect(() => percentile([1], 101)).toThrow(RangeError);
  });
});

describe("命中率", () => {
  it("abort 不进分母——跳过和「一直没放下」不是孩子的表现", () => {
    const trials = [
      trial(),
      trial(),
      trial(),
      trial({ outcome: "noResponse", judge: null, latencyMs: null }),
      trial({ outcome: "abort", judge: null, latencyMs: null }),
    ];
    const r = hitRate(trials);
    expect(r.hits).toBe(3);
    expect(r.valid).toBe(4);
    expect(r.rate).toBe(0.75);
  });

  it("没有有效回合时返回 null，而不是 0%", () => {
    expect(hitRate([]).rate).toBeNull();
    expect(hitRate([trial({ outcome: "abort" })]).rate).toBeNull();
  });

  it("触屏和拿起实物，口径完全一样", () => {
    const touch = hitRate([trial({ judge: "touch" }), trial({ judge: "touch", outcome: "noResponse" })]);
    const motion = hitRate([trial({ judge: "motion" }), trial({ judge: "motion", outcome: "noResponse" })]);
    expect(touch.rate).toBe(motion.rate);
  });
});

describe("反应潜伏期", () => {
  it("报 P50 / P90，不给均值", () => {
    const trials = [
      trial({ latencyMs: 1_000 }),
      trial({ latencyMs: 2_000 }),
      trial({ latencyMs: 3_000 }),
      trial({ latencyMs: 4_000 }),
      trial({ outcome: "noResponse", latencyMs: null, judge: null }),
    ];
    const stats = latencyStats(trials);
    expect(stats.count).toBe(4);
    expect(stats.p50).toBe(2_500);
    expect(stats.p90).toBeCloseTo(3_700, 10);
  });

  it("均值会被极端值毁掉，分位数不会——这就是不用均值的原因", () => {
    const values = [2_000, 2_100, 2_200, 2_300, 90_000];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(19_000);
    expect(percentile(values, 50)).toBe(2_200);
  });

  it("没有命中时返回 null", () => {
    const stats = latencyStats([trial({ outcome: "noResponse", latencyMs: null })]);
    expect(stats).toEqual({ p50: null, p90: null, count: 0 });
  });
});

describe("疲劳斜率", () => {
  it("越练越差时为正数（前面好后面差）", () => {
    const trials = [
      trial(),
      trial(),
      trial(),
      trial({ outcome: "noResponse", latencyMs: null }),
      trial({ outcome: "noResponse", latencyMs: null }),
      trial({ outcome: "noResponse", latencyMs: null }),
    ];
    expect(fatigueSlope(trials)).toBe(1);
  });

  it("回合太少时不给结论", () => {
    expect(fatigueSlope([trial(), trial()])).toBeNull();
  });
});

describe("会话汇总", () => {
  it("一次会话的完整画像", () => {
    const trials = [
      trial({ latencyMs: 4_000 }),
      trial({ latencyMs: 6_000 }),
      trial({ outcome: "noResponse", latencyMs: null }),
      trial({ outcome: "abort", latencyMs: null }),
    ];
    const s = summarize(trials);
    expect(s.total).toBe(4);
    expect(s.hits).toBe(2);
    expect(s.noResponse).toBe(1);
    expect(s.aborted).toBe(1);
    expect(s.rate).toBeCloseTo(2 / 3, 10);
    expect(s.p50).toBe(5_000);
  });
});

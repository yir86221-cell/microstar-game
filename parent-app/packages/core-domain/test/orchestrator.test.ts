import { describe, expect, it } from "vitest";
import { TrialRunner } from "@microstar/core-domain";

const mkRunner = (judgeWindowMs = 30_000) =>
  new TrialRunner({
    judgeWindowMs,
    now: () => 0,
    idFactory: (() => {
      let n = 0;
      return () => `t${(n += 1)}`;
    })(),
  });

describe("回合门控（第 4 阶最容易做错的地方）", () => {
  it("拿起 → 命中 → 必须等放下才能开下一回合", () => {
    const r = mkRunner();

    expect(r.start(0).ok).toBe(true);
    r.onMotion({ moving: true }, 1_000);
    r.hit(2_000, "motion");

    expect(r.phase).toBe("gating");
    expect(r.isDeviceHeld).toBe(true);

    const blocked = r.start(3_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("busy");

    r.onMotion({ moving: false }, 4_000);
    expect(r.phase).toBe("idle");
    expect(r.start(5_000).ok).toBe(true);
  });

  it("孩子全程没碰就超时：判定为「无反应」，且可以立刻开始下一回合", () => {
    const r = mkRunner();

    r.start(0);
    r.timeout(30_000);

    const trial = r.trials()[0]!;
    expect(trial.outcome).toBe("noResponse");
    expect(trial.latencyMs).toBeNull();
    expect(trial.judge).toBeNull();
    expect(r.phase).toBe("idle");
    expect(r.start(31_000).ok).toBe(true);
  });

  it("拿起来但没命中就超时：仍然要等放下", () => {
    const r = mkRunner();
    r.start(0);
    r.onMotion({ moving: true }, 2_000);
    r.timeout(30_000);

    expect(r.trials()[0]!.outcome).toBe("noResponse");
    expect(r.phase).toBe("gating");
    expect(r.start(31_000).ok).toBe(false);

    r.onMotion({ moving: false }, 32_000);
    expect(r.phase).toBe("idle");
  });

  it("设备一直拿在手上时，连开始都不允许", () => {
    const r = mkRunner();
    r.start(0);
    r.onMotion({ moving: true }, 500);
    r.abort(1_000, "stillHeld");

    expect(r.phase).toBe("idle");
    expect(r.isDeviceHeld).toBe(true);

    const blocked = r.start(2_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("device_held");
  });

  it("放下时刻记在上一个回合上", () => {
    const r = mkRunner();
    r.start(0);
    r.onMotion({ moving: true }, 1_000);
    r.hit(2_000, "motion");
    r.onMotion({ moving: false }, 7_500);

    expect(r.trials()[0]!.tRelease).toBe(7_500);
  });

  it("首次运动只记一次，后续移动不覆盖", () => {
    const r = mkRunner();
    r.start(0);
    r.onMotion({ moving: true }, 1_000);
    r.onMotion({ moving: true }, 1_500);
    r.onMotion({ moving: true }, 1_800);

    expect(r.trials().length).toBe(0);
    expect(r.currentTrial?.tFirstMotion).toBe(1_000);
  });
});

describe("命中与延迟", () => {
  it("反应潜伏期 = 命中时刻 − 刺激时刻", () => {
    const r = mkRunner();
    r.start(10_000);
    r.onMotion({ moving: true }, 13_000);
    const trial = r.hit(18_500, "motion");

    expect(trial?.latencyMs).toBe(8_500);
    expect(trial!.tFirstMotion! - trial!.tStim).toBe(3_000);
  });

  it("触屏判定默认是 touch，不需要任何 MOTION 信号", () => {
    const r = mkRunner();
    r.start(0);
    const trial = r.hit(12_000);

    expect(trial?.outcome).toBe("hit");
    expect(trial?.judge).toBe("touch");
    expect(trial?.latencyMs).toBe(12_000);
    // 设备从没拿起来过，所以不需要等放下
    expect(r.phase).toBe("idle");
  });

  it("abort 记成放弃，且不进分母", () => {
    const r = mkRunner();
    r.start(0);
    const trial = r.abort(5_000, "child_crying");

    expect(trial?.outcome).toBe("abort");
    expect(trial?.abortReason).toBe("child_crying");
    expect(r.phase).toBe("idle");
  });
});

describe("判定窗口", () => {
  it("默认 30 秒——CVI 视觉延迟 5–20 秒是常态", () => {
    expect(new TrialRunner().judgeWindowMs).toBe(30_000);
  });

  it("训练中可以临时放宽", () => {
    const r = mkRunner();
    r.setJudgeWindow(45_000);
    expect(r.judgeWindowMs).toBe(45_000);
  });

  it("拒绝非法窗口", () => {
    const r = mkRunner();
    expect(() => r.setJudgeWindow(0)).toThrow(RangeError);
    expect(() => r.setJudgeWindow(-1)).toThrow(RangeError);
  });
});

describe("状态订阅", () => {
  it("阶段变化会通知 UI，顺序正确", () => {
    const r = mkRunner();
    const seen: string[] = [];
    r.subscribe({ onPhaseChange: (phase) => seen.push(phase) });

    r.start(0);
    r.onMotion({ moving: true }, 1_000);
    r.hit(2_000, "motion");
    r.onMotion({ moving: false }, 3_000);

    expect(seen).toEqual(["presenting", "gating", "idle"]);
  });

  it("取消订阅后不再收到通知", () => {
    const r = mkRunner();
    let count = 0;
    const off = r.subscribe({ onTrialStart: () => (count += 1) });
    r.start(0);
    off();
    r.abort(1_000);
    r.start(2_000);
    expect(count).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { AlertMode, LIGHT_PRESETS } from "@microstar/core-protocol";
import { applyLightPolicy, isModeAllowed, resolveLightPolicy } from "@microstar/core-domain";

describe("灯光安全策略", () => {
  it("默认不额外限制", () => {
    const policy = resolveLightPolicy({});
    expect(policy.maxBrightness).toBe(128);
    expect(policy.muteVibration).toBe(false);
    expect(policy.allowedModes).toContain(AlertMode.Blink);
    expect(policy.notes).toEqual([]);
  });

  it("有光敏癫痫史：禁用闪烁，亮度砍到 64", () => {
    const policy = resolveLightPolicy({ photosensitive: true });
    expect(policy.maxBrightness).toBe(64);
    expect(isModeAllowed(AlertMode.Blink, policy)).toBe(false);
    expect(isModeAllowed(AlertMode.Steady, policy)).toBe(true);
    expect(isModeAllowed(AlertMode.Breathe, policy)).toBe(true);
    expect(policy.notes.join()).toContain("光敏");
  });

  it("对强光敏感：亮度砍到 96，但闪烁仍可用", () => {
    const policy = resolveLightPolicy({ highLightSensitivity: true });
    expect(policy.maxBrightness).toBe(96);
    expect(isModeAllowed(AlertMode.Blink, policy)).toBe(true);
  });

  it("两个都命中时取更严的那个", () => {
    const policy = resolveLightPolicy({ photosensitive: true, highLightSensitivity: true });
    expect(policy.maxBrightness).toBe(64);
  });

  it("触觉敏感：所有指令都会带震动抑制", () => {
    const policy = resolveLightPolicy({ tactileSensitive: true });
    expect(policy.muteVibration).toBe(true);
    expect(policy.notes.join()).toContain("触觉");
  });
});

describe("下发前的策略拦截", () => {
  it("光敏孩子请求闪烁，会被降级成常亮而不是黑灯", () => {
    const policy = resolveLightPolicy({ photosensitive: true });
    const out = applyLightPolicy(
      { mode: AlertMode.Blink, muteVibration: false },
      LIGHT_PRESETS.red,
      policy,
    );
    expect(out.command.mode).toBe(AlertMode.Steady);
    expect(out.adjusted).toBe(true);
    expect(out.adjustments.join()).toContain("闪烁");
  });

  it("超亮请求被压到策略上限", () => {
    const policy = resolveLightPolicy({ photosensitive: true });
    const out = applyLightPolicy(
      { mode: AlertMode.Steady, muteVibration: false },
      { ...LIGHT_PRESETS.red, brightness: 120 },
      policy,
    );
    expect(out.light.brightness).toBe(64);
    expect(out.adjusted).toBe(true);
  });

  it("触觉敏感时即使调用方要求震动，也会被静音", () => {
    const policy = resolveLightPolicy({ tactileSensitive: true });
    const out = applyLightPolicy(
      { mode: AlertMode.Steady, muteVibration: false },
      LIGHT_PRESETS.red,
      policy,
    );
    expect(out.command.muteVibration).toBe(true);
  });

  it("合规请求原样通过，不会莫名其妙动参数", () => {
    const policy = resolveLightPolicy({});
    const out = applyLightPolicy(
      { mode: AlertMode.Breathe, muteVibration: false },
      LIGHT_PRESETS.yellow,
      policy,
    );
    expect(out.adjusted).toBe(false);
    expect(out.command).toEqual({ mode: AlertMode.Breathe, muteVibration: false });
    expect(out.light).toEqual({ ...LIGHT_PRESETS.yellow });
  });

  it("亮度仍然受固件 128 上限约束", () => {
    const policy = resolveLightPolicy({});
    const out = applyLightPolicy(
      { mode: AlertMode.Steady, muteVibration: false },
      { ...LIGHT_PRESETS.warmWhite, brightness: 255 },
      policy,
    );
    expect(out.light.brightness).toBe(128);
  });
});

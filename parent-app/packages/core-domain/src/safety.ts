import {
  AlertMode,
  FIRMWARE_MAX_BRIGHTNESS,
  clampBrightness,
  type AlertCommand,
  type Rgbww,
} from "@microstar/core-protocol";
import type { ChildSafetyFlags } from "./types.js";

/**
 * 灯光安全策略。
 *
 * 把孩子档案里的两个标记翻译成"这盏灯允许怎么亮"：
 *  - 有光敏癫痫史 → 禁用闪烁，亮度砍到 64（约 25%）
 *  - 对强光敏感    → 亮度砍到 96
 *  - 触觉敏感      → 所有指令带上震动抑制位（bit7）
 *
 * 这一层必须挡在**下发之前**，不能靠 UI 自觉。
 * 光敏是一旦出事就没有第二次机会的那类风险。
 */
export interface LightPolicy {
  maxBrightness: number;
  allowedModes: readonly AlertMode[];
  muteVibration: boolean;
  /** 给家长看的理由，不要静默改参数 */
  notes: string[];
}

export function resolveLightPolicy(flags: Partial<ChildSafetyFlags> = {}): LightPolicy {
  const notes: string[] = [];
  let maxBrightness = FIRMWARE_MAX_BRIGHTNESS;
  let allowedModes: AlertMode[] = [
    AlertMode.Off,
    AlertMode.Blink,
    AlertMode.Steady,
    AlertMode.Breathe,
  ];

  if (flags.highLightSensitivity) {
    maxBrightness = Math.min(maxBrightness, 96);
    notes.push("对强光敏感：亮度上限降到 96");
  }

  if (flags.photosensitive) {
    maxBrightness = Math.min(maxBrightness, 64);
    allowedModes = [AlertMode.Off, AlertMode.Steady, AlertMode.Breathe];
    notes.push("有光敏癫痫史：禁用闪烁，亮度上限 64");
  }

  const muteVibration = flags.tactileSensitive ?? false;
  if (muteVibration) {
    notes.push("触觉敏感：默认关闭震动");
  }

  return { maxBrightness, allowedModes, muteVibration, notes };
}

export function isModeAllowed(mode: AlertMode, policy: LightPolicy): boolean {
  return policy.allowedModes.includes(mode);
}

export interface SanitizedCommand {
  command: AlertCommand;
  light: Rgbww;
  /** 是否被策略改动过，UI 应该据此提示家长 */
  adjusted: boolean;
  adjustments: string[];
}

/**
 * 把一条"想发的"指令过一遍策略，返回"实际能发"的。
 * 不允许的情况一律降级到常亮，而不是拒绝发送——训练中途不能因为参数非法就黑灯。
 */
export function applyLightPolicy(
  command: AlertCommand,
  light: Rgbww,
  policy: LightPolicy,
): SanitizedCommand {
  const adjustments: string[] = [];
  let mode = command.mode;

  if (!isModeAllowed(mode, policy)) {
    adjustments.push(`该孩子禁用「${modeName(mode)}」，已改为「常亮」`);
    mode = AlertMode.Steady;
  }

  const cappedByPolicy = Math.min(light.brightness, policy.maxBrightness);
  const brightness = clampBrightness(cappedByPolicy);
  if (brightness !== light.brightness) {
    adjustments.push(`亮度已按安全策略限制为 ${brightness}`);
  }

  const muteVibration = command.muteVibration || policy.muteVibration;
  if (muteVibration && !command.muteVibration) {
    adjustments.push("按档案关闭了本次震动");
  }

  return {
    command: { mode, muteVibration },
    light: { ...light, brightness },
    adjusted: adjustments.length > 0,
    adjustments,
  };
}

function modeName(mode: AlertMode): string {
  switch (mode) {
    case AlertMode.Off:
      return "熄灭";
    case AlertMode.Blink:
      return "闪烁";
    case AlertMode.Steady:
      return "常亮";
    case AlertMode.Breathe:
      return "呼吸";
  }
}

/**
 * `LIGHT` 通道：5 字节 RGBWW + 亮度。
 *
 *   [0] 红  [1] 绿  [2] 蓝  [3] 暖白  [4] 亮度
 *
 * 两个必须记住的现实：
 *  1. 固件把亮度按 128 截断（128/255 ≈ 50%）。这里先截一次，
 *     免得 UI 显示 100% 而灯只有 50% —— 那是最容易让人怀疑"灯坏了"的错位。
 *  2. 亮度直接决定续航（见架构文档 2.4）。默认值 75 不是随便取的：
 *     约 320 mA，满电约 67 分钟，够 4 次 15 分钟训练。
 */

export const FIRMWARE_MAX_BRIGHTNESS = 128;
export const DEFAULT_BRIGHTNESS = 75;
export const LIGHT_PAYLOAD_LENGTH = 5;

export interface Rgbww {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly w: number;
  readonly brightness: number;
}

const clampByte = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

/** 截到固件真正接受的亮度 */
export const clampBrightness = (v: number): number =>
  Math.max(0, Math.min(FIRMWARE_MAX_BRIGHTNESS, Math.round(v)));

/** 编成 5 字节 */
export function encodeLight(color: Rgbww): Uint8Array {
  return new Uint8Array([
    clampByte(color.r),
    clampByte(color.g),
    clampByte(color.b),
    clampByte(color.w),
    clampBrightness(color.brightness),
  ]);
}

export function decodeLight(bytes: ArrayLike<number>): Rgbww {
  if (bytes.length < LIGHT_PAYLOAD_LENGTH) {
    throw new Error(`LIGHT 需要 5 字节，收到 ${bytes.length}`);
  }
  const at = (i: number): number => bytes[i] ?? 0;
  return {
    r: at(0),
    g: at(1),
    b: at(2),
    w: at(3),
    brightness: at(4),
  };
}

/**
 * 预置灯光配方。
 *
 * CVI 孩子大多只对高饱和的红、黄有反应，所以这几个是主力。
 * 暖白留给"需要看清实物轮廓"的场景。
 */
export const LIGHT_PRESETS = {
  green: { r: 0, g: 255, b: 0, w: 0, brightness: DEFAULT_BRIGHTNESS },
  blue: { r: 0, g: 0, b: 255, w: 0, brightness: DEFAULT_BRIGHTNESS },
  /** 高饱和红：最常用，CVI 儿童对红最敏感 */
  red: { r: 255, g: 0, b: 0, w: 0, brightness: DEFAULT_BRIGHTNESS },
  /** 高饱和黄 */
  yellow: { r: 255, g: 200, b: 0, w: 0, brightness: DEFAULT_BRIGHTNESS },
  /** 暖白：看实物细节 */
  warmWhite: { r: 0, g: 0, b: 0, w: 255, brightness: DEFAULT_BRIGHTNESS },
  /** 深蓝：低唤醒，睡前或安定用 */
  deepBlue: { r: 0, g: 40, b: 255, w: 0, brightness: 60 },
} as const satisfies Record<string, Rgbww>;

export type LightPresetName = keyof typeof LIGHT_PRESETS;

/**
 * `ALERT` 通道：1 字节，控制灯的运行模式。
 *
 * 字节布局（附录 B2 / B3）：
 *
 *   bit7      震动抑制标志（1 = 本次不下发马达震动）
 *   bit6..0   模式
 *
 * 为什么模式值这样排：
 *   0x01 是固件早已实现的"闪烁"，语义不能动，否则旧固件会错乱。
 *   新增的常亮 / 呼吸只能往后排，旧固件收到 0x02 / 0x03 直接忽略即可，
 *   天然向后兼容，不会把灯搞坏。
 */
export const ALERT_MUTE_BIT = 0x80;

export enum AlertMode {
  /** 熄灭（保留当前颜色） */
  Off = 0x00,
  /** 闪烁：200 ms 亮 / 200 ms 灭（2.5 Hz）。原有行为，不要改 */
  Blink = 0x01,
  /** 常亮：呈现训练目标时用这个，稳定光利于注视和追踪 */
  Steady = 0x02,
  /** 呼吸：周期 2.5–3 s，最暗不低于 20%，参数由固件内部定 */
  Breathe = 0x03,
}

export const ALERT_MODE_MIN = AlertMode.Off;
export const ALERT_MODE_MAX = AlertMode.Breathe;

export interface AlertCommand {
  readonly mode: AlertMode;
  /** true = 本次不下发震动（配合「触觉敏感」档案） */
  readonly muteVibration: boolean;
}

export class ProtocolError extends Error {
  constructor(
    message: string,
    readonly code:
      | "BAD_ALERT_MODE"
      | "BAD_LENGTH"
      | "BAD_BYTE_RANGE"
      | "UNKNOWN_MODE",
  ) {
    super(message);
    this.name = "ProtocolError";
  }
}

function isKnownMode(value: number): value is AlertMode {
  return value >= ALERT_MODE_MIN && value <= ALERT_MODE_MAX && Number.isInteger(value);
}

/** 编成固件能直接吃的 1 个字节 */
export function encodeAlert(command: AlertCommand): Uint8Array {
  const mode = command.mode;
  if (!isKnownMode(mode)) {
    throw new ProtocolError(
      `未知的 AlertMode: ${String(mode)}（只接受 0x00–0x03）`,
      "BAD_ALERT_MODE",
    );
  }
  const byte = (mode & 0x7f) | (command.muteVibration ? ALERT_MUTE_BIT : 0);
  return new Uint8Array([byte]);
}

/**
 * 解回结构体。
 * 主要给日志、回放和"设备发回来的状态"用，App 本身不读 ALERT。
 */
export function decodeAlert(byte: number): AlertCommand {
  if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
    throw new ProtocolError(`ALERT 出去的不是字节: ${byte}`, "BAD_BYTE_RANGE");
  }
  const mode = byte & 0x7f;
  if (!isKnownMode(mode)) {
    throw new ProtocolError(`未知的 AlertMode: 0x${mode.toString(16)}`, "UNKNOWN_MODE");
  }
  return { mode, muteVibration: (byte & ALERT_MUTE_BIT) !== 0 };
}

/** 人话，给 UI 和日志用 */
export function describeAlertMode(mode: AlertMode): string {
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

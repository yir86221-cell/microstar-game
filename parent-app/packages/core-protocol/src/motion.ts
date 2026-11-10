/**
 * `MOTION` 通道：7 字节，设备主动 notify。
 *
 *   [0]      moving：1 = 正在移动/被拿起，0 = 已放下
 *   [1..2]   X  int16 小端，单位 mg
 *   [3..4]   Y
 *   [5..6]   Z
 *
 * 两个必须记住的现实（架构文档 C6）：
 *  1. 只在状态**变化**时推送。灯还拿在手上就开下一回合，
 *     孩子下一次拿起根本不会触发 —— 整轮数据作废。
 *  2. 加速度计证明的是"手动了"，不是"看到了"。
 *     安静的注视不会产生任何信号，所以 Phase I 必须靠家长手动标记。
 */

export const MOTION_PAYLOAD_LENGTH = 7;

export interface MotionSample {
  readonly moving: boolean;
  /** 毫重力，1 g ≈ 1000 mg */
  readonly xMg: number;
  readonly yMg: number;
  readonly zMg: number;
  /** 原始 7 字节，留着排查用 */
  readonly raw: Uint8Array;
}

const toBytes = (data: ArrayBuffer | ArrayBufferView | DataView): Uint8Array => {
  if (data instanceof Uint8Array) return data;
  if (data instanceof DataView) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
};

export function decodeMotion(data: ArrayBuffer | ArrayBufferView | DataView): MotionSample {
  const bytes = toBytes(data);
  if (bytes.length !== MOTION_PAYLOAD_LENGTH) {
    throw new Error(
      `MOTION 需要 7 字节，收到 ${bytes.length}`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    moving: (bytes[0] ?? 0) === 1,
    xMg: view.getInt16(1, true),
    yMg: view.getInt16(3, true),
    zMg: view.getInt16(5, true),
    raw: bytes.slice(0, MOTION_PAYLOAD_LENGTH),
  };
}

/** 合加速度，mg。可以用来做"剧烈程度"粗判。 */
export function magnitudeMg(sample: MotionSample): number {
  return Math.round(
    Math.sqrt(sample.xMg ** 2 + sample.yMg ** 2 + sample.zMg ** 2),
  );
}

/**
 * 判断一次采样是否"足够像一次拿起"。
 *
 * 设备放在桌上时，桌面震动也会推上来，如果固件没有做阈值+持续时间判定，
 * 就会误报。这一层是 App 侧的二次过滤，双保险。
 * 真正的门限应该在固件里，这里只是不让明显的噪声进训练数据。
 */
export function looksLikePickup(sample: MotionSample, baselineMg = 1000): boolean {
  const delta = Math.abs(magnitudeMg(sample) - baselineMg);
  return sample.moving && delta > 120;
}

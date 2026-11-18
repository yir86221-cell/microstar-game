/** MicroStar ultrasonic firmware, software handoff 2026-11-10. */
export type TrainingCommand = 0x00 | 0x01 | 0x02 | 0x10 | 0x11;
export interface RangeSample {
  phase: 0 | 1 | 2;
  valid: boolean;
  stable: boolean;
  distanceMm: number;
  baselineMm: number;
  elapsedMs: number;
}
export function decodeRange(bytes: readonly number[]): RangeSample {
  if (bytes.length !== 10 || bytes.some(x => !Number.isInteger(x) || x < 0 || x > 255) || bytes[0]! > 2 || (bytes[1]! & ~3)) {
    throw Error('设备不是新版 10 字节测距协议，请确认固件版本。');
  }
  const value = new DataView(Uint8Array.from(bytes).buffer);
  return { phase: bytes[0] as 0 | 1 | 2, valid: !!(bytes[1]! & 1), stable: !!(bytes[1]! & 2),
    distanceMm: value.getUint16(2, true), baselineMm: value.getUint16(4, true), elapsedMs: value.getUint32(6, true) };
}
export function decodeDeviceStatus(bytes: readonly number[]) {
  if (bytes.length !== 3 || ![0,1,2,3].includes(bytes[0]!) || ![0,1].includes(bytes[1]!) || ![0,1].includes(bytes[2]!)) throw Error('设备返回的状态格式不正确。');
  return { mode: bytes[0]!, found: bytes[1] === 1, valid: bytes[2] === 1 };
}

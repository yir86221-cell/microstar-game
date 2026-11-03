import { describe, expect, it } from "vitest";
import {
  ALERT_MUTE_BIT,
  AlertMode,
  ProtocolError,
  FIRMWARE_MAX_BRIGHTNESS,
  DEFAULT_BRIGHTNESS,
  LIGHT_PRESETS,
  clampBrightness,
  decodeAlert,
  decodeLight,
  decodeMotion,
  encodeAlert,
  encodeLight,
  looksLikePickup,
  magnitudeMg,
} from "@microstar/core-protocol";

describe("ALERT 编码", () => {
  it("四个模式值直接对应附录 B 的字节", () => {
    expect([...encodeAlert({ mode: AlertMode.Off, muteVibration: false })]).toEqual([0x00]);
    expect([...encodeAlert({ mode: AlertMode.Blink, muteVibration: false })]).toEqual([0x01]);
    expect([...encodeAlert({ mode: AlertMode.Steady, muteVibration: false })]).toEqual([0x02]);
    expect([...encodeAlert({ mode: AlertMode.Breathe, muteVibration: false })]).toEqual([0x03]);
  });

  it("震动抑制走 bit7，模式不受影响", () => {
    expect([...encodeAlert({ mode: AlertMode.Steady, muteVibration: true })]).toEqual([
      0x80 | 0x02,
    ]);
    expect([...encodeAlert({ mode: AlertMode.Breathe, muteVibration: true })]).toEqual([
      0x80 | 0x03,
    ]);
    expect([...encodeAlert({ mode: AlertMode.Off, muteVibration: true })]).toEqual([0x80]);
  });

  it("拒绝未定义的模式值，而不是悄悄写一个固件看不懂的字节", () => {
    expect(() => encodeAlert({ mode: 0x07 as AlertMode, muteVibration: false })).toThrow(
      ProtocolError,
    );
  });

  it("编解码往返一致", () => {
    for (const mode of [AlertMode.Off, AlertMode.Blink, AlertMode.Steady, AlertMode.Breathe]) {
      for (const muteVibration of [false, true]) {
        const bytes = encodeAlert({ mode, muteVibration });
        expect(decodeAlert(bytes[0]!)).toEqual({ mode, muteVibration });
      }
    }
  });

  it("bit7 就是 0x80，别算错", () => {
    expect(ALERT_MUTE_BIT).toBe(0x80);
  });
});

describe("LIGHT 编码", () => {
  it("永远是 5 字节，顺序是 R G B W 亮度", () => {
    const bytes = encodeLight({ r: 255, g: 200, b: 0, w: 0, brightness: 75 });
    expect(bytes.length).toBe(5);
    expect([...bytes]).toEqual([255, 200, 0, 0, 75]);
  });

  it("亮度按固件上限 128 截断——否则 UI 会显示 100% 而灯只有 50%", () => {
    expect(encodeLight({ r: 0, g: 0, b: 0, w: 255, brightness: 255 })[4]).toBe(
      FIRMWARE_MAX_BRIGHTNESS,
    );
    expect(clampBrightness(999)).toBe(128);
    expect(clampBrightness(-5)).toBe(0);
    expect(clampBrightness(75.4)).toBe(75);
  });

  it("通道值越界会被夹住，不会溢出成环", () => {
    const bytes = encodeLight({ r: 300, g: -20, b: 255, w: 0, brightness: 75 });
    expect([...bytes]).toEqual([255, 0, 255, 0, 75]);
  });

  it("往返一致，并且能读回预设", () => {
    const decoded = decodeLight(encodeLight(LIGHT_PRESETS.yellow));
    expect(decoded).toEqual({ ...LIGHT_PRESETS.yellow });
  });

  it("长度不够直接报错，不猜", () => {
    expect(() => decodeLight([1, 2, 3])).toThrow();
  });
});

describe("MOTION 解码", () => {
  /** moving=1, x=1000, y=-500, z=250 的小端字节 */
  const sample = new Uint8Array([1, 0xe8, 0x03, 0x0c, 0xfe, 0xfa, 0x00]);

  it("motion.ts 注释里那 7 个字节真的能解出来", () => {
    const decoded = decodeMotion(sample);
    expect(decoded).toEqual({
      moving: true,
      xMg: 1000,
      yMg: -500,
      zMg: 250,
      raw: sample,
    });
  });

  it("负数按 int16 小端解，不是 uint16", () => {
    expect(decodeMotion(sample).yMg).toBe(-500);
    expect(decodeMotion(sample).yMg).toBeLessThan(0);
  });

  it("能直接吃 DataView（characteristic.value 就是这个类型）", () => {
    const view = new DataView(sample.buffer);
    expect(decodeMotion(view).xMg).toBe(1000);
  });

  it("能处理带 offset 的 DataView", () => {
    const backing = new Uint8Array([9, 9, 9, ...sample]);
    const view = new DataView(backing.buffer, 3, 7);
    expect(decodeMotion(view).xMg).toBe(1000);
  });

  it("moving=0 就是放下了", () => {
    const down = new Uint8Array([0, 0, 0, 0, 0, 0, 0]);
    expect(decodeMotion(down).moving).toBe(false);
  });

  it("不足 7 字节报错", () => {
    expect(() => decodeMotion(new Uint8Array([1, 2, 3]))).toThrow();
  });

  it("合加速度约等于重力时，说明躺在桌上——不算拿起", () => {
    const resting = new Uint8Array([1, 0xe8, 0x03, 0x00, 0x00, 0x00, 0x00]);
    expect(magnitudeMg(decodeMotion(resting))).toBe(1000);
    expect(looksLikePickup(decodeMotion(resting))).toBe(false);
  });

  it("moving=1 且明显偏离重力，才算一次拿起", () => {
    expect(looksLikePickup(decodeMotion(sample))).toBe(true);
  });
});

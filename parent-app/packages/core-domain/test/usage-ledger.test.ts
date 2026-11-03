import { describe, expect, it } from "vitest";
import {
  USABLE_MAH,
  batteryCurrentMa,
  chargingHint,
  consumedMah,
  estimateRemaining,
  remainingMah,
} from "@microstar/core-domain";

describe("电量曲线", () => {
  it("表上的点位原样命中", () => {
    expect(batteryCurrentMa(0)).toBe(45);
    expect(batteryCurrentMa(25)).toBe(140);
    expect(batteryCurrentMa(75)).toBe(320);
    expect(batteryCurrentMa(128)).toBe(500);
  });

  it("中间值线性插值", () => {
    expect(batteryCurrentMa(12.5)).toBeCloseTo(92.5, 6);
  });

  it("超出固件上限按上限算，不会算出更省电的假象", () => {
    expect(batteryCurrentMa(255)).toBe(500);
  });
});

describe("用量积分", () => {
  it("可用电量是 360 mAh（400 的 90%）", () => {
    expect(USABLE_MAH).toBe(360);
  });

  it("亮 60 分钟、亮度 75，消耗 320 mAh", () => {
    expect(consumedMah([{ litMinutes: 60, brightness: 75 }])).toBeCloseTo(320, 6);
  });

  it("没有用量时剩余就是满电", () => {
    expect(remainingMah([])).toBe(360);
  });

  it("用光了也不会变成负数", () => {
    expect(remainingMah([{ litMinutes: 600, brightness: 128 }])).toBe(0);
  });

  it("默认亮度下满电大约能练 4 次半", () => {
    const est = estimateRemaining([]);
    expect(est.perSessionMah).toBe(80);
    expect(est.sessions).toBeCloseTo(4.5, 6);
    expect(est.wholeSessions).toBe(4);
  });

  it("亮度越高，能练的次数越少", () => {
    const dim = estimateRemaining([], { brightness: 50 }).sessions;
    const bright = estimateRemaining([], { brightness: 128 }).sessions;
    expect(dim).toBeGreaterThan(bright);
  });

  it("练过 20 分钟后只剩 3 次", () => {
    const est = estimateRemaining([{ litMinutes: 20, brightness: 75 }]);
    expect(est.wholeSessions).toBe(3);
    expect(est.litMinutes).toBe(20);
  });
});

describe("给家长的话", () => {
  it("还没亮过灯时不说废话", () => {
    expect(chargingHint([])).toBe("今天还没亮过灯。");
  });

  it("用「次数」而不是「分钟」作为主结论", () => {
    const hint = chargingHint([{ litMinutes: 20, brightness: 75 }]);
    expect(hint).toContain("20 分钟");
    expect(hint).toContain("还能练 3 次");
  });

  it("电量见底时直接说到点了", () => {
    const hint = chargingHint([{ litMinutes: 60, brightness: 75 }]);
    expect(hint).toContain("充电");
    expect(hint).not.toContain("还能练");
  });
});

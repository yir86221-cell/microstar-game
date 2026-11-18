// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ManualLamp,
  lampOccupancy,
  type LampConnection,
  type LampSettings,
} from "../src/lib/manual-lamp.js";
import { RangeLamp } from "../src/lib/range-lamp.js";

const settings: LampSettings = {
  preset: "warmWhite",
  brightness: 80,
  photosensitive: false,
  highLightSensitivity: false,
  tactileSensitive: false,
};
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function fakeConnection(): LampConnection {
  return {
    writeLight: vi.fn(async () => {}),
    writeAlert: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    // 自动训练要求订阅测距通知，否则连接会被判为不支持
    subscribeRange: vi.fn(async () => {}),
  };
}

afterEach(() => {
  lampOccupancy.manual = false;
  lampOccupancy.training = false;
  vi.restoreAllMocks();
});

describe("手动控灯与自动训练互斥标记", () => {
  it("手动控灯点亮时标记为占用，停止后释放", async () => {
    const lamp = new ManualLamp(vi.fn(), async () => fakeConnection());
    expect(lampOccupancy.manual).toBe(false);

    await lamp.toggle(settings);
    await flush();
    expect(lamp.state.active).toBe(true);
    expect(lampOccupancy.manual).toBe(true);

    await lamp.stop();
    await flush();
    expect(lamp.state.active).toBe(false);
    expect(lampOccupancy.manual).toBe(false);
  });

  it("自动训练连接成功后标记为占用，断开后释放", async () => {
    const lamp = new RangeLamp(vi.fn(), async () => fakeConnection());
    expect(lampOccupancy.training).toBe(false);

    await lamp.connect();
    await flush();
    expect(lamp.state.connected).toBe(true);
    expect(lampOccupancy.training).toBe(true);

    await lamp.disconnect();
    await flush();
    expect(lamp.state.connected).toBe(false);
    expect(lampOccupancy.training).toBe(false);
  });
});

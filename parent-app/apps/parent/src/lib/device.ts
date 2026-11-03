import {
  AlertMode,
  LIGHT_PRESETS,
  encodeAlert,
  encodeLight,
  type LightPresetName,
  type Rgbww,
} from "@microstar/core-protocol";
import { applyLightPolicy, resolveLightPolicy } from "@microstar/core-domain";
import { store } from "./store.js";
import { MockTransport } from "../transport/mock.js";
import { WebBluetoothTransport, isWebBluetoothAvailable } from "../transport/web-bluetooth.js";
import type { BleTransport, ConnectionState, MotionEvent } from "../transport/types.js";

export interface LogEntry {
  at: number;
  text: string;
  tone: "info" | "ok" | "warn";
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/**
 * 设备服务：全 App 唯一的 BLE 持有者。
 *
 * 为什么集中一处：架构里定的"设备租约"要求同一时刻只有一端持有连接。
 * 如果每个页面自己去连，切页就会抢连接、掉连接。
 */
class DeviceService {
  status: ConnectionState = "idle";
  detail = "";
  kind = "";
  connectedDeviceName = "";

  lastWrite: { alert: number[] | null; light: number[] | null } = {
    alert: null,
    light: null,
  };

  readonly logs: LogEntry[] = [];
  /** 最近一次 MOTION 采样，调试页用 */
  lastMotion: MotionEvent | null = null;

  private transport: BleTransport | null = null;
  private readonly stateListeners = new Set<() => void>();
  private readonly motionListeners = new Set<(event: MotionEvent) => void>();
  private unsubscribeTransport: (() => void)[] = [];

  get isConnected(): boolean {
    return this.status === "connected";
  }

  get isMock(): boolean {
    return this.transport instanceof MockTransport;
  }

  /** 训练中由遥控台接管 MOTION；其余时候只记录 */
  onMotion(listener: (event: MotionEvent) => void): () => void {
    this.motionListeners.add(listener);
    return () => {
      this.motionListeners.delete(listener);
    };
  }

  onState(listener: () => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  log(text: string, tone: LogEntry["tone"] = "info"): void {
    this.logs.unshift({ at: Date.now(), text, tone });
    if (this.logs.length > 200) this.logs.pop();
    this.emit();
  }

  private emit(): void {
    for (const listener of this.stateListeners) listener();
  }

  private setStatus(status: ConnectionState, detail = ""): void {
    this.status = status;
    this.detail = detail;
    this.emit();
  }

  async connect(): Promise<void> {
    if (this.transport) await this.disconnect();

    const web = isWebBluetoothAvailable();
    this.transport = web ? new WebBluetoothTransport() : new MockTransport();
    this.kind = this.transport.kind;

    this.unsubscribeTransport.push(
      this.transport.subscribeConnection((state, detail) => {
        this.setStatus(state, detail ?? "");
        if (state === "connected") {
          this.log(`已连接（${this.kind}）`, "ok");
          void this.selfTest();
        }
        if (state === "disconnected") this.log("连接断开", "warn");
        if (state === "error") this.log(`连接出错：${detail ?? ""}`, "warn");
      }),
      this.transport.subscribeMotion((event) => {
        this.lastMotion = event;
        for (const listener of this.motionListeners) listener(event);
        this.emit();
      }),
    );

    try {
      await this.transport.connect();
      this.connectedDeviceName = "MicroStar";
    } catch (error) {
      this.setStatus("error", error instanceof Error ? error.message : String(error));
    }
  }

  async disconnect(): Promise<void> {
    for (const off of this.unsubscribeTransport) off();
    this.unsubscribeTransport = [];
    await this.transport?.disconnect();
    this.transport = null;
    this.setStatus("disconnected");
  }

  /**
   * 训练前可用性自检。
   * 没有电量可读，所以"灯能不能亮起来"就是唯一诚实的判断。
   */
  async selfTest(): Promise<void> {
    if (!this.transport) return;
    try {
      await this.writeLight({ mode: AlertMode.Steady, durationMs: 700 });
      store.update((s) => {
        s.selfTest = { at: Date.now(), ok: true };
      });
      this.log("自检通过：灯亮起来了", "ok");
    } catch (error) {
      store.update((s) => {
        s.selfTest = { at: Date.now(), ok: false };
      });
      this.log(`自检失败：${String(error)}`, "warn");
    }
  }

  /** 寻灯：亮 / 灭 两次，沙发缝里也能看到 */
  async findLamp(): Promise<void> {
    for (let i = 0; i < 2; i += 1) {
      await this.writeLight({ mode: AlertMode.Steady, durationMs: 450 });
      await sleep(250);
    }
    this.log("寻灯：闪了两下", "ok");
  }

  async setMode(mode: AlertMode): Promise<void> {
    await this.writeLight({ mode });
  }

  async setLight(brightness: number, preset: LightPresetName): Promise<void> {
    await this.writeLight({ mode: AlertMode.Steady, brightness, preset });
  }

  async turnOff(): Promise<void> {
    await this.writeLight({ mode: AlertMode.Off });
  }

  /**
   * 所有灯光下发都走这里，安全策略挡在最前面。
   * 光敏是一旦出事就没有第二次机会的风险，不能靠页面自觉。
   */
  async writeLight(options: {
    mode: AlertMode;
    brightness?: number;
    preset?: LightPresetName;
    durationMs?: number;
  }): Promise<void> {
    if (!this.transport || !this.isConnected) return;

    const plan = store.state.plan;
    const child = store.state.child;
    const preset = options.preset ?? plan.preset;
    const base = LIGHT_PRESETS[preset] as Rgbww;
    const desired: Rgbww = {
      ...base,
      brightness: options.brightness ?? plan.brightness,
    };

    const policy = resolveLightPolicy(child);
    const out = applyLightPolicy({ mode: options.mode, muteVibration: false }, desired, policy);
    if (out.adjusted) this.log(`安全策略调整：${out.adjustments.join("；")}`, "warn");

    const lightBytes = encodeLight(out.light);
    const alertBytes = encodeAlert(out.command);

    // 先设颜色再开模式：颜色写入本身不会让灯亮
    await this.transport.writeLight(lightBytes);
    await this.transport.writeAlert(alertBytes);

    this.lastWrite = { alert: [...alertBytes], light: [...lightBytes] };
    this.emit();

    if (options.durationMs !== undefined) {
      await sleep(options.durationMs);
      await this.transport.writeAlert(encodeAlert({ mode: AlertMode.Off, muteVibration: out.command.muteVibration }));
      this.lastWrite = {
        alert: [...encodeAlert({ mode: AlertMode.Off, muteVibration: out.command.muteVibration })],
        light: [...lightBytes],
      };
      this.emit();
    }
  }

  /** 调试页用：手动模拟拿起/放下 */
  simulateMotion(moving: boolean): void {
    if (this.transport instanceof MockTransport) this.transport.simulateMotion(moving);
  }
}

export const device = new DeviceService();

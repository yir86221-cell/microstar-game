import { ALERT_UUID, LIGHT_UUID, SERVICE_UUID, DEVICE_NAME, LIGHT_PRESETS, encodeLight, type LightPresetName } from "@microstar/core-protocol";

// This manual control follows micro_star_client.js / micro_star_parent.html:
// LIGHT is RGBWW + brightness; ALERT accepts only 01 (blink) / 00 (stop).
// It intentionally does not subscribe to MOTION or create training records.
export interface LampConnection {
  writeLight(bytes: Uint8Array): Promise<void>;
  writeAlert(value: 0 | 1): Promise<void>;
  disconnect(): Promise<void>;
}
export interface LampBridge {
  connect(onDisconnect: () => void, owner?: Window): Promise<LampConnection>;
}
interface Characteristic { writeValue(bytes: Uint8Array): Promise<void> }
interface LampDevice extends EventTarget {
  gatt?: {
    connected: boolean;
    connect(): Promise<{ getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<Characteristic> }> }>;
    disconnect(): void;
  };
}
interface BluetoothApi {
  requestDevice(options: { filters: unknown[]; optionalServices: string[] }): Promise<LampDevice>;
}
export async function connectLamp(onDisconnect: () => void): Promise<LampConnection> {
  let host: (Window & { microstarLampBridge?: LampBridge; Capacitor?: { isNativePlatform?(): boolean } }) | null = null;
  try { host = window.top; } catch { /* Standalone web fallback. */ }
  if (host?.microstarLampBridge) return host.microstarLampBridge.connect(onDisconnect, window);
  if (host?.Capacitor?.isNativePlatform?.()) throw Error("此安装包缺少蓝牙模块，请安装新版 App。");
  const bluetooth = (navigator as unknown as { bluetooth?: BluetoothApi }).bluetooth;
  if (!bluetooth || window.isSecureContext === false) {
    throw Error("请用电脑 Chrome / Edge，通过 localhost 或 HTTPS 打开，才能连接真灯。");
  }
  const selected = await bluetooth.requestDevice({
    filters: [{ name: DEVICE_NAME }, { services: [SERVICE_UUID] }], optionalServices: [SERVICE_UUID],
  });
  const gatt = selected.gatt;
  if (!gatt) throw Error("设备未提供蓝牙 GATT 服务。");
  selected.addEventListener("gattserverdisconnected", onDisconnect);
  try {
    const server = await gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const alert = await service.getCharacteristic(ALERT_UUID);
    const light = await service.getCharacteristic(LIGHT_UUID);
    return {
      writeLight: bytes => light.writeValue(bytes),
      writeAlert: value => alert.writeValue(new Uint8Array([value])),
      async disconnect() {
        selected.removeEventListener("gattserverdisconnected", onDisconnect);
        gatt.disconnect();
      },
    };
  } catch (error) {
    selected.removeEventListener("gattserverdisconnected", onDisconnect);
    gatt.disconnect();
    throw error;
  }
}

export interface LampSettings {
  preset: LightPresetName;
  brightness: number;
  photosensitive: boolean;
  highLightSensitivity: boolean;
  tactileSensitive: boolean;
}
export interface LampState { busy: boolean; active: boolean; message: string }

/** One manual session, independent of the existing automatic training loop. */
export class ManualLamp {
  state: LampState = { busy: false, active: false, message: "首次点击选择 MicroStar；使用当前计划的颜色和亮度。" };
  private connection: LampConnection | null = null;
  private generation = 0;
  private disposed = false;
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly notify: (state: LampState) => void, private readonly connect: LampBridge["connect"] = connectLamp) {}

  private update(state: LampState): void {
    this.state = state;
    if (!this.disposed) this.notify(state);
  }
  private send(task: () => Promise<void>): Promise<void> {
    const next = this.writes.then(task);
    this.writes = next.catch(() => {});
    return next;
  }
  private close(connection: LampConnection): Promise<void> {
    return this.send(async () => {
      try { await connection.writeAlert(0); }
      finally { await connection.disconnect(); }
    });
  }
  async toggle(settings: LampSettings): Promise<void> {
    if (this.disposed || this.state.busy) return;
    if (this.connection) { await this.stop(); return; }
    if (settings.photosensitive || settings.tactileSensitive) {
      this.update({ busy: false, active: false, message: settings.photosensitive
        ? "档案已禁用闪烁；当前固件仅提供闪烁启停，此按钮不会发送闪灯指令。"
        : "当前固件未提供关闭拿起震动的指令；为保留档案的关闭震动设置，此按钮暂不可启动。" });
      return;
    }
    const generation = ++this.generation;
    this.update({ busy: true, active: false, message: "请选择 MicroStar 并允许蓝牙连接…" });
    let connection: LampConnection | null = null;
    try {
      connection = await this.connect(() => {
        if (generation !== this.generation) return;
        this.generation++; this.connection = null;
        this.update({ busy: false, active: false, message: "设备已断开，点按钮可重新连接。" });
      });
      if (generation !== this.generation || this.disposed) { await this.close(connection); return; }
      this.connection = connection;
      const brightness = Number.isFinite(settings.brightness) ? settings.brightness : 80;
      const light = encodeLight({ ...LIGHT_PRESETS[settings.preset],
        brightness: Math.min(brightness, settings.highLightSensitivity ? 96 : 128) });
      const ready = connection;
      await this.send(() => ready.writeLight(light));
      if (generation !== this.generation) return;
      await this.send(() => ready.writeAlert(1));
      if (generation !== this.generation) return;
      this.update({ busy: false, active: true, message: "已发送闪灯指令；再次点击停止并断开。" });
    } catch (error) {
      if (connection && this.connection === connection) {
        this.connection = null;
        await this.close(connection).catch(() => {});
      }
      if (generation === this.generation) this.update({ busy: false, active: false,
        message: `未完成控灯：${error instanceof Error ? error.message : String(error)}` });
    }
  }
  async stop(): Promise<void> {
    ++this.generation;
    const connection = this.connection; this.connection = null;
    this.update({ busy: true, active: false, message: "正在停止并断开…" });
    try {
      if (connection) await this.close(connection);
      this.update({ busy: false, active: false, message: "已发送停止指令并断开连接。" });
    } catch (error) {
      this.update({ busy: false, active: false, message: `停止未确认，请检查灯：${error instanceof Error ? error.message : String(error)}` });
    }
  }
  dispose(): void { this.disposed = true; void this.stop(); }
}

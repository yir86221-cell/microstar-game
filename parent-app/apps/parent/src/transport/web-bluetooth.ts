import {
  ALERT_UUID,
  DEVICE_NAME,
  LIGHT_UUID,
  MOTION_UUID,
  SERVICE_UUID,
  decodeMotion,
} from "@microstar/core-protocol";
import type { BleTransport, ConnectionState, MotionEvent } from "./types.js";

/** 只声明我们用得到的那几个成员，避免依赖 @types/web-bluetooth */
interface GattCharacteristic {
  value: DataView | null;
  writeValue(value: Uint8Array): Promise<void>;
  startNotifications(): Promise<GattCharacteristic>;
  addEventListener(type: string, listener: EventListener): void;
}

interface GattServer {
  getPrimaryService(uuid: string): Promise<{
    getCharacteristic(uuid: string): Promise<GattCharacteristic>;
  }>;
}

interface GattDevice {
  name?: string;
  gatt?: {
    connect(): Promise<GattServer>;
    disconnect(): void;
    connected: boolean;
  };
  addEventListener(type: string, listener: EventListener): void;
}

interface BluetoothApi {
  requestDevice(options: {
    filters: unknown[];
    optionalServices?: string[];
  }): Promise<GattDevice>;
}

const getBluetooth = (): BluetoothApi | null => {
  const nav = navigator as unknown as { bluetooth?: BluetoothApi };
  return nav.bluetooth ?? null;
};

export const isWebBluetoothAvailable = (): boolean => getBluetooth() !== null;

export type BluetoothSupportCode =
  | "ok"
  | "insecure-context"
  | "apple-device"
  | "firefox"
  | "unknown";

export interface BluetoothSupport {
  readonly available: boolean;
  readonly code: BluetoothSupportCode;
  /** 说给家长听的一句话 */
  readonly message: string;
}

const isAppleMobile = (): boolean => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13 起 UA 伪装成 macOS，用触摸点数区分
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
};

/**
 * 判断这台设备**为什么**连不了蓝牙。
 *
 * 必须给具体原因，不能只返回 false：演示现场最怕的是"点了没反应"。
 * 三种情况对家长来说是完全不同的解决方案，混在一起等于没说。
 */
export function describeBluetoothSupport(): BluetoothSupport {
  const ua = navigator.userAgent;

  if (getBluetooth()) {
    return { available: true, code: "ok", message: "这台设备支持蓝牙" };
  }

  if (isAppleMobile()) {
    return {
      available: false,
      code: "apple-device",
      message:
        "iPad / iPhone 上的所有浏览器（包括 Chrome）都不支持网页蓝牙。换成安卓平板或电脑。",
    };
  }

  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return {
      available: false,
      code: "insecure-context",
      message:
        "现在打开的地址不是 HTTPS。浏览器只在 HTTPS 或 localhost 下提供蓝牙，换一个地址再试。",
    };
  }

  if (/Firefox|FxiOS/i.test(ua)) {
    return {
      available: false,
      code: "firefox",
      message: "Firefox 从来不支持网页蓝牙。用 Chrome、Edge 或三星浏览器。",
    };
  }

  return {
    available: false,
    code: "unknown",
    message: "这个浏览器没有提供蓝牙接口。试试安卓上的 Chrome。",
  };
}


/**
 * 开发用实现：Chrome / Edge 桌面版可以连真灯。
 *
 * 注意：iOS / iPadOS 的 Safari 不支持 Web Bluetooth，
 * 所以这个实现只用于开发验证，不能上产品。
 */
export class WebBluetoothTransport implements BleTransport {
  readonly kind = "web-bluetooth";

  private device: GattDevice | null = null;
  private alertChar: GattCharacteristic | null = null;
  private lightChar: GattCharacteristic | null = null;
  private motionChar: GattCharacteristic | null = null;
  private motionHandler: EventListener | null = null;

  private _state: ConnectionState = "idle";
  private readonly motionListeners = new Set<(event: MotionEvent) => void>();
  private readonly connectionListeners = new Set<
    (state: ConnectionState, detail?: string) => void
  >();

  get state(): ConnectionState {
    return this._state;
  }

  subscribeMotion(listener: (event: MotionEvent) => void): () => void {
    this.motionListeners.add(listener);
    return () => this.motionListeners.delete(listener);
  }

  subscribeConnection(
    listener: (state: ConnectionState, detail?: string) => void,
  ): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  async connect(): Promise<void> {
    const bluetooth = getBluetooth();
    if (!bluetooth) {
      throw new Error(
        "当前环境没有 Web Bluetooth（Safari / iPad 都不支持）。请用 Chrome 桌面版调试，或改用 iOS 原生壳。",
      );
    }

    this.setState("connecting");
    try {
      const device = await bluetooth.requestDevice({
        filters: [{ name: DEVICE_NAME }, { services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });

      device.addEventListener("gattserverdisconnected", () => {
        this.setState("disconnected", "设备断开了");
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error("无法建立 GATT 连接");

      const service = await server.getPrimaryService(SERVICE_UUID);
      this.alertChar = await service.getCharacteristic(ALERT_UUID);
      this.lightChar = await service.getCharacteristic(LIGHT_UUID);
      this.motionChar = await service.getCharacteristic(MOTION_UUID);

      await this.motionChar.startNotifications();
      this.motionHandler = (event: Event) => {
        const target = event.target as unknown as { value: DataView | null };
        if (!target.value) return;
        try {
          const sample = decodeMotion(target.value);
          for (const listener of this.motionListeners) {
            listener({
              moving: sample.moving,
              xMg: sample.xMg,
              yMg: sample.yMg,
              zMg: sample.zMg,
            });
          }
        } catch (error) {
          console.warn("MOTION 解码失败", error);
        }
      };
      this.motionChar.addEventListener("characteristicvaluechanged", this.motionHandler);

      this.device = device;
      this.setState("connected", device.name ?? DEVICE_NAME);
    } catch (error) {
      this.setState("error", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.motionChar && this.motionHandler) {
      this.motionChar.addEventListener; // 无移除接口时忽略
    }
    try {
      this.device?.gatt?.disconnect();
    } catch {
      /* 已断开 */
    }
    this.device = null;
    this.alertChar = null;
    this.lightChar = null;
    this.motionChar = null;
    this.setState("disconnected");
  }

  async writeAlert(bytes: Uint8Array): Promise<void> {
    if (!this.alertChar) throw new Error("ALERT 未就绪，请先连接设备");
    await this.alertChar.writeValue(bytes);
  }

  async writeLight(bytes: Uint8Array): Promise<void> {
    if (!this.lightChar) throw new Error("LIGHT 未就绪，请先连接设备");
    await this.lightChar.writeValue(bytes);
  }

  private setState(state: ConnectionState, detail?: string): void {
    this._state = state;
    for (const listener of this.connectionListeners) listener(state, detail);
  }
}

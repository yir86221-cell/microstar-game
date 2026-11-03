/**
 * BLE 传输层抽象。
 *
 * 两层实现：
 *  - WebBluetoothTransport：开发用。Chrome / Edge 桌面版可以连真灯，
 *    协议、门控、指标全部能在电脑上先验证完，不用等 iOS 工程。
 *  - CapacitorTransport：生产用（iOS / iPadOS），走原生 CoreBluetooth 桥接。
 *
 * UI 与领域层只认这个接口，所以换实现不影响业务逻辑。
 */

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface MotionEvent {
  moving: boolean;
  xMg: number;
  yMg: number;
  zMg: number;
}

export interface BleTransport {
  readonly kind: string;
  readonly state: ConnectionState;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /** 写 ALERT：1 字节 */
  writeAlert(bytes: Uint8Array): Promise<void>;
  /** 写 LIGHT：5 字节 */
  writeLight(bytes: Uint8Array): Promise<void>;

  /** 订阅拿起/放下，返回取消订阅函数 */
  subscribeMotion(listener: (event: MotionEvent) => void): () => void;
  /** 订阅连接状态，返回取消订阅函数 */
  subscribeConnection(
    listener: (state: ConnectionState, detail?: string) => void,
  ): () => void;
}

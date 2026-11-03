import type { BleTransport, ConnectionState, MotionEvent } from "./types.js";

/**
 * 没有硬件时的假设备。
 *
 * 存在的意义：UI、回合门控、指标这些逻辑不该"等灯做好才能测"。
 * 而且门控那条路径（拿起→放下→才能开下一回合）在真机上反而不好复现，
 * 用假设备手动点"拿起/放下"更快。
 */
export class MockTransport implements BleTransport {
  readonly kind = "mock";

  private _state: ConnectionState = "idle";
  private moving = false;
  private readonly motionListeners = new Set<(event: MotionEvent) => void>();
  private readonly connectionListeners = new Set<
    (state: ConnectionState, detail?: string) => void
  >();

  /** 最近一次收到的灯指令，给 UI 回显用 */
  readonly lastCommands: { alert: number[] | null; light: number[] | null } = {
    alert: null,
    light: null,
  };

  get state(): ConnectionState {
    return this._state;
  }

  async connect(): Promise<void> {
    this.setState("connected", "模拟设备");
  }

  async disconnect(): Promise<void> {
    this.moving = false;
    this.setState("disconnected");
  }

  async writeAlert(bytes: Uint8Array): Promise<void> {
    this.lastCommands.alert = [...bytes];
  }

  async writeLight(bytes: Uint8Array): Promise<void> {
    this.lastCommands.light = [...bytes];
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

  /** 手动模拟拿起 / 放下 */
  simulateMotion(moving: boolean): void {
    if (this.moving === moving) return;
    this.moving = moving;
    const event: MotionEvent = {
      moving,
      xMg: moving ? 1400 : 1000,
      yMg: moving ? -320 : 0,
      zMg: moving ? 210 : 40,
    };
    for (const listener of this.motionListeners) listener(event);
  }

  private setState(state: ConnectionState, detail?: string): void {
    this._state = state;
    for (const listener of this.connectionListeners) listener(state, detail);
  }
}

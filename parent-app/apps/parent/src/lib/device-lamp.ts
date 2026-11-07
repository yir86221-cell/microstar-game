import { LIGHT_PRESETS, encodeLight } from '@microstar/core-protocol';
import { cancelLampSelection, connectLamp, type LampBridge, type LampConnection, type LampSettings } from './manual-lamp.js';

export interface DeviceLampState {
  connected: boolean; busy: boolean; message: string;
  reported: { blinking: boolean; moving: boolean; imuOk: boolean; at: number } | null;
}
export class DeviceLamp {
  state: DeviceLampState = { connected: false, busy: false, message: '连接真实 MicroStar 后操作。', reported: null };
  private connection: LampConnection | null = null;
  private generation = 0;
  private disposed = false;
  private pending: Promise<void> = Promise.resolve();
  private wake: (() => void) | null = null;
  constructor(private notify: (state: DeviceLampState) => void, private connector: LampBridge['connect'] = connectLamp) {}
  private update(patch: Partial<DeviceLampState>): void {
    Object.assign(this.state, patch);
    if (!this.disposed) this.notify(this.state);
  }
  async connect(): Promise<void> {
    if (this.disposed || this.state.busy || this.connection) return;
    const generation = ++this.generation;
    this.update({busy:true, reported:null, message:'请选择 MicroStar…'});
    this.pending = (async () => {
      try {
        const connection = await this.connector(() => {
          if (generation !== this.generation) return;
          this.generation++; this.connection = null; this.wake?.();
          this.update({connected:false,busy:false,reported:null,message:'设备已断开，请重新连接。'});
        }, undefined, message => { if (generation === this.generation) this.update({message}); });
        if (generation !== this.generation || this.disposed) { await this.close(connection); return; }
        this.connection = connection;
        this.update({connected:true,message:'已连接 MicroStar；尚未发送闪灯指令。'});
      } catch (error) {
        if (generation === this.generation) this.update({connected:false,message:`连接未完成：${String(error)}`});
      } finally { if (generation === this.generation) this.update({busy:false}); }
    })();
    return this.pending;
  }

  private async close(connection: LampConnection): Promise<void> {
    try { await connection.writeAlert(0); } finally { await connection.disconnect(); }
  }
  private command(task: (connection: LampConnection, valid: () => boolean) => Promise<string>): Promise<void> {
    if (this.disposed || this.state.busy) return Promise.resolve();
    const connection = this.connection, generation = this.generation;
    if (!connection) { this.update({message:'尚未连接真实设备。'}); return Promise.resolve(); }
    const valid = () => !this.disposed && generation === this.generation;
    this.update({busy:true,reported:null,message:'正在与提示灯通信…'});
    this.pending = (async () => {
      try { const message = await task(connection, valid); if (valid()) this.update({message}); }
      catch (error) { if (valid()) this.update({message:`操作未完成：${String(error)}`}); }
      finally { if (valid()) this.update({busy:false}); }
    })();
    return this.pending;
  }
  private packet(settings: LampSettings): Uint8Array {
    const brightness = Number.isFinite(settings.brightness) ? settings.brightness : 75;
    return encodeLight({...LIGHT_PRESETS[settings.preset],brightness:Math.min(brightness,settings.highLightSensitivity ? 96 : 128)});
  }
  setColor(settings: LampSettings): Promise<void> {
    return this.command(async c => { await c.writeLight(this.packet(settings)); return '已发送颜色和亮度；此操作不会启动闪烁。'; });
  }
  blink(settings: LampSettings, durationMs?: number): Promise<void> {
    if (settings.photosensitive || settings.tactileSensitive) {
      this.update({message:settings.photosensitive ? '档案已禁用闪烁，未发送指令。' : '固件未提供关闭拿起震动的指令，当前档案下不启动闪烁。'});
      return Promise.resolve();
    }
    return this.command(async (c, valid) => {
      await c.writeLight(this.packet(settings));
      if (!valid()) return '';
      await c.writeAlert(1);
      if (durationMs !== undefined) {
        await new Promise<void>(resolve => {
          const timer = setTimeout(() => { this.wake = null; resolve(); }, durationMs);
          this.wake = () => { clearTimeout(timer); this.wake = null; resolve(); };
          if (!valid()) this.wake();
        });
        if (!valid()) return '';
        await c.writeAlert(0);
        return '已发送短时闪烁及停止指令，请观察实灯。';
      }
      return '已发送闪烁指令，请观察实灯。';
    });
  }
  stop(): Promise<void> {
    this.wake?.();
    return this.command(async c => { await c.writeAlert(0); return '已发送停止闪烁指令。'; });
  }
  readStatus(): Promise<void> {
    return this.command(async (c, valid) => {
      if (!c.readStatus) throw Error('当前连接不支持读取状态。');
      const bytes = await c.readStatus();
      if (bytes.length < 3 || bytes.slice(0,3).some(x => x !== 0 && x !== 1)) throw Error('设备返回的状态格式不正确。');
      if (valid()) this.update({reported:{blinking:bytes[0]===1,moving:bytes[1]===1,imuOk:bytes[2]===1,at:Date.now()}});
      return '已读取设备返回状态；运动标记不代表抓握成功。';
    });
  }
  async disconnect(): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.generation;
    this.wake?.(); cancelLampSelection();
    const connection = this.connection; this.connection = null;
    const previous = this.pending;
    this.update({busy:true,reported:null,message:'正在停止并断开…'});
    this.pending = (async () => {
      try {
        await previous;
        if (connection) await this.close(connection);
        if (generation === this.generation) this.update({message:'已断开连接。'});
      } catch (error) {
        if (generation === this.generation) this.update({message:`停止未确认，请检查灯：${String(error)}`});
      } finally {
        if (generation === this.generation) this.update({connected:false,busy:false,reported:null});
      }
    })();
    return this.pending;
  }
  dispose(): void {
    this.disposed = true; this.generation++; this.wake?.(); cancelLampSelection();
    const connection = this.connection; this.connection = null;
    if (connection) void this.pending.then(() => this.close(connection)).catch(() => {});
  }
}

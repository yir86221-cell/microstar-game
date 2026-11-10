import { decodeRange, decodeDeviceStatus, LIGHT_PRESETS, encodeLight, type RangeSample } from '@microstar/core-protocol';
import { cancelLampSelection, connectLamp, type LampBridge, type LampConnection, type LampSettings } from './manual-lamp.js';

export interface RangeResult {
  id: string; startedAt: number; endedAt: number; outcome: 'found' | 'aborted'; reason: string | null;
  sample: RangeSample | null; color: number[];
}
export interface RangeState {
  connected: boolean; busy: boolean; message: string; sample: RangeSample | null;
  waiting: 'start' | 'end' | null; color: number[] | null;
  reported: ReturnType<typeof decodeDeviceStatus> | null;
}
/** One connection/round owner. Firmware alone decides found and elapsed time. */
export class RangeLamp {
  state: RangeState = { connected:false, busy:false, message:'连接 MicroStar 后确认颜色，再开始找。', sample:null, waiting:null, color:null, reported:null };
  private connection: LampConnection | null = null;
  private generation = 0;
  private disposed = false;
  private pending: Promise<void> = Promise.resolve();
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private receivedAt = 0;
  private round: { id:string; startedAt:number; color:number[]; confirmed:boolean; last:RangeSample|null } | null = null;
  constructor(private notify: (state: RangeState) => void, private connector: LampBridge['connect'] = connectLamp,
    private save: (result: RangeResult) => void = () => {}) {}
  private update(patch: Partial<RangeState>): void {
    Object.assign(this.state,patch); if (!this.disposed) this.notify(this.state);
  }
  get locked(): boolean { return this.state.waiting !== null || (this.state.sample?.phase ?? 0) !== 0; }
  get canStart(): boolean {
    return this.state.connected && !this.state.busy && !this.locked && !!this.state.color && !!this.state.sample?.valid && Date.now()-this.receivedAt < 3000;
  }
  private clearTimers(): void { clearTimeout(this.deadline); clearInterval(this.heartbeat); }
  private finish(outcome: RangeResult['outcome'], reason: string | null): void {
    const round=this.round; this.round=null;
    if (!round?.confirmed) return;
    this.save({id:round.id,startedAt:round.startedAt,endedAt:Date.now(),outcome,reason,sample:round.last??this.state.sample,color:round.color});
  }
  private receive(bytes: number[]): void {
    let sample: RangeSample;
    try { sample=decodeRange(bytes); }
    catch (error) { void this.disconnect(String(error)); return; }
    this.receivedAt=Date.now(); this.update({sample});
    if(this.round&&sample.phase!==0)this.round.last=sample;
    if (this.state.waiting==='end') {
      if(sample.phase===0) { clearTimeout(this.deadline); this.update({waiting:null,message:'训练已结束，可以调整颜色并开始下一轮。'}); }
      return;
    }
    if(this.state.waiting==='start' && sample.phase!==0) {
      clearTimeout(this.deadline); if(this.round)this.round.confirmed=true;
      this.update({waiting:null,message:'设备已开始寻找；颜色和亮度已锁定。'});
    }
    if(sample.phase===2 && this.round?.confirmed) {
      this.finish('found',null);
      this.update({message:`设备报告已找到，用时 ${(sample.elapsedMs/1000).toFixed(1)} 秒；已记录一次。请结束训练后再准备下一轮。`});
    } else if(sample.phase===0 && this.round?.confirmed) {
      this.finish('aborted','device-ended'); this.update({message:'设备已结束本轮，记录为中断。'});
    }
  }
  async connect(): Promise<void> {
    if(this.disposed||this.state.busy||this.connection)return;
    const generation=++this.generation;
    this.update({busy:true,message:'请选择 MicroStar…',sample:null,color:null,reported:null});
    this.pending=(async()=>{
      let connection: LampConnection | null=null;
      try {
        connection=await this.connector(()=>{
          if(generation!==this.generation)return;
          this.generation++; this.clearTimers(); this.finish('aborted','disconnected'); this.connection=null;
          this.update({connected:false,busy:false,waiting:null,sample:null,color:null,reported:null,message:'设备已断开；本轮不会记为完成，请重新连接。'});
        },undefined,message=>{if(generation===this.generation)this.update({message});});
        if(generation!==this.generation||this.disposed){await this.close(connection);return;}
        this.connection=connection;
        if(!connection.subscribeRange)throw Error('当前连接不支持测距通知，请安装新版。');
        this.receivedAt=Date.now();
        await connection.subscribeRange(bytes=>{if(generation===this.generation&&!this.disposed)this.receive(bytes);});
        if(generation!==this.generation||this.disposed)return;
        this.update({connected:true,message:this.state.sample?.phase ? '设备已有训练状态，请先结束训练；不会补记旧结果。' : '已连接。请确认颜色和亮度，查看距离后开始找。'});
        this.heartbeat=setInterval(()=>{
          if(Date.now()-this.receivedAt>=3000)void this.disconnect('测距数据已超过 3 秒未更新，连接已停止；请重新连接。');
        },500);
      }catch(error){
        if(connection)await this.close(connection).catch(()=>{});
        if(generation===this.generation){this.connection=null;this.update({connected:false,message:`连接未完成：${String(error)}`});}
      }finally{if(generation===this.generation)this.update({busy:false});}
    })();
    return this.pending;
  }
  private async close(connection: LampConnection): Promise<void> {
    try { await connection.writeAlert(0); } finally { await connection.disconnect(); }
  }
  private command(task:(c:LampConnection,valid:()=>boolean)=>Promise<void>):Promise<void>{
    if(this.disposed||this.state.busy||!this.connection)return Promise.resolve();
    const c=this.connection,generation=this.generation;
    const valid=()=>generation===this.generation&&!this.disposed;
    this.update({busy:true});
    this.pending=(async()=>{
      try{await task(c,valid);}catch(error){if(valid())this.update({message:`操作未完成：${String(error)}`});}
      finally{if(valid())this.update({busy:false});}
    })();
    return this.pending;
  }
  setColor(settings:LampSettings):Promise<void>{
    if(this.locked||this.state.sample?.phase!==0)return Promise.resolve();
    return this.command(async(c,valid)=>{
      const packet=encodeLight({...LIGHT_PRESETS[settings.preset],brightness:Math.min(settings.brightness,settings.highLightSensitivity?96:128)});
      await c.writeLight(packet);
      if(valid())this.update({color:Array.from(packet),message:'颜色和亮度已确认；试灯或开始找才会开灯。'});
    });
  }
  testLight(mode:1|2,settings:LampSettings):Promise<void>{
    if(this.locked||!this.state.color)return Promise.resolve();
    if(mode===1&&settings.photosensitive){this.update({message:'档案已禁用闪烁；可使用恒亮试灯。'});return Promise.resolve();}
    return this.command(async(c,valid)=>{await c.writeAlert(mode);if(valid())this.update({message:mode===1?'已发送试灯闪烁指令。':'已发送试灯恒亮指令。'});});
  }
  start(settings:LampSettings):Promise<void>{
    if(!this.canStart)return Promise.resolve();
    if(settings.tactileSensitive){this.update({message:'档案要求关闭震动，但本固件找到后固定震动 3 次，暂不启动训练。'});return Promise.resolve();}
    return this.command(async(c,valid)=>{
      this.round={id:crypto.randomUUID(),startedAt:Date.now(),color:[...this.state.color!],confirmed:false,last:null};
      this.update({waiting:'start',message:'已请求开始找，等待设备确认…'});
      try{await c.writeAlert(0x10);}catch(error){if(valid())void this.disconnect(`开始未确认：${String(error)}`);return;}
      if(valid()&&this.state.waiting==='start')this.deadline=setTimeout(()=>void this.disconnect('设备未确认开始，已停止连接；未记录为完成。'),5000);
    });
  }
  end(off=false):Promise<void>{
    return this.command(async(c,valid)=>{
      clearTimeout(this.deadline);this.finish('aborted','parent-ended');
      this.update({waiting:'end',message:'正在结束，等待设备确认…'});
      try{await c.writeAlert(off?0:0x11);}catch(error){if(valid())void this.disconnect(`停止未确认，请检查实灯：${String(error)}`);return;}
      if(valid()&&this.state.waiting==='end')this.deadline=setTimeout(()=>void this.disconnect('停止未确认，请检查实灯；连接已断开。'),5000);
    });
  }
  readStatus():Promise<void>{
    return this.command(async(c,valid)=>{
      this.update({reported:null});
      if(!c.readStatus)throw Error('当前连接不支持读取状态。');
      const reported=decodeDeviceStatus(await c.readStatus());
      if(valid())this.update({reported,message:'已读取总状态；训练进度以测距通知为准。'});
    });
  }
  async disconnect(reason='已发送关灯指令并断开；请确认实灯。'):Promise<void>{
    const generation=++this.generation; this.clearTimers(); this.finish('aborted','interrupted'); cancelLampSelection();
    const c=this.connection;this.connection=null;const previous=this.pending;
    this.update({busy:true,connected:false,waiting:null,sample:null,color:null,reported:null,message:reason});
    this.pending=(async()=>{
      try{await previous;if(c)await this.close(c);}
      catch(error){if(generation===this.generation)this.update({message:`停止未确认，请检查实灯：${String(error)}`});}
      finally{if(generation===this.generation)this.update({busy:false});}
    })();
    return this.pending;
  }
  dispose():void{this.disposed=true;void this.disconnect('已离开训练页面。');}
}

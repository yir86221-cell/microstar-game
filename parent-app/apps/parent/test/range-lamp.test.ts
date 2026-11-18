// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {decodeRange,decodeDeviceStatus,decodeMotion} from '@microstar/core-protocol';
import {RangeLamp} from '../src/lib/range-lamp.js';
import {connectLamp,type LampConnection,type LampSettings} from '../src/lib/manual-lamp.js';
const settings:LampSettings={preset:'warmWhite',brightness:80,photosensitive:false,highLightSensitivity:false,tactileSensitive:false};
export function packet(phase=0,flags=3,elapsed=0){const a=new Uint8Array(10),v=new DataView(a.buffer);a[0]=phase;a[1]=flags;v.setUint16(2,240,true);v.setUint16(4,200,true);v.setUint32(6,elapsed,true);return Array.from(a);}
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function fixture(){
  let receive!:(b:number[])=>void,off!:()=>void;
  const events:unknown[]=[];const save=vi.fn();
  const connection:LampConnection={writeLight:vi.fn(async b=>{events.push([...b]);}),writeAlert:vi.fn(async b=>{events.push(b);}),disconnect:vi.fn(async()=>{events.push('disconnect');}),
    readStatus:vi.fn(async()=>[3,1,1]),subscribeRange:vi.fn(async cb=>{receive=cb;cb(packet());return async()=>{};})};
  const connect=vi.fn(async(cb:()=>void)=>{off=cb;return connection;});
  const lamp=new RangeLamp(vi.fn(),connect,save);
  return {lamp,save,events,connection,connect,receive:(b:number[])=>receive(b),off:()=>off()};
}
beforeEach(()=>vi.useFakeTimers());afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});
it('decodes exact little-endian packets; rejects old IMU payload and prevents new data entering old parser',()=>{
  expect(decodeRange(packet(2,3,123456))).toEqual({phase:2,valid:true,stable:true,distanceMm:240,baselineMm:200,elapsedMs:123456});
  expect(()=>decodeRange([1,0,0,0,0,0,0])).toThrow('固件');expect(()=>decodeRange(packet(3))).toThrow();
  expect(()=>decodeMotion(Uint8Array.from(packet()))).toThrow();
  expect(decodeDeviceStatus([2,0,1])).toEqual({mode:2,found:false,valid:true});expect(decodeDeviceStatus([3,1,0]).mode).toBe(3);
});
it('requires connection, live valid range and confirmed color but stability is advisory',async()=>{
  const f=fixture();await f.lamp.connect();expect(f.lamp.canStart).toBe(false);
  await f.lamp.setColor(settings);expect(f.events).toEqual([[0,0,0,255,80]]);
  f.receive(packet(0,0));await f.lamp.start(settings);expect(f.events).toHaveLength(1);
  f.receive(packet(0,1));expect(f.lamp.canStart).toBe(true);
  await f.lamp.start(settings);await f.lamp.start(settings);expect(f.events).toEqual([[0,0,0,255,80],16]);expect(f.lamp.state.waiting).toBe('start');
  await f.lamp.disconnect();
});
it('records firmware completion exactly once, locks color, and requires parent end before next round',async()=>{
  const f=fixture();await f.lamp.connect();await f.lamp.setColor(settings);await f.lamp.start(settings);
  f.receive(packet(1,3,400));expect(f.save).not.toHaveBeenCalled();
  await f.lamp.setColor({...settings,preset:'red'});await f.lamp.testLight(2,settings);expect(f.events).toHaveLength(2);
  f.receive(packet(2,3,2400));f.receive(packet(2,3,2400));expect(f.save).toHaveBeenCalledTimes(1);
  expect(f.save.mock.calls[0]![0]).toMatchObject({outcome:'found',sample:{elapsedMs:2400},color:[0,0,0,255,80]});
  expect(f.lamp.canStart).toBe(false);await f.lamp.end();expect(f.events.at(-1)).toBe(17);
  f.receive(packet());expect(f.lamp.canStart).toBe(true);await f.lamp.start(settings);f.receive(packet(2,3,100));
  expect(f.save).toHaveBeenCalledTimes(2);await f.lamp.disconnect();
});
it('does not import a result already present at connection',async()=>{
  const f=fixture();await f.lamp.connect();f.receive(packet(2,3,9000));expect(f.save).not.toHaveBeenCalled();expect(f.lamp.locked).toBe(true);await f.lamp.end();f.receive(packet());await f.lamp.disconnect();
});
it('uses start acknowledgement and times out without automatic retry',async()=>{
  const f=fixture();await f.lamp.connect();await f.lamp.setColor(settings);await f.lamp.start(settings);
  for(let i=0;i<5;i++){f.receive(packet());await vi.advanceTimersByTimeAsync(1000);}
  await flush();expect(f.lamp.state.connected).toBe(false);expect(f.events.filter(v=>v===16)).toHaveLength(1);expect(f.save).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it('missing notifications and disconnect abort confirmed rounds without inventing completion',async()=>{
  const f=fixture();await f.lamp.connect();await f.lamp.setColor(settings);await f.lamp.start(settings);f.receive(packet(1));
  await vi.advanceTimersByTimeAsync(3000);await flush();expect(f.save).toHaveBeenCalledOnce();expect(f.save.mock.calls[0]![0].outcome).toBe('aborted');
  f.receive(packet(2,3,5000));expect(f.save).toHaveBeenCalledOnce();expect(f.lamp.state.sample).toBeNull();
});
it('old firmware is rejected and cleanup closes the connection',async()=>{
  const f=fixture();await f.lamp.connect();f.receive([0,0,0,0,0,0,0]);await flush();expect(f.lamp.state.message).toContain('10 字节');expect(f.events.slice(-2)).toEqual([0,'disconnect']);
});
it('honors profile restrictions and sends only supported commands',async()=>{
  const f=fixture();await f.lamp.connect();await f.lamp.setColor({...settings,brightness:255,highLightSensitivity:true});
  await f.lamp.testLight(1,{...settings,photosensitive:true});await f.lamp.start({...settings,tactileSensitive:true});
  expect(f.events).toEqual([[0,0,0,255,96]]);await f.lamp.testLight(2,settings);await f.lamp.testLight(1,settings);expect(f.events.slice(-2)).toEqual([2,1]);
  await f.lamp.readStatus();expect(f.lamp.state.reported).toMatchObject({mode:3,found:true});await f.lamp.disconnect();
});
it('leaving during selection or pending color never starts late work',async()=>{
  const f=fixture();let resolve!:(c:LampConnection)=>void;f.connect.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const opening=f.lamp.connect();f.lamp.dispose();resolve(f.connection);await opening;await flush();expect(f.events).toEqual([0,'disconnect']);
  const g=fixture();await g.lamp.connect();let color!:()=>void;vi.mocked(g.connection.writeLight).mockImplementationOnce(()=>new Promise(r=>{color=r;}));
  const writing=g.lamp.setColor(settings);g.lamp.dispose();color();await writing;await flush();expect(g.events).toEqual([0,'disconnect']);
});
it('rejects a failed start and does not leave the next round available on uncertain state',async()=>{
  const f=fixture();await f.lamp.connect();await f.lamp.setColor(settings);vi.mocked(f.connection.writeAlert).mockRejectedValueOnce(Error('write failed'));
  await f.lamp.start(settings);await flush();expect(f.lamp.state.connected).toBe(false);expect(f.save).not.toHaveBeenCalled();expect(f.events.slice(-2)).toEqual([0,'disconnect']);
});
it('end waits for phase zero and repeated found packets during ending never create results',async()=>{
  const f=fixture();await f.lamp.connect();await f.lamp.setColor(settings);await f.lamp.start(settings);f.receive(packet(1,3,400));
  await f.lamp.end();f.receive(packet(2,3,600));expect(f.lamp.state.waiting).toBe('end');expect(f.save).toHaveBeenCalledOnce();expect(f.save.mock.calls[0]![0].outcome).toBe('aborted');
  f.receive(packet());expect(f.lamp.state.waiting).toBeNull();await f.lamp.disconnect();
});
it('desktop subscribes to actual GATT range characteristic, respects view offsets and removes callbacks',async()=>{
  const incoming=new Uint8Array([99,...packet(1,3,3210),99]);
  const range=Object.assign(new EventTarget(),{value:new DataView(incoming.buffer,1,10),startNotifications:vi.fn(async()=>{}),stopNotifications:vi.fn(async()=>{}),readValue:vi.fn(async()=>new DataView(incoming.buffer,1,10))});
  const getCharacteristic=vi.fn(async(uuid:string)=>uuid.includes('0004-')?range:{writeValue:vi.fn(async()=>{})});
  const device=Object.assign(new EventTarget(),{gatt:{connected:true,connect:async()=>({getPrimaryService:async()=>({getCharacteristic})}),disconnect:vi.fn()}});
  const before=Object.getOwnPropertyDescriptor(window.navigator,'bluetooth');Object.defineProperty(window.navigator,'bluetooth',{configurable:true,value:{requestDevice:async()=>device}});
  try{
    const c=await connectLamp(vi.fn()),received=vi.fn();await c.subscribeRange!(received);
    range.dispatchEvent(new Event('characteristicvaluechanged'));expect(received).toHaveBeenCalledTimes(2);expect(decodeRange(received.mock.calls[0]![0]).elapsedMs).toBe(3210);
    await c.disconnect();range.dispatchEvent(new Event('characteristicvaluechanged'));expect(received).toHaveBeenCalledTimes(2);expect(range.stopNotifications).toHaveBeenCalledOnce();
  }finally{if(before)Object.defineProperty(window.navigator,'bluetooth',before);else delete (window.navigator as Navigator &{bluetooth?:unknown}).bluetooth;}
});
it('the real screen exposes preparation and training, locks edits, and records without remounting',async()=>{
  const f=fixture();Object.defineProperty(window,'microstarLampBridge',{configurable:true,value:{connect:f.connect}});
  const {render}=await import('../src/screens/physical.js');const {store}=await import('../src/lib/store.js');
  store.state.child.tactileSensitive=false;store.state.child.photosensitive=false;store.state.sessions=[];
  const page=render({navigate:vi.fn(),rerender:vi.fn()});
  const button=(name:string)=>[...page.el.querySelectorAll('button')].find(x=>x.textContent===name)!;
  try{
    expect(button('开始找').disabled).toBe(true);button('连接提示灯').click();await flush();button('确认颜色和亮度').click();await flush();
    expect(button('开始找').disabled).toBe(false);button('开始找').click();await flush();f.receive(packet(1,3,400));
    expect(button('确认颜色和亮度').disabled).toBe(true);f.receive(packet(2,3,2300));f.receive(packet(2,3,2300));
    expect(store.state.sessions).toHaveLength(1);expect(store.state.sessions[0]?.rangeResult?.sample?.elapsedMs).toBe(2300);
    expect(page.el.textContent).toContain('2.3 秒');expect(button('开始找').disabled).toBe(true);
    button('结束训练').click();await flush();f.receive(packet());expect(button('开始找').disabled).toBe(false);
  }finally{page.destroy?.();await flush();delete (window as Window &{microstarLampBridge?:unknown}).microstarLampBridge;}
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { DeviceLamp } from '../src/lib/device-lamp.js';
import type { LampConnection, LampSettings } from '../src/lib/manual-lamp.js';
const settings: LampSettings={preset:'red',brightness:75,photosensitive:false,highLightSensitivity:false,tactileSensitive:false};
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
function fake() {
  const events:unknown[]=[];
  const connection: LampConnection={writeLight:vi.fn(async b=>{events.push([...b]);}),writeAlert:vi.fn(async v=>{events.push(v);}),disconnect:vi.fn(async()=>{events.push('disconnect');}),readStatus:vi.fn(async()=>[1,0,1])};
  const connect=vi.fn(async(_off:()=>void)=>connection);
  const lamp=new DeviceLamp(vi.fn(),connect);
  return {lamp,connection,connect,events};
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('only marks connected after the real connector succeeds, with no automatic test light',async()=>{
  const f=fake();f.connect.mockRejectedValueOnce(Error('permission denied'));
  await f.lamp.connect();expect(f.lamp.state.connected).toBe(false);expect(f.events).toEqual([]);
  await f.lamp.connect();expect(f.lamp.state.connected).toBe(true);expect(f.events).toEqual([]);
  await f.lamp.blink(settings);expect(f.events).toEqual([[255,0,0,0,75],1]);
  await f.lamp.stop();await f.lamp.disconnect();expect(f.events.slice(-3)).toEqual([0,0,'disconnect']);
});
it('color writes never enable unsupported modes; profile restrictions block all flashing',async()=>{
  const f=fake();await f.lamp.connect();
  await f.lamp.setColor({...settings,brightness:255,highLightSensitivity:true});expect(f.events).toEqual([[255,0,0,0,96]]);
  await f.lamp.blink({...settings,photosensitive:true});await f.lamp.blink({...settings,tactileSensitive:true},2000);
  expect(f.connection.writeAlert).not.toHaveBeenCalled();await f.lamp.disconnect();
});
it('reads actual status, rejects invalid responses, and clears stale reports on disconnect',async()=>{
  const f=fake();await f.lamp.connect();await f.lamp.readStatus();
  expect(f.lamp.state.reported).toMatchObject({blinking:true,moving:false,imuOk:true});
  vi.mocked(f.connection.readStatus!).mockResolvedValueOnce([1]);await f.lamp.readStatus();
  expect(f.lamp.state.reported).toBeNull();expect(f.lamp.state.message).toContain('格式不正确');
  await f.lamp.readStatus();f.connect.mock.calls[0]![0]();
  expect(f.lamp.state.connected).toBe(false);expect(f.lamp.state.reported).toBeNull();
});
it('short tests really start and stop; leaving interrupts timers and closes the connection',async()=>{
  vi.useFakeTimers();const f=fake();await f.lamp.connect();
  const test=f.lamp.blink(settings,2000);await flush();expect(f.events.at(-1)).toBe(1);
  await vi.advanceTimersByTimeAsync(2000);await test;expect(f.events.at(-1)).toBe(0);
  const find=f.lamp.blink(settings,3000);await flush();f.lamp.dispose();await find;await flush();
  expect(f.events.slice(-2)).toEqual([0,'disconnect']);expect(vi.getTimerCount()).toBe(0);
});
it('background disconnect prevents a start after a pending color write',async()=>{
  const f=fake();let finish!:()=>void;await f.lamp.connect();
  vi.mocked(f.connection.writeLight).mockImplementationOnce(()=>new Promise<void>(r=>{finish=r;}));
  const start=f.lamp.blink(settings);const stop=f.lamp.disconnect();finish();await Promise.all([start,stop]);
  expect(f.events).toEqual([0,'disconnect']);expect(f.lamp.state.connected).toBe(false);
});
it('leaving during selection closes a late connection without starting it',async()=>{
  const f=fake();let selected!:(c:LampConnection)=>void;
  f.connect.mockImplementationOnce(()=>new Promise(r=>{selected=r;}));
  const opening=f.lamp.connect();f.lamp.dispose();selected(f.connection);await opening;
  expect(f.events).toEqual([0,'disconnect']);
});
it('device screen exposes only protocol-backed controls and updates without remounting',async()=>{
  const f=fake();Object.defineProperty(window,'microstarLampBridge',{configurable:true,value:{connect:f.connect}});
  const {render}=await import('../src/screens/device.js');const {store}=await import('../src/lib/store.js');
  store.state.child.photosensitive=false;store.state.child.tactileSensitive=false;
  const page=render({navigate:vi.fn(),rerender:vi.fn()});
  const click=(name:string)=>{const b=[...page.el.querySelectorAll('button')].find(x=>x.textContent===name)!;expect(b).toBeDefined();b.click();};
  try {
    expect(page.el.textContent).not.toMatch(/模拟设备|常亮|呼吸|自检通过|大约还能练|调试台/);
    click('连接提示灯');await flush();expect(page.el.textContent).toContain('已连接 MicroStar');
    click('红色');await flush();expect(f.connection.writeLight).toHaveBeenCalled();
    click('读取状态');await flush();expect(page.el.textContent).toContain('设备报告：闪烁开启');
    click('停止并断开');await flush();expect(f.connection.disconnect).toHaveBeenCalled();
  } finally {page.destroy?.();delete (window as Window & {microstarLampBridge?:unknown}).microstarLampBridge;}
});

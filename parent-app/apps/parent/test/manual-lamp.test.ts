// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALERT_UUID, LIGHT_UUID, SERVICE_UUID } from "@microstar/core-protocol";
import { connectLamp, ManualLamp, type LampConnection, type LampSettings } from "../src/lib/manual-lamp.js";

const settings: LampSettings = { preset: "warmWhite", brightness: 80, photosensitive: false, highLightSensitivity: false, tactileSensitive: false };
const flush = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };
function fake() {
  const events: unknown[] = [];
  const connection: LampConnection = {
    writeLight: vi.fn(async bytes => { events.push(["LIGHT", ...bytes]); }),
    writeAlert: vi.fn(async byte => { events.push(["ALERT", byte]); }),
    disconnect: vi.fn(async () => { events.push("disconnect"); }),
  };
  const connect = vi.fn(async (_off: () => void) => connection);
  const lamp = new ManualLamp(vi.fn(), connect);
  return { lamp, connect, connection, events };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("第四阶段手动控灯", () => {
  it("matches the supplied example bytes and stops before disconnecting", async () => {
    const f=fake(); await f.lamp.toggle(settings);
    expect(f.events).toEqual([["LIGHT",0,0,0,255,80],["ALERT",1]]);
    expect(f.lamp.state.active).toBe(true);
    await f.lamp.toggle(settings);
    expect(f.events).toEqual([["LIGHT",0,0,0,255,80],["ALERT",1],["ALERT",0],"disconnect"]);
    expect(f.lamp.state.active).toBe(false);
  });
  it("uses plan color, clamps brightness, and preserves existing profile restrictions", async () => {
    const f=fake(); await f.lamp.toggle({...settings,preset:"red",brightness:255,highLightSensitivity:true});
    expect(f.events[0]).toEqual(["LIGHT",255,0,0,0,96]); await f.lamp.stop();
    for (const flag of ["photosensitive","tactileSensitive"] as const) {
      const blocked=fake(); await blocked.lamp.toggle({...settings,[flag]:true});
      expect(blocked.connect).not.toHaveBeenCalled(); expect(blocked.lamp.state.active).toBe(false);
    }
  });
  it("does not flash after leaving the screen during device selection", async () => {
    const f=fake(); let selected!: (c:LampConnection)=>void;
    f.connect.mockImplementationOnce(()=>new Promise(resolve=>{selected=resolve;}));
    const pending=f.lamp.toggle(settings); f.lamp.dispose(); selected(f.connection); await pending;
    expect(f.events).toEqual([["ALERT",0],"disconnect"]);
  });
  it("serializes stop with a pending color write and never sends a late start", async () => {
    const f=fake(); let finish!:()=>void;
    vi.mocked(f.connection.writeLight).mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
    const start=f.lamp.toggle(settings); await flush();
    const stop=f.lamp.stop(); finish(); await Promise.all([start,stop]);
    expect(f.events).toEqual([["ALERT",0],"disconnect"]);
  });
  it("prevents duplicate connection requests and handles failure honestly", async () => {
    const f=fake(); let selected!:(c:LampConnection)=>void;
    f.connect.mockImplementationOnce(()=>new Promise(resolve=>{selected=resolve;}));
    const start=f.lamp.toggle(settings); await f.lamp.toggle(settings); expect(f.connect).toHaveBeenCalledTimes(1);
    selected(f.connection); await start;
    vi.mocked(f.connection.writeAlert).mockRejectedValueOnce(Error("write failed"));
    await f.lamp.stop(); expect(f.lamp.state.message).toContain("停止未确认"); expect(f.connection.disconnect).toHaveBeenCalledOnce();
  });
  it("cleans up on write failure and resets after external disconnect", async () => {
    const f=fake(); vi.mocked(f.connection.writeLight).mockRejectedValueOnce(Error("wrong service"));
    await f.lamp.toggle(settings); expect(f.lamp.state.active).toBe(false); expect(f.events).toEqual([["ALERT",0],"disconnect"]);
    await f.lamp.toggle(settings); f.connect.mock.calls.at(-1)![0]();
    expect(f.lamp.state.message).toContain("断开"); expect(f.lamp.state.active).toBe(false);
  });
  it("never substitutes a mock device when browser BLE is unavailable", async () => {
    vi.stubGlobal("navigator",{});
    await expect(connectLamp(vi.fn())).rejects.toThrow("Chrome / Edge");
  });
  it("selects the exact supplied UUIDs and writes raw bytes on desktop", async () => {
    const alert={writeValue:vi.fn(async()=>{})},light={writeValue:vi.fn(async()=>{})};
    const getCharacteristic=vi.fn(async(uuid:string)=>uuid===ALERT_UUID?alert:light);
    const getPrimaryService=vi.fn(async()=>({getCharacteristic}));
    const selected=Object.assign(new EventTarget(),{gatt:{connected:true,connect:vi.fn(async()=>({getPrimaryService})),disconnect:vi.fn()}});
    const requestDevice=vi.fn(async()=>selected);
    vi.stubGlobal("navigator",{bluetooth:{requestDevice}});
    const c=await connectLamp(vi.fn()); await c.writeLight(new Uint8Array([0,0,0,255,80])); await c.writeAlert(1); await c.disconnect();
    expect(requestDevice).toHaveBeenCalledWith({filters:[{name:"MicroStar"},{services:[SERVICE_UUID]}],optionalServices:[SERVICE_UUID]});
    expect(getPrimaryService).toHaveBeenCalledWith(SERVICE_UUID);
    expect(getCharacteristic.mock.calls.map(x=>x[0])).toEqual([ALERT_UUID,LIGHT_UUID]);
    expect([...alert.writeValue.mock.calls[0]![0] as unknown as Uint8Array]).toEqual([1]);
    expect(selected.gatt.disconnect).toHaveBeenCalledOnce();
  });
  it("uses the top-window native bridge inside Android instead of Web Bluetooth", async () => {
    const f=fake(); const native={connect:f.connect};
    Object.defineProperty(window,"microstarLampBridge",{value:native,configurable:true});
    try { expect(await connectLamp(vi.fn())).toBe(f.connection); expect(f.connect).toHaveBeenCalledOnce(); }
    finally { delete (window as Window & {microstarLampBridge?:unknown}).microstarLampBridge; }
  });
});

describe("控灯按钮范围", () => {
  it("appears only in stage 4 and requests no connection while rendering", async () => {
    const {store}=await import("../src/lib/store.js");
    const {render}=await import("../src/screens/train.js");
    const context={navigate:vi.fn(),rerender:vi.fn()};
    const bluetooth={requestDevice:vi.fn()}; vi.stubGlobal("navigator",{bluetooth});
    for(const stage of [1,2,3,4] as const){
      store.state.plan.stage=stage;
      const screen=render(context);
      expect(screen.el.querySelectorAll("[data-manual-lamp]").length).toBe(stage===4?1:0);
      screen.destroy?.();
    }
    expect(bluetooth.requestDevice).not.toHaveBeenCalled();
  });
});

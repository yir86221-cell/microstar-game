const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const { createNativeLampBridge } = await import('../native/lamp-bridge-core.mjs');
  const uuid = n => `8a1f000${n}-3c4d-4e5f-9a6b-7c8d9e0f1a2b`;
  const protocol = { SERVICE_UUID:uuid(1),ALERT_UUID:uuid(2),LIGHT_UUID:uuid(3),DEVICE_NAME:'MicroStar' };
  const calls=[];
  let disconnected;
  const client={
    async initialize(options){calls.push(['initialize',options]);},async isEnabled(){return true;},
    async requestDevice(options){calls.push(['request',options]);return {deviceId:'test-lamp'};},
    async connect(id,callback){disconnected=callback;calls.push(['connect',id]);},
    async write(id,service,char,data){calls.push(['write',service,char,Array.from(new Uint8Array(data.buffer))]);},
    async disconnect(id){calls.push(['disconnect',id]);},
  };
  const bridge=createNativeLampBridge(client,protocol);
  let events=0;
  const c=await bridge.connect(()=>events++);
  assert.deepEqual(calls[0],['initialize',{androidNeverForLocation:true}]);
  assert.deepEqual(calls[1],['request',{name:'MicroStar',optionalServices:[uuid(1)]}]);
  await bridge.stopActive();assert.equal(events,0,'permission/selection pause cannot cancel a new connection');
  await c.writeLight(new Uint8Array([0,0,0,255,80]));await c.writeAlert(1);
  assert.deepEqual(calls.slice(-2),[['write',uuid(1),uuid(3),[0,0,0,255,80]],['write',uuid(1),uuid(2),[1]]]);
  await assert.rejects(c.writeAlert(2));await assert.rejects(c.writeLight([0,0,0,255,255]));
  await assert.rejects(bridge.connect(()=>{}),/连接正在使用/);
  await bridge.stopActive();assert.equal(events,1);assert.deepEqual(calls.at(-2),['write',uuid(1),uuid(2),[0]]);
  await assert.rejects(c.writeAlert(1),/断开/);
  const again=await bridge.connect(()=>events++);disconnected();await assert.rejects(again.writeAlert(1),/断开/);
  const owner=new EventTarget();
  const owned=await bridge.connect(()=>{},owner);await owned.writeAlert(1);
  owner.dispatchEvent(new Event('pagehide'));
  for(let i=0;i<15;i++)await Promise.resolve();
  assert.deepEqual(calls.at(-2),['write',uuid(1),uuid(2),[0]],'removing iframe sends stop from the host');
  assert.deepEqual(calls.at(-1),['disconnect','test-lamp']);
  await assert.rejects(owned.writeAlert(1),/断开/);
  // Assert native wiring, not just the fake client: root script, plugin and permissions.
  const root=path.resolve(__dirname,'..');
  assert.match(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),/src="native-lamp.js"/);
  assert.match(fs.readFileSync(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8'),/neverForLocation/);
  assert.match(fs.readFileSync(path.join(root,'native/lamp-bridge.js'),'utf8'),/Capacitor.isNativePlatform/);
  console.log('PASS: Android native BLE bridge bytes, selection, background stop, disconnect and validation.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

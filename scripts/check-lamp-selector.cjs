const assert = require('node:assert/strict');
async function main() {
  const { createLampSelector } = await import('../native/lamp-selector-core.mjs');
  const { createNativeLampBridge } = await import('../native/lamp-bridge-core.mjs');
  const flush = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };
  const options = { name: 'MicroStar' };
  function fixture(extra = {}, scanTime = 10000) {
    let actions, report;
    const events = [], results = [];
    const client = {
      async requestLEScan(opts, callback) { assert.deepEqual(opts, {name:'MicroStar',allowDuplicates:false}); report=callback; events.push('scan'); },
      async stopLEScan() { events.push('stop'); }, ...extra,
    };
    const selector = createLampSelector(client, a => { actions = a; return {
      devices(items) { results.push(items); }, scanEnded() { events.push('scanEnded'); },
      busy() { events.push('busy'); }, close() { events.push('close'); },
    }; }, {scanTime});
    return { selector, client, events, results, get actions() { return actions; },
      report(id='lamp-a',name='MicroStar') { report({device:{deviceId:id,name}}); } };
  }
  const f=fixture(); const pending=f.selector.select(options); await flush();
  f.report('other','Other'); f.report(); f.report(); f.report('lamp-b');
  assert.equal(f.results.length,2); assert.equal(f.results.at(-1).length,2);
  f.actions.choose('unknown'); assert.equal(f.events.includes('stop'),false);
  f.actions.choose('lamp-b'); f.actions.choose('lamp-a'); f.actions.cancel();
  assert.equal((await pending).deviceId,'lamp-b','selected device cannot be overwritten by late UI cancel or double tap');
  assert.deepEqual(f.events,['scan','busy','stop','close']);
  const cancelled=f.selector.select(options); await flush(); f.actions.cancel();
  await assert.rejects(cancelled,/已取消/); assert.equal(f.selector.cancel(),false);
  const owner = new AbortController(); const abandoned=f.selector.select(options,{signal:owner.signal});
  await flush(); owner.abort(); await assert.rejects(abandoned,/已取消/);
  let started;
  const late=fixture({ requestLEScan:()=>new Promise(resolve=>{started=resolve;}) });
  const opening=late.selector.select(options); late.selector.cancel(); await flush();
  assert.equal(late.events.includes('stop'),false,'wait for pending start before stopping');
  started(); await assert.rejects(opening,/已取消/); assert.ok(late.events.includes('stop'));
  const empty=fixture({},5); await assert.rejects(empty.selector.select(options),/未找到 MicroStar/);
  assert.deepEqual(empty.events,['scan','stop','busy','close']);
  const held=fixture({},5); const heldChoice=held.selector.select(options); held.report();
  await new Promise(resolve=>setTimeout(resolve,15)); held.actions.choose('lamp-a');
  assert.equal((await heldChoice).deviceId,'lamp-a'); assert.equal(held.events.filter(x=>x==='stop').length,1);
  const failed=fixture({async requestLEScan(){throw Error('scan unavailable');}});
  await assert.rejects(failed.selector.select(options),/scan unavailable/); assert.ok(failed.events.includes('close'));
  const stopFailed=fixture({async stopLEScan(){throw Error('stop failed');}});
  const noConnection=stopFailed.selector.select(options); stopFailed.report(); stopFailed.actions.choose('lamp-a');
  await assert.rejects(noConnection,/stop failed/);
  const flow=fixture();
  Object.assign(flow.client, {
    async initialize(){},async isEnabled(){return true;},
    async requestDevice(){throw Error('requestDevice cancelled.');},
    async disconnect(){flow.events.push('disconnect');},
    async connect(){flow.events.push('connect');},async write(){flow.events.push('write');},
  });
  const bridge=createNativeLampBridge(flow.client,{SERVICE_UUID:'service',ALERT_UUID:'alert',LIGHT_UUID:'light',DEVICE_NAME:'MicroStar'},flow.selector.select);
  const connection=bridge.connect(()=>{}); await flush(); flow.report(); flow.actions.choose('lamp-a');
  const lamp=await connection; await lamp.writeLight([255,0,0,0,75]); await lamp.writeAlert(1); await lamp.disconnect();
  assert.ok(flow.events.indexOf('stop')<flow.events.indexOf('connect'),'stop scan before connecting; never invoke faulty requestDevice');
  assert.equal(flow.events.filter(x=>x==='connect').length,1);
  assert.equal(flow.events.filter(x=>x==='write').length,2);
  console.log('PASS: Native lamp chooser, explicit selection, duplicates, late cancel, abort, scan cleanup, timeout, and BLE connection integration.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

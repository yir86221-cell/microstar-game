// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { CutoutModel, CUTOUT_TIMEOUT_MS } from '../src/lib/cutout-model.js';
function setup() {
  const workers: any[] = [];
  const factory = vi.fn(() => {
    const worker = { onmessage: null, onerror: null, onmessageerror: null, postMessage: vi.fn(), terminate: vi.fn() };
    workers.push(worker); return worker as unknown as Worker;
  });
  const model = new CutoutModel(factory), photo = new Image(); photo.src = 'data:image/png;base64,AAAA';
  const reply = (worker: any, body: object) => worker.onmessage({ data: { id: worker.postMessage.mock.lastCall[0].id, ...body } });
  return { model, photo, workers, factory, reply };
}
afterEach(() => vi.useRealTimers());
it('sends local assets and photo to a worker, accepts progress and reuses it for new points', async () => {
  const {model,photo,workers,factory,reply}=setup(), progress=vi.fn();
  const pending=model.select(photo,.5,.4,progress);const w=workers[0];
  expect(w.postMessage.mock.lastCall[0]).toMatchObject({source:photo.src,x:.5,y:.4,base:new URL('./cutout/',document.baseURI).href});
  reply(w,{type:'progress',stage:'encoding'});expect(progress).toHaveBeenCalledWith('encoding');
  reply(w,{type:'result',width:2,height:1,mask:new Uint8ClampedArray([0,255])});
  expect((await pending).mask).toEqual(new Uint8ClampedArray([0,255]));
  const again=model.select(photo,.7,.4);reply(w,{type:'result',width:2,height:1,mask:new Uint8ClampedArray([0,255])});await again;
  expect(factory).toHaveBeenCalledTimes(1);model.close();expect(w.terminate).toHaveBeenCalledTimes(1);
});
it('cancels the actual worker and ignores its late result when retrying', async () => {
  const {model,photo,workers,reply}=setup();
  const pending=model.select(photo,.5,.5);const rejected=expect(pending).rejects.toMatchObject({code:'cancelled'});
  const old=workers[0];model.cancel();await rejected;expect(old.terminate).toHaveBeenCalledOnce();
  const again=model.select(photo,.6,.5);reply(old,{type:'error'});expect(workers[1].terminate).not.toHaveBeenCalled();
  reply(workers[1],{type:'result',width:1,height:1,mask:new Uint8ClampedArray([255])});expect((await again).mask[0]).toBe(255);model.close();
});
it('terminates stalled inference after 45 seconds, allowing a fresh retry', async () => {
  vi.useFakeTimers();const {model,photo,workers,reply}=setup();
  const pending=model.select(photo,.5,.5);const rejected=expect(pending).rejects.toMatchObject({code:'timeout'});
  await vi.advanceTimersByTimeAsync(CUTOUT_TIMEOUT_MS);await rejected;expect(workers[0].terminate).toHaveBeenCalledOnce();
  const again=model.select(photo,.5,.5);reply(workers[1],{type:'result',width:1,height:1,mask:new Uint8ClampedArray([255])});await again;
  expect(vi.getTimerCount()).toBe(0);model.close();
});
it('closing while loading rejects pending work and prevents restarting a disposed editor', async () => {
  const {model,photo,workers}=setup();const pending=model.select(photo,.5,.5);
  const rejected=expect(pending).rejects.toMatchObject({code:'closed'});model.close();await rejected;
  expect(workers[0].terminate).toHaveBeenCalledOnce();await expect(model.select(photo,.5,.5)).rejects.toMatchObject({code:'closed'});
});
it.each(['onerror','onmessageerror','error'])('recovers from %s without running a main-thread fallback', async type => {
  const {model,photo,workers,reply}=setup();const pending=model.select(photo,.5,.5);
  const rejected=expect(pending).rejects.toMatchObject({code:'unavailable'});
  if(type==='error')reply(workers[0],{type:'error'});else workers[0][type]();
  await rejected;expect(workers[0].terminate).toHaveBeenCalledOnce();model.close();
});
it('reports unsupported worker creation and rejects concurrent selection', async () => {
  const unavailable=new CutoutModel(()=>{throw Error('unsupported');});
  await expect(unavailable.select(new Image(),.5,.5)).rejects.toMatchObject({code:'unavailable'});
  const {model,photo}=setup();const pending=model.select(photo,.5,.5);
  await expect(model.select(photo,.5,.5)).rejects.toMatchObject({code:'busy'});
  const rejected=expect(pending).rejects.toMatchObject({code:'cancelled'});model.cancel();await rejected;
});

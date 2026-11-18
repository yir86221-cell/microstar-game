// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fake=vi.hoisted(()=>({create:vi.fn(),files:vi.fn(async()=>({}))}));
vi.mock('@mediapipe/tasks-vision',()=>({FilesetResolver:{forVisionTasks:fake.files},InteractiveSegmenter:{createFromOptions:fake.create}}));
let oldHandler: typeof window.onmessage;
beforeEach(()=>{oldHandler=window.onmessage;vi.resetModules();vi.clearAllMocks();});
afterEach(()=>{window.onmessage=oldHandler;vi.unstubAllGlobals();vi.restoreAllMocks();});
async function setup(){
 const bitmap={width:2,height:1,close:vi.fn()},mask={width:2,height:1,getAsFloat32Array:()=>new Float32Array([.2,.9]),close:vi.fn()};
 const task={setImage:vi.fn(),segment:vi.fn(()=>mask),close:vi.fn()};fake.create.mockResolvedValue(task);
 vi.stubGlobal('OffscreenCanvas',class {});vi.stubGlobal('createImageBitmap',vi.fn(async()=>bitmap));
 vi.stubGlobal('fetch',vi.fn(async()=>({blob:async()=>new Blob()})));
 const post=vi.spyOn(window,'postMessage').mockImplementation(()=>{});
 await import('../src/lib/cutout.worker.js');
 const send=async(id:number,source='data:image/png;base64,AAAA')=>await (window.onmessage as any)({data:{id,source,base:'https://localhost/parent/cutout/',x:.5,y:.5}});
 return {bitmap,mask,task,post,send};
}
it('loads module WASM, caches image encoding and transfers the alpha mask',async()=>{
 const {task,mask,bitmap,post,send}=await setup();await send(1);await send(2);
 expect(fake.files).toHaveBeenCalledWith('https://localhost/parent/cutout/wasm',true);
 expect(fake.create).toHaveBeenCalledTimes(1);expect(task.setImage).toHaveBeenCalledTimes(1);expect(mask.close).toHaveBeenCalledTimes(2);
 const result=post.mock.calls.find(([v])=>v.type==='result')!;
 expect(result[0]).toMatchObject({id:1,type:'result',width:2,height:1,mask:new Uint8ClampedArray([0,255])});
 expect(result[1]).toEqual([result[0].mask.buffer]);
 await send(3,'data:image/png;base64,BBBB');expect(bitmap.close).toHaveBeenCalledTimes(1);
});
it('releases failed tasks and bitmaps without losing the ability to retry',async()=>{
 const {task,bitmap,post,send}=await setup();await send(1);
 task.segment.mockImplementationOnce(()=>{throw Error('inference failure');});await send(2);
 expect(post.mock.lastCall?.[0]).toMatchObject({id:2,type:'error'});expect(task.close).toHaveBeenCalledOnce();expect(bitmap.close).toHaveBeenCalledOnce();
 await send(3);expect(fake.create).toHaveBeenCalledTimes(2);expect(post.mock.lastCall?.[0]).toMatchObject({id:3,type:'result'});
});
it('reports an unsupported worker canvas without attempting model loading',async()=>{
 const {post,send}=await setup();vi.stubGlobal('OffscreenCanvas',undefined);await send(1);
 expect(fake.create).not.toHaveBeenCalled();expect(post.mock.lastCall?.[0]).toMatchObject({type:'error'});
});

// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
const fake=vi.hoisted(()=>({close:vi.fn(),setImage:vi.fn(),maskClose:vi.fn(),create:vi.fn(),files:vi.fn(async()=>({}))}));
vi.mock('@mediapipe/tasks-vision',()=>({FilesetResolver:{forVisionTasks:fake.files},InteractiveSegmenter:{createFromOptions:fake.create}}));
import {CutoutModel} from '../src/lib/cutout-model.js';
it('uses same-origin bundled assets and closes masks after copying pixels',async()=>{
  const segment=vi.fn(()=>({width:2,height:1,getAsFloat32Array:()=>new Float32Array([.1,.9]),close:fake.maskClose}));
  fake.create.mockResolvedValueOnce({setImage:fake.setImage,segment,close:fake.close});
  const model=new CutoutModel(),photo=new Image();
  const result=await model.select(photo,.5,.4);await model.select(photo,.7,.4);
  expect(fake.files).toHaveBeenCalledWith(new URL('./cutout/wasm',document.baseURI).href);
  expect(fake.create.mock.calls[0]![1].baseOptions.modelAssetPath).toBe(new URL('./cutout/magic-touch.task',document.baseURI).href);
  expect(fake.setImage).toHaveBeenCalledTimes(1);expect(fake.maskClose).toHaveBeenCalledTimes(2);
  expect(result.data[1]).toBeCloseTo(.9);expect(segment.mock.calls[1]).toEqual([[{brushMode:1,point:[{x:.7,y:.4}],isCompleted:true}]]);
  model.close();expect(fake.close).toHaveBeenCalledTimes(1);
});
it('closes a model that finishes loading after the editor was closed',async()=>{
  let resolve!:(value:unknown)=>void;fake.create.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const model=new CutoutModel();const pending=model.select(new Image(),.5,.5);
  for(let i=0;i<10;i++)await Promise.resolve();model.close();
  const close=vi.fn();resolve({close});await expect(pending).rejects.toThrow('closed');expect(close).toHaveBeenCalledTimes(1);
});

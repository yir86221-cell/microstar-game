import {expect,it} from 'vitest';
import {applyAlpha,brush,imagePoint,maskBounds} from '../src/lib/cutout-mask.js';
it('maps letterboxed portrait/landscape images and rejects taps on the empty bars',()=>{
  expect(imagePoint({left:10,top:20,width:300,height:300},100,200,10,170)).toBeNull();
  expect(imagePoint({left:10,top:20,width:300,height:300},100,200,160,170)).toEqual({x:50,y:100});
  expect(imagePoint({left:0,top:0,width:300,height:300},200,100,150,10)).toBeNull();
  expect(imagePoint({left:0,top:0,width:300,height:300},200,100,150,150)).toEqual({x:100,y:50});
});
it('erases/restores a continuous stroke without changing distant pixels',()=>{
  const mask=new Uint8ClampedArray(100*100).fill(255);
  brush(mask,100,100,{x:10,y:50},{x:90,y:50},4,0);
  for(let x=10;x<=90;x++)expect(mask[50*100+x]).toBe(0);
  expect(mask[20*100+50]).toBe(255);
  brush(mask,100,100,{x:50,y:50},{x:50,y:50},2,255);
  expect(mask[50*100+50]).toBe(255);expect(mask[50*100+20]).toBe(0);
});
it('preserves original RGB, holes and alpha instead of recolouring or filling gaps',()=>{
  const rgba=new Uint8ClampedArray([180,40,70,255,30,200,80,255,250,90,20,128]);
  const output=applyAlpha(rgba,new Uint8ClampedArray([255,0,128]));
  expect([...output]).toEqual([180,40,70,255,30,200,80,0,250,90,20,64]);
  expect(rgba[7]).toBe(255);
});
it('finds crop bounds including narrow handles and rejects an empty subject',()=>{
  const mask=new Uint8ClampedArray(10*10);expect(maskBounds(mask,10,10)).toBeNull();
  mask[23]=255;mask[66]=255;mask[29]=128;
  expect(maskBounds(mask,10,10)).toEqual({x:3,y:2,width:7,height:5});
});

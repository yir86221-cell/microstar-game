import { h } from './dom.js';
import { loadImage, preparePhoto } from './extract.js';
import { CutoutModel } from './cutout-model.js';
import { applyAlpha, brush, imagePoint, maskBounds, type Point } from './cutout-mask.js';

export interface CutoutEditor {
  el:HTMLElement;
  auto():Promise<void>;
  export():Promise<{image:string;thumb:string;sourceImage:string;maskImage:string}>;
  destroy():void;
}
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const context=(c:HTMLCanvasElement)=>{const ctx=c.getContext('2d');if(!ctx)throw Error('当前设备无法处理图片');return ctx;};

export async function createCutoutEditor(source:string,savedMask:string|undefined,onBusy:(value:boolean)=>void):Promise<CutoutEditor>{
  const original=await loadImage(source),w=original.width,hgt=original.height;
  const originalCanvas=canvas(w,hgt),originalCtx=context(originalCanvas);originalCtx.drawImage(original,0,0);
  const rgba=originalCtx.getImageData(0,0,w,hgt).data;
  let mask:Uint8ClampedArray=new Uint8ClampedArray(w*hgt).fill(255);
  if(savedMask){
    try{const img=await loadImage(savedMask);if(img.width===w&&img.height===hgt){const c=canvas(w,hgt),ctx=context(c);ctx.drawImage(img,0,0);const d=ctx.getImageData(0,0,w,hgt).data;mask=Uint8ClampedArray.from(mask,(_,i)=>d[i*4+3]!);}}
    catch{/* Keep the original available if an old mask is unreadable. */}
  }
  const model=new CutoutModel();
  let alive=true,busy=false,mode:'select'|'erase'|'restore'='select',radius=20,compare=false;
  let gesture:{id:number;last:Point;before:Uint8ClampedArray}|null=null;
  const history:Uint8ClampedArray[]=[];
  const pushHistory=(before:Uint8ClampedArray=new Uint8ClampedArray(mask))=>{history.push(before);if(history.length>10)history.shift();};
  const edit=canvas(w,hgt);edit.className='cutout-canvas';edit.setAttribute('aria-label','主体编辑区');
  const preview=h('img',{class:'cutout-preview',alt:'黑底训练效果'}) as HTMLImageElement;
  const status=h('p',{class:'hint',role:'status'},'点选要保留的物品，再用擦除和补回修整边缘。');
  const marker=h('p',{class:'hint'},'编辑区（可点选或涂抹）');
  const cutout=canvas(w,hgt),cutoutCtx=context(cutout);
  function fullMaskImage():string{
    const c=canvas(w,hgt),ctx=context(c),data=ctx.createImageData(w,hgt);
    for(let i=0;i<mask.length;i++){data.data[i*4]=data.data[i*4+1]=data.data[i*4+2]=255;data.data[i*4+3]=mask[i]!;}
    ctx.putImageData(data,0,0);return c.toDataURL('image/png');
  }
  function output():string|null{
    const bounds=maskBounds(mask,w,hgt);if(!bounds)return null;
    const out=canvas(768,768),ctx=context(out),scale=Math.min(646/bounds.width,646/bounds.height);
    const dw=bounds.width*scale,dh=bounds.height*scale;
    ctx.drawImage(cutout,bounds.x,bounds.y,bounds.width,bounds.height,(768-dw)/2,(768-dh)/2,dw,dh);
    return out.toDataURL('image/png');
  }
  function draw(updatePreview=true):void{
    if(!alive)return;
    const d=cutoutCtx.createImageData(w,hgt);d.data.set(applyAlpha(rgba,mask));cutoutCtx.putImageData(d,0,0);
    const ctx=context(edit);ctx.clearRect(0,0,w,hgt);ctx.fillStyle='#000';ctx.fillRect(0,0,w,hgt);
    ctx.globalAlpha=compare?1:.22;ctx.drawImage(original,0,0);ctx.globalAlpha=1;if(!compare)ctx.drawImage(cutout,0,0);
    if(updatePreview){const result=output();preview.hidden=!result;if(result)preview.src=result;else preview.removeAttribute('src');}
    undo.disabled=busy||!history.length;
    marker.textContent=compare?'原图对照（切回后继续编辑）':'编辑区（可点选或涂抹）';
  }
  function setBusy(value:boolean):void{busy=value;for(const b of controls)b.disabled=value;slider.disabled=value;undo.disabled=value||!history.length;onBusy(value);}
  async function select(point:Point):Promise<void>{
    if(busy||!alive)return;
    setBusy(true);status.textContent='正在本机识别主体…';
    // Give the progress message a chance to paint before local model inference.
    await new Promise(resolve=>setTimeout(resolve,30));
    try{
      if(!alive)return;
      const result=await model.select(original,point.x/w,point.y/hgt);
      if(!alive)return;
      const next=new Uint8ClampedArray(w*hgt);
      for(let y=0;y<hgt;y++)for(let x=0;x<w;x++){
        const score=result.data[Math.min(result.height-1,Math.floor(y*result.height/hgt))*result.width+Math.min(result.width-1,Math.floor(x*result.width/w))]!;
        next[y*w+x]=Math.round(Math.max(0,Math.min(1,(score-.35)/.3))*255);
      }
      if(!maskBounds(next,w,hgt))throw Error('empty');
      pushHistory();mask=next;compare=false;draw();status.textContent='已生成抠图，请检查黑底效果。可以重新点选主体，或擦除、补回边缘。';
    }catch(error){console.warn('Local cutout unavailable',error);if(alive)status.textContent='自动抠图未完成。可重新点选重试，也可用擦除、补回手动修整；原图仍保留。';}
    finally{if(alive){setBusy(false);draw();}}
  }
  const controls:HTMLButtonElement[]=[];
  const button=(label:string,action:()=>void)=>{const b=h('button',{type:'button',class:'btn ghost small',onClick:action},label) as HTMLButtonElement;controls.push(b);return b;};
  const modeButtons=(['select','erase','restore'] as const).map((value,i)=>button(['点选主体','擦除','补回'][i]!,()=>{
    mode=value;compare=false;for(let j=0;j<modeButtons.length;j++)modeButtons[j]!.setAttribute('aria-pressed',String(j===i));draw();
  }));modeButtons[0]!.setAttribute('aria-pressed','true');
  const undo=button('撤销',()=>{const previous=history.pop();if(previous){mask=previous;compare=false;draw();}});
  const slider=h('input',{type:'range',min:4,max:60,value:radius,'aria-label':'画笔大小',onInput:(e:Event)=>{radius=Number((e.target as HTMLInputElement).value);}}) as HTMLInputElement;
  const toolbar=h('div',{class:'cutout-tools'},...modeButtons,undo,
    button('原图对照',()=>{compare=!compare;draw();}),
    button('重新抠图',()=>void select({x:w/2,y:hgt/2})),
    button('恢复完整原图',()=>{pushHistory();mask.fill(255);compare=false;draw();status.textContent='已恢复完整原图，可重新抠图或手动擦除背景。';}));
  function point(e:PointerEvent){return imagePoint(edit.getBoundingClientRect(),w,hgt,e.clientX,e.clientY);}
  edit.addEventListener('pointerdown',e=>{
    if(busy||compare||gesture||e.isPrimary===false||e.button!==0)return;
    const p=point(e);if(!p)return;e.preventDefault();
    if(mode==='select'){void select(p);return;}
    gesture={id:e.pointerId,last:p,before:new Uint8ClampedArray(mask)};edit.setPointerCapture?.(e.pointerId);
    brush(mask,w,hgt,p,p,radius,mode==='erase'?0:255);draw(false);
  });
  edit.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;const p=point(e);if(!p)return;
    brush(mask,w,hgt,gesture.last,p,radius,mode==='erase'?0:255);gesture.last=p;draw(false);e.preventDefault();});
  const finish=(e:PointerEvent,cancel=false)=>{if(!gesture||e.pointerId!==gesture.id)return;
    if(cancel)mask=gesture.before;else pushHistory(gesture.before);gesture=null;
    if(edit.hasPointerCapture?.(e.pointerId))edit.releasePointerCapture(e.pointerId);draw();};
  edit.addEventListener('pointerup',e=>finish(e));edit.addEventListener('pointercancel',e=>finish(e,true));edit.addEventListener('lostpointercapture',e=>finish(e));
  const el=h('div',{class:'cutout-editor'},toolbar,h('label',{class:'field'},h('span',null,'画笔大小'),slider),status,
    h('div',{class:'cutout-panes'},h('div',null,marker,edit),h('div',null,h('p',{class:'hint'},'黑底训练效果'),preview)));
  draw();
  return {el,auto:()=>select({x:w/2,y:hgt/2}),
    async export(){if(busy)throw Error('请等待抠图完成。');const image=output();if(!image)throw Error('没有保留的物品，请补回主体或重新抠图。');
      return {image,thumb:await preparePhoto(image,160),sourceImage:source,maskImage:fullMaskImage()};},
    destroy(){alive=false;gesture=null;model.close();history.length=0;}};
}

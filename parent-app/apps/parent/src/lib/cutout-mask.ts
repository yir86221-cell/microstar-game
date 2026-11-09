export type Point = {x:number;y:number};
export function imagePoint(rect:{left:number;top:number;width:number;height:number}, width:number,height:number,x:number,y:number):Point|null {
  const scale=Math.min(rect.width/width,rect.height/height);
  const left=rect.left+(rect.width-width*scale)/2, top=rect.top+(rect.height-height*scale)/2;
  const px=(x-left)/scale, py=(y-top)/scale;
  return px>=0&&px<=width&&py>=0&&py<=height?{x:Math.min(width-1,px),y:Math.min(height-1,py)}:null;
}
/** A continuous stroke, including widely spaced pointer events. */
export function brush(mask:Uint8ClampedArray,w:number,h:number,from:Point,to:Point,radius:number,value:number):void {
  const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/Math.max(1,radius/2)));
  for(let s=0;s<=steps;s++){
    const x=from.x+(to.x-from.x)*s/steps,y=from.y+(to.y-from.y)*s/steps;
    for(let j=Math.max(0,Math.floor(y-radius));j<=Math.min(h-1,Math.ceil(y+radius));j++)
      for(let i=Math.max(0,Math.floor(x-radius));i<=Math.min(w-1,Math.ceil(x+radius));i++)
        if((i-x)**2+(j-y)**2<=radius**2)mask[j*w+i]=value;
  }
}
export function maskBounds(mask:Uint8ClampedArray,w:number,h:number):{x:number;y:number;width:number;height:number}|null {
  let x=w,y=h,right=-1,bottom=-1;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(mask[j*w+i]!>16){x=Math.min(x,i);y=Math.min(y,j);right=Math.max(right,i);bottom=Math.max(bottom,j);}
  return right<0?null:{x,y,width:right-x+1,height:bottom-y+1};
}
export function applyAlpha(rgba:Uint8ClampedArray,mask:Uint8ClampedArray):Uint8ClampedArray {
  const result=new Uint8ClampedArray(rgba);
  for(let i=0;i<mask.length;i++)result[4*i+3]=Math.round(rgba[4*i+3]!*mask[i]!/255);
  return result;
}

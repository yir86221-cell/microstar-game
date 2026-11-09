import type { InteractiveSegmenter } from '@mediapipe/tasks-vision';
/** A per-editor model, closed on navigation; lazy loaded only while making a photo. */
export class CutoutModel {
  private task:InteractiveSegmenter|null=null;
  private closed=false;
  private loading:Promise<InteractiveSegmenter>|null=null;
  private getTask():Promise<InteractiveSegmenter> {
    return this.loading??=(async()=>{
      const {FilesetResolver,InteractiveSegmenter}=await import('@mediapipe/tasks-vision');
      const base=new URL('./cutout/',document.baseURI).href;
      const task=await InteractiveSegmenter.createFromOptions(await FilesetResolver.forVisionTasks(base+'wasm'),{
        baseOptions:{modelAssetPath:base+'magic-touch.task',delegate:'CPU'},
      });
      if(this.closed){task.close();throw Error('closed');}
      this.task=task;return task;
    })().catch(error=>{this.loading=null;throw error;});
  }
  private source:HTMLImageElement|null=null;
  async select(image:HTMLImageElement,x:number,y:number):Promise<{data:Float32Array;width:number;height:number}> {
    const task=await this.getTask();
    if(this.closed)throw Error('closed');
    if(this.source!==image){task.setImage(image);this.source=image;}
    const mask=task.segment([{brushMode:1,point:[{x,y}],isCompleted:true}]);
    try{return {data:new Float32Array(mask.getAsFloat32Array()),width:mask.width,height:mask.height};}
    finally{mask.close();}
  }
  close():void{this.closed=true;this.task?.close();this.task=null;}
}

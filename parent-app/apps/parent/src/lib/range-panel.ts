import { card, cardTitle, h } from './dom.js';
import { RangeLamp } from './range-lamp.js';
import { saveRangeResult } from './range-record.js';
import { store } from './store.js';
import type { LampSettings } from './manual-lamp.js';

export function rangePanel(training:boolean) {
  const plan=store.state.plan;
  let preset=plan.preset, brightnessValue=plan.brightness, dirty=true;
  const settings=():LampSettings=>({preset,brightness:brightnessValue,...store.state.child});
  const connection=h('strong',null,'未连接');
  const message=h('p',{class:'hint',role:'status','aria-live':'polite'},'连接 MicroStar 后确认颜色。');
  const distance=h('p',{class:'hint'},'距离：尚无数据');
  const phase=h('strong',null,'准备');
  const timing=h('p',{class:'hint'},'等待家长开始');
  const report=h('p',{class:'hint'},'尚未读取总状态');
  const confirmed=h('p',{class:'hint'},'颜色和亮度尚未确认');
  const buttons:HTMLButtonElement[]=[];
  const editButtons:HTMLButtonElement[]=[];
  const lamp=new RangeLamp(update,undefined,saveRangeResult);
  function button(label:string,action:()=>void,cls='btn ghost') {
    const b=h('button',{type:'button',class:cls,onClick:action},label) as HTMLButtonElement;
    buttons.push(b);return b;
  }
  const connect=button('连接提示灯',()=>void lamp.connect(),'btn primary');
  const disconnect=button('停止并断开',()=>void lamp.disconnect());
  const start=button('开始找',()=>void lamp.start(settings()),'btn primary block lg');
  const end=button('结束训练',()=>void lamp.end());
  const off=button('关灯',()=>void lamp.end(true));
  const blink=button('试灯闪烁',()=>void lamp.testLight(1,settings()));
  const steady=button('试灯恒亮',()=>void lamp.testLight(2,settings()));
  const read=button('读取状态',()=>void lamp.readStatus());
  const save=button('确认颜色和亮度',()=>{
    void lamp.setColor(settings()).then(()=>{
      // A failed write must not make edited settings look confirmed.
      const c=lamp.state.color;
      if(c && lamp.state.message.startsWith('颜色和亮度已确认')){
        dirty=false;store.update(s=>{s.plan.preset=preset;s.plan.brightness=brightnessValue;});
      }
      update();
    });
  },'btn primary block');
  const colors=h('div',{class:'range-colors'});
  for(const [name,label] of [['red','红'],['green','绿'],['blue','蓝'],['warmWhite','暖白'],['yellow','黄']] as const){
    const b=button(label,()=>{preset=name;dirty=true;update();});
    b.dataset.preset=name;editButtons.push(b);colors.append(b);
  }
  const max=store.state.child.highLightSensitivity?96:128;
  brightnessValue=Math.min(brightnessValue,max);
  const value=h('span',null,String(brightnessValue));
  const brightness=h('input',{type:'range',min:0,max,step:1,value:brightnessValue,'aria-label':'亮度峰值',onInput:(event:Event)=>{
    brightnessValue=Number((event.target as HTMLInputElement).value);dirty=true;value.textContent=String(brightnessValue);update();
  }}) as HTMLInputElement;
  function update(){
    const s=lamp.state;
    connection.textContent=s.connected?'已连接 MicroStar':'未连接';message.textContent=s.message;
    for(const b of buttons)b.disabled=s.busy||!s.connected;
    connect.disabled=s.busy||s.connected;
    disconnect.disabled=!s.connected&&!s.busy;
    const editable=s.connected&&!s.busy&&!lamp.locked&&s.sample?.phase===0;
    for(const b of editButtons){b.disabled=!editable;b.classList.toggle('active',b.dataset.preset===preset);}
    brightness.disabled=!editable;save.disabled=!editable;
    blink.disabled=!editable||dirty||!s.color||settings().photosensitive;
    steady.disabled=!editable||dirty||!s.color;
    start.disabled=!lamp.canStart||dirty||settings().tactileSensitive;
    end.disabled=s.busy||!s.connected||s.waiting==='end';
    confirmed.textContent=dirty||!s.color?'颜色或亮度未确认，请点确认按钮。':`已确认 R/G/B/暖白：${s.color.slice(0,4).join(' / ')}；亮度 ${s.color[4]}`;
    const r=s.sample;
    distance.textContent=r?`当前距离：${r.valid?(r.distanceMm/10).toFixed(1)+' cm':'无效'} · ${r.valid?(r.stable?'读数稳定':'读数还在变化'):'请重新对准物品'}`:'距离：尚无数据';
    phase.textContent=s.waiting==='start'?'等待设备确认开始':s.waiting==='end'?'等待设备确认结束':r?.phase===1?'寻找中 · 灯恒亮':r?.phase===2?'设备报告已找到 · 灯呼吸':'准备';
    timing.textContent=r&&r.phase!==0?`初始距离 ${(r.baselineMm/10).toFixed(1)} cm · 设备用时 ${(r.elapsedMs/1000).toFixed(1)} 秒`:'对准物品，观察距离；准备好后由家长点开始。';
    report.textContent=s.reported?`设备报告：${['关灯','闪烁','恒亮','呼吸'][s.reported.mode]}；${s.reported.found?'已找到':'未找到'}；距离${s.reported.valid?'有效':'无效'}`:'总状态按需读取；进度以测距通知为准。';
  }
  const el=h('div',{class:'range-panel'},
    card(cardTitle('提示灯'),connection,message,h('div',{class:'range-controls'},connect,disconnect)),
    card(cardTitle('颜色与试灯'),colors,h('label',{class:'field'},h('span',null,'亮度峰值 ',value,` / ${max}`),brightness),save,confirmed,
      h('div',{class:'range-controls'},blink,steady,off,read),report,
      settings().photosensitive?h('p',{class:'hint'},'档案已禁用试灯闪烁，可用恒亮。'):null),
    card(cardTitle(training?'实物寻找':'实时测距'),distance,phase,timing,
      training?start:null,end,
      h('p',{class:'hint'},'模块放在物品外，朝向目标物品。读数稳定是准备提示，开始由家长确认。找到后由设备控制呼吸灯和 3 次短震。'),
      settings().tactileSensitive?h('p',{class:'hint'},'档案要求关闭震动；此固件没有关闭震动指令，暂不启动训练。'):null),
    h('p',{class:'hint'},'离开本页或切到后台会请求关灯并断开。设备测距结果不等同于抓握能力或康复评分。'),
    h('details',{class:'card'},h('summary',null,'连不上怎么办？'),h('p',{class:'hint'},'确认设备已上电，蓝牙和附近设备权限已开启。关闭其他连接 MicroStar 的应用；本版本需要新版测距固件。')));
  const hidden=()=>{if(document.hidden&&lamp.state.connected)void lamp.disconnect('应用进入后台，训练已中断。');};
  const leave=()=>lamp.dispose();
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',leave);
  update();
  return {el,destroy(){document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',leave);lamp.dispose();}};
}

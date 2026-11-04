import {h,card,cardTitle} from './dom.js';
import {store} from './store.js';
const KEY='microstar.game-settings.v1';
export function gamePanel():HTMLElement {
 let saved={sound:false,size:'standard'};try{saved={...saved,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{}
 const sound=h('input',{type:'checkbox',checked:saved.sound}) as HTMLInputElement;
 const size=h('select',null,...[['standard','标准目标'],['large','更大目标']].map(([value,label])=>h('option',{value,selected:saved.size===value},label))) as HTMLSelectElement;
 const launch=()=>{const p=store.state.plan;if(p.stage===4)return;const settings={phase:p.stage,mode:({anywhereTap:'slap',targetTap:'precise',hover:'dwell'} as const)[p.accessMode],sound:sound.checked,size:size.value};try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{}if(window.parent!==window)window.parent.postMessage({type:'microstar:start-game',settings},location.origin);};
 return card(cardTitle('一起开始探索','连接儿童游戏'),h('p',{class:'hint'},'选择上方阶段和交互方式，设置会在开始游戏时生效。第四阶仅在家长端使用。'),h('label',{class:'row'},sound,'声音反馈'),h('label',{class:'row'},'目标大小',size),h('button',{class:'btn primary block lg',disabled:store.state.plan.stage===4||window.parent===window,onClick:launch},'应用设置并进入儿童游戏'));
}
export function gameRecords():HTMLElement {
 let records:any[]=[];try{const raw=JSON.parse(localStorage.getItem('microstar.game-records.v1')||'[]');if(Array.isArray(raw))records=raw.slice(-8).reverse()}catch{}
 return card(cardTitle('儿童游戏 · 实际记录','仅保存在这台设备'),h('p',{class:'hint'},'记录已完成关卡和回应次数，不作为临床评分。下方原有趋势图为独立演示数据。'),...records.map(r=>h('div',{class:'list-row'},h('span',null,String(r.name)),h('span',{class:'muted'},'阶段 '+r.phase+' · '+r.responses+' 次回应 · '+Math.max(1,Math.round((Number(r.durationMs)||0)/1000))+' 秒 · '+new Date(r.at).toLocaleDateString('zh-CN')))),records.length?null:h('p',{class:'muted'},'还没有完成关卡，玩完一关就会出现在这里。'));
}

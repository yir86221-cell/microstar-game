'use strict';
const app=document.querySelector('#app');
const svg=(content,cls='')=>`<svg class="${cls}" viewBox="0 0 320 320" aria-hidden="true">${content}</svg>`;
const arts={
 chick:()=>svg('<g fill="#ffe600"><path d="M119 68Q119 33 144 29Q164 25 156 50Q188 34 193 50Q200 64 181 72Z"/><ellipse cx="160" cy="169" rx="105" ry="107"/><path d="M68 157Q22 174 33 205Q46 228 76 199ZM252 157Q298 174 287 205Q274 228 244 199Z"/></g><g fill="#ff9b00"><path d="M111 266Q91 279 99 288Q105 293 117 286Q121 306 130 298Q134 292 130 280Q148 294 153 282Q155 271 131 265ZM189 266Q166 271 169 282Q174 294 191 280Q187 292 191 298Q200 306 204 286Q216 293 222 288Q230 279 210 266Z"/><path d="M145 153Q160 150 175 153Q184 154 179 164L166 181Q160 187 154 181L141 164Q136 154 145 153"/></g><g fill="#050505"><circle cx="121" cy="148" r="10"/><circle cx="199" cy="148" r="10"/></g>','chick-art'),
 car:()=>svg('<path fill="#0985ff" d="M49 150L76 93Q84 76 106 76H195Q213 76 227 96L257 146Q284 151 287 176V222H34V177Q34 155 49 150Z"/><path fill="#8edbff" d="M91 98H144V145H71ZM159 98H192Q201 98 207 109L229 145H159Z"/><path fill="#0985ff" d="M35 174H288V231H35Z"/><g fill="#282828"><circle cx="94" cy="230" r="38"/><circle cx="234" cy="230" r="38"/></g><g fill="#bdbdbd"><circle cx="94" cy="230" r="16"/><circle cx="234" cy="230" r="16"/></g>','car-art'),
 apple:()=>svg('<path fill="#87512e" d="M154 94Q145 65 164 39L178 46Q163 69 169 95Z"/><path fill="#6dde22" d="M172 73Q197 22 245 49Q227 89 172 73Z"/><path fill="#ff293a" d="M160 100Q105 70 71 112Q36 152 71 229Q104 300 160 268Q216 300 249 229Q284 152 249 112Q215 70 160 100Z"/>','apple-art'),
 star:()=>svg('<path fill="#ffe600" stroke="#ffe600" stroke-linejoin="round" stroke-width="14" d="M160 43L195 115L276 127L217 184L231 266L160 228L89 266L103 184L44 127L125 115Z"/>','star-art'),
 colors:(color='#ff3b30')=>svg(`<circle cx="160" cy="160" r="111" fill="${color}"/>`),
 circle:()=>svg('<circle cx="160" cy="160" r="111" fill="#ffe600"/>'),
 horse:()=>svg('<path fill="#00dce9" d="M48 137L76 100L83 56L103 91L136 116L155 149H235L269 171L275 222L301 251L274 241L254 210L239 221L247 286H221L208 223H159L141 286H116L128 204L106 147L76 165Z"/>'),
 cup:()=>svg('<path d="M224 118H255Q294 119 278 163Q265 196 228 192" fill="none" stroke="#ff293a" stroke-width="23"/><path fill="#ff293a" d="M58 89H240L231 210Q224 260 151 260Q78 260 70 210Z"/>')
};
const levels=[{id:'chick',name:'让小鸡跳舞',target:'小鸡',action:'和小鸡打招呼',feedback:'小鸡跳起舞啦！'}, {id:'car',name:'让小车开起来',target:'小车',action:'让小车出发',feedback:'小车出发啦！'}, {id:'apple',name:'摘下红苹果',target:'红苹果',action:'摘下红苹果',feedback:'摘到苹果啦！'}, {id:'star',name:'点亮小星星',target:'小星星',action:'点亮小星星',feedback:'小星星亮起来啦！'}];
const planetLevel={id:'circle',name:'星球点亮',target:'黄色圆球',action:'点亮星球',feedback:'星球亮起来啦！'};
const colorLevel={id:'colors',name:'色彩探索',target:'亮起的圆球',action:'点亮圆球',feedback:'圆球亮起来啦！'};
const ballColors=[{label:'红色',base:'#ff3b30',lit:'#ff968e',rgb:'255,59,48'},{label:'黄色',base:'#ffe600',lit:'#fff5a3',rgb:'255,230,0'},{label:'蓝色',base:'#168bff',lit:'#8dcbff',rgb:'22,139,255'}];
function phaseLevels(){return S.phase===1?stageOne:levels;}
function isPlanet(){return S.phase===1&&['circle','colors'].includes(phaseLevels()[S.level]?.id);}
function currentLevel(){const l=phaseLevels()[S.level];if(l.id!=='colors')return l;const c=ballColors[Math.min(2,Math.max(0,S.round-(S.reward?1:0)))];return {...l,target:c.label+'圆球',color:c.base,lit:c.lit,rgb:c.rgb};}

const phases=[{id:1,art:'circle',name:'发现目标'},{id:2,art:'horse',name:'认识物品'},{id:3,art:'cup',name:'生活探索'}];
const modes=[{id:'slap',name:'拍击',description:'触碰屏幕任意位置即可回应'},{id:'precise',name:'精准点击',description:'点击目标物体，触碰其他位置不会触发'},{id:'dwell',name:'悬停',description:'接触目标并停留 1.2 秒，无需抬手'}];
const S={page:'home',phase:1,level:0,mode:'slap',round:0,overlay:null,reward:0,hold:null,toast:'',toastRemaining:0,targetSlot:0};
let parentPreviousOverlay=null,parentHoldStart=0,parentHoldMs=0;
let audio=null,soundOn=null,lastTick=0;
const icon={pause:'<svg viewBox="0 0 24 24"><path d="M7 4v16M17 4v16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',menu:'<svg viewBox="0 0 24 24"><path d="M3 5h18M3 12h18M3 19h18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',back:'<svg viewBox="0 0 24 24"><path d="m15 4-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'};
function sound(){if(!(soundOn??(S.phase===1)))return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const t=audio.currentTime;[523.25,659.25,783.99].forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(0,t+i*.11);g.gain.linearRampToValueAtTime(.04,t+i*.11+.015);g.gain.exponentialRampToValueAtTime(.001,t+i*.11+.2);o.start(t+i*.11);o.stop(t+i*.11+.22);});}catch{}}
let framePending=false;
function requestTick(){if(framePending||S.page!=='game'||S.overlay||!(S.hold||S.reward||S.toastRemaining||needsTaskTick()||S.round<3))return;framePending=true;requestAnimationFrame(t=>{framePending=false;if(!lastTick)lastTick=t;tick(t);});}
function endHold(){S.hold=null;document.querySelector('.dwell-ring')?.remove();}
function setOverlay(value){endHold();S.overlay=value;render();}
function startLevel(index=S.level){endHold();S.page='game';S.level=index;S.round=0;roundStartAt=Date.now();E.roundElapsed=0;S.reward=0;S.overlay=null;S.targetSlot=0;S.toast='';resetTask();recStart();render();}
function tell(message){S.toast=message;S.toastRemaining=1800;const n=document.querySelector('.toast');if(n)n.textContent=message;}
function home(){endHold();Object.assign(S,{page:'home',overlay:null,reward:0});render();}
function phaseView(){endHold();Object.assign(S,{page:'phases',overlay:null,reward:0});render();}
function homeView(){return `<section class="page home" aria-label="开始游戏"><button class="home-chick" data-action="start" aria-label="点击或拍击来开始">${arts.chick()}</button><h1 class="home-prompt">点击或拍击来开始吧！</h1><span class="quiet-brand">微动星瞳 · 游戏 DEMO</span></section>`;}
function phasesView(){return `<section class="page"><div class="topbar"><button class="icon-btn" data-action="home" aria-label="返回首页">${icon.back}</button><span class="top-spacer"></span><button class="small-btn" data-action="fullscreen">全屏体验</button></div><h1 class="phase-heading">选择探索模式</h1><div class="phase-grid">${phases.map(p=>`<button class="phase-card" data-phase="${p.id}" aria-label="Phase ${['','I','II','III'][p.id]} ${p.name}"><div class="art">${arts[p.art]()}</div><strong>Phase ${['','I','II','III'][p.id]}</strong><span>${p.name}</span></button>`).join('')}</div><span class="quiet-brand">微动星瞳 · 横屏体验更舒展</span></section>`;}
function legacyGameView(){const l=currentLevel(),isColors=l.id==='colors',count=isColors?3:S.phase===1?1:S.phase===2?2:3;const other=phaseLevels().filter(x=>x.id!==l.id);const items=isColors?ballColors.map((c,i)=>({...colorLevel,target:c.label+'圆球',color:c.base,lit:c.lit,rgb:c.rgb,isTarget:i===S.targetSlot})):Array.from({length:count},(_,i)=>i===S.targetSlot?{...l,isTarget:true}:{...other[(i+S.round)%other.length],isTarget:false});return `<section class="page game phase${S.phase} ${isPlanet()?'planet-game':''} ${isColors?'color-game':''}"><div class="topbar"><button class="icon-btn" data-action="pause" aria-label="暂停游戏">${icon.pause}</button><button class="icon-btn" data-action="menu" aria-label="打开游戏菜单">${icon.menu}</button><button class="small-btn" data-action="phases" aria-label="返回阶段选择">返回阶段</button></div><h1 class="game-title">${l.name}</h1><div class="rounds" aria-label="已完成 ${S.round} 次，共 3 次">${[0,1,2].map(i=>`<i class="${i<S.round?'done':''}"></i>`).join('')}</div><div class="playfield ${count===1?'single':''}">${items.map(x=>`<button class="object ${x.isTarget?'target':'distractor'} ${x.isTarget&&S.reward?'celebrate':''} ${isColors&&x.isTarget&&!S.reward?'guided':''}" data-object="${x.isTarget?'target':'other'}" aria-label="${x.target}" ${x.color?`style="--planet-color:${x.color};--planet-lit-color:${x.lit};--planet-rgb:${x.rgb}"`:""}><div class="art">${arts[x.id](x.color)}</div></button>`).join('')}</div><p class="task-caption ${S.reward?'feedback':''}" aria-live="polite">${S.reward?l.feedback:instruction()}</p><p class="mode-note">${S.mode==='slap'?'拍击模式 · 点击或拍击屏幕即可回应':S.mode==='precise'?'精准点击 · 找到并点击'+l.target:'接触停留 · 按住'+l.target+' 1.2 秒'}</p><div class="toast" role="status">${S.toast}</div></section>`;}
function instruction(){const l=currentLevel();if(S.mode==='slap')return `拍击屏幕，${l.action}`;if(S.mode==='precise')return `找到${l.target}，点一下吧！`;return `接触${l.target}并停留一会儿`}
function menuView(){return `<div class="overlay"><section class="drawer" role="dialog" aria-modal="true" aria-label="游戏菜单"><div class="drawer-head"><div><h2>游戏菜单</h2><p>游戏已暂停</p></div><button class="close-btn" data-action="resume" aria-label="关闭菜单">×</button></div><div class="section-head"><h3>选择关卡</h3><button class="phase-link" data-action="phases">Phase ${['','I','II','III'][S.phase]} · 切换阶段</button></div><div class="preview-grid ${S.phase===1?'expanded-levels':''}">${phaseLevels().map((l,i)=>`<button class="preview ${S.level===i?'selected':''}" data-level="${i}" aria-pressed="${S.level===i}"><div class="preview-art">${l.kind?simpleArt(l.id,l.color):arts[l.id]()}</div><span class="preview-label">${S.phase===1?(i+1)+'. ':''}${l.name}</span>${S.level===i?'<span class="selected-mark">✓</span>':''}</button>`).join('')}</div>${S.phase===1?`<div class="menu-tools"><button class="small-btn" data-action="easier">${E.easy?'恢复标准':'降低难度'}</button><button class="small-btn" data-action="sound">${(soundOn??true)?'关闭':'开启'}声音</button></div>`:''}<h3 class="mode-head">交互模式</h3><div class="mode-row">${modes.map(m=>`<button class="mode-chip ${m.id===S.mode?'selected':''}" data-mode="${m.id}" aria-pressed="${m.id===S.mode}">${m.name}</button>`).join('')}</div><p class="mode-description">${modes.find(m=>m.id===S.mode).description}</p><button class="primary" data-action="resume">继续游戏</button></section></div>`;}
function pauseView(){return `<div class="overlay modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-label="游戏已暂停"><div class="pause-symbol">Ⅱ</div><h2>休息一下吧</h2><p>游戏已暂停，准备好再继续。</p><button class="primary" data-action="resume">继续游戏</button><button class="secondary" data-action="menu">选择关卡</button><button class="small-btn" data-action="home">返回首页</button><button class="small-btn" data-action="sound">${(soundOn??(S.phase===1))?'关闭':'开启'}声音反馈</button></section></div>`;}
function parentEntry(){return '<button class="parent-entry" data-action="parent" aria-haspopup="dialog" aria-expanded="'+(S.overlay==='parent')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 21v-3a7 7 0 0 1 14 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span>家长模式</span></button>';}
function parentView(){return '<div class="overlay parent-overlay"><section class="parent-shell" role="dialog" aria-modal="true" aria-label="家长空间"><header class="parent-toolbar"><span>家长空间</span><button class="small-btn" data-action="parent-return">'+'回到儿童模式'+'</button></header><iframe class="parent-frame" src="parent/index.html" title="微动星瞳家长端" allow="bluetooth"></iframe></section></div>';}
function openParent(){if(S.overlay==='parent')return;parentPreviousOverlay=S.overlay;setOverlay('parent');}
function closeParent(){setOverlay(parentPreviousOverlay);parentPreviousOverlay=null;requestAnimationFrame(()=>document.querySelector('.parent-entry')?.focus({preventScroll:true}));}
function render(){requestTick();app.innerHTML=(S.page==='home'?homeView():S.page==='phases'?phasesView():gameView())+(S.overlay==='menu'?menuView():S.overlay==='pause'?pauseView():S.overlay==='parent'?parentView():'')+parentEntry();if(S.overlay){requestAnimationFrame(()=>document.querySelector('[role="dialog"] button')?.focus({preventScroll:true}));}}
function respond(){if(isAdvanced())return respondAdvanced();if(S.page!=='game'||S.overlay||S.reward)return;endHold();recRound(Date.now()-roundStartAt);S.reward=1500;S.round++;S.toast='';sound();render();}
function action(name){switch(name){case'parent':if(parentHoldMs<900)return;openParent();break;case'parent-return':closeParent();break;case'motion':beginMotion();break;case'easier':E.easy=!E.easy;startLevel();setOverlay('menu');break;case'start':phaseView();break;case'home':home();break;case'phases':phaseView();break;case'pause':setOverlay('pause');break;case'menu':setOverlay('menu');break;case'resume':setOverlay(null);break;case'replay':startLevel();break;case'next':S.level===phaseLevels().length-1?setOverlay('menu'):startLevel(S.level+1);break;case'sound':soundOn=!(soundOn??(S.phase===1));render();break;case'fullscreen':if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{});}else{document.documentElement.requestFullscreen?.().catch(()=>{});}break;}}
app.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.dataset.action){action(b.dataset.action);return;}if(S.overlay==='parent')return;if(b?.dataset.phase){S.phase=Number(b.dataset.phase);startLevel(0);return;}if(b?.dataset.level!==undefined){endHold();startLevel(Number(b.dataset.level));setOverlay('menu');return;}if(b?.dataset.mode){endHold();S.mode=b.dataset.mode;startLevel();setOverlay('menu');return;}if(S.page==='home'){phaseView();return;}if(isAdvanced()&&e.detail===0&&S.page==='game'&&!S.overlay){advancedInput(b?.dataset.object?b:null,null);return;}if(e.detail===0&&b?.dataset.object&&S.page==='game'&&!S.overlay){if((S.mode==='slap'&&currentLevel().id!=='colors')||b.dataset.object==='target')respond();}});
app.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('[data-action],.overlay,[data-phase]'))return;if(S.page!=='game'||S.overlay||S.reward)return;const obj=e.target.closest('[data-object]');if(isAdvanced()){advancedInput(obj,e);return;}if(currentLevel().id==='colors'&&obj?.dataset.object!=='target')return;if(S.mode==='slap'){respond();return;}if(obj?.dataset.object!=='target'){if(obj)tell('再找找目标吧');return;}if(S.mode==='precise'){respond();return;}endHold();S.hold={id:e.pointerId,elapsed:0,node:obj};obj.insertAdjacentHTML('beforeend','<span class="dwell-ring"></span>');requestTick();e.preventDefault();});
window.addEventListener('pointermove',e=>{if(!S.hold||e.pointerId!==S.hold.id)return;const r=S.hold.node.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)endHold();});
window.addEventListener('pointerup',e=>{if(S.hold?.id===e.pointerId)endHold();});window.addEventListener('pointercancel',endHold);window.addEventListener('blur',()=>{if(S.page==='game'&&!S.overlay)setOverlay('pause');else endHold();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&S.page==='game'&&!S.overlay)setOverlay('pause');});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(S.overlay==='parent'){closeParent();return;}if(S.page==='game')setOverlay(S.overlay===null?'pause':null);else if(S.page==='phases')home();return;}if(S.overlay&&e.key==='Tab'){const controls=[...document.querySelectorAll('[role="dialog"] button')];if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
function tick(t){const dt=Math.min(t-lastTick,70);lastTick=t;if(S.page==='game'&&!S.overlay){advanceTask(dt);if(!S.reward&&!S.hold){E.roundElapsed=(E.roundElapsed||0)+dt;if(E.roundElapsed>=ROUND_TIMEOUT_MS){timeoutRound();return;}}if(S.hold){S.hold.elapsed+=dt;document.querySelector('.dwell-ring')?.style.setProperty('--progress',`${Math.min(360,S.hold.elapsed/1200*360)}deg`);if(S.hold.elapsed>=1200)respond();}if(S.reward){S.reward=Math.max(0,S.reward-dt);if(S.reward===0){if(S.round>=3){if(S.level<phaseLevels().length-1)startLevel(S.level+1);else setOverlay('menu');}else {roundStartAt=Date.now();E.roundElapsed=0;if(isAdvanced())resetRound();S.targetSlot=phaseLevels()[S.level].id==='colors'?Math.min(2,S.round):S.phase===1?0:S.round%(S.phase===2?2:3);}render();}}if(S.toastRemaining){S.toastRemaining=Math.max(0,S.toastRemaining-dt);if(!S.toastRemaining){S.toast='';const n=document.querySelector('.toast');if(n)n.textContent='';}}}if(S.page==='game'&&!S.overlay&&(S.hold||S.reward||S.toastRemaining||needsTaskTick()||S.round<3))requestTick();else lastTick=0;}

// P1-only additions. P2/P3 use the original game, assets, menus and task lists.
const p1Task=(id,name,target,kind,focus,color)=>({id,name,target,kind,focus,color,action:'和'+target+'互动',feedback:'做得好！'});
const stageOne=[planetLevel,levels[3],colorLevel,
 p1Task('circle','形状朋友','绿色图形','shapes','圆形 → 正方形 → 三角形','#54e373'),
 p1Task('circle','大小星球','橙色圆球','growth','点击三次，加速长大并前进到终点','#ff9637'),
 p1Task('circle','躲猫猫','粉色圆球','peek','左侧 → 右下角 → 左上角','#ff70ba'),
 p1Task('circle','星球换位置','紫色圆球','horizontal','左 → 中 → 右','#b57aff'),
 p1Task('star','上下找星星','粉色星星','vertical','点击三次，带星星上下移动到终点','#ff79bf'),
 p1Task('circle','漂流星球','绿色圆球','drift','点击三次，推动星球加速到右侧终点','#39df96'),
 p1Task('circle','星光旅行','紫色圆球','path','横向移动、停顿、再向下移动','#a087ff')];
const E={easy:false,running:false,started:false,elapsed:0,progress:0,boost:false,boostTime:0,boostFrom:0,boostTo:0,roundElapsed:0};
function isAdvanced(){return S.phase===1&&S.level>=3;}
function isBoost(){return isAdvanced()&&['growth','vertical','drift'].includes(currentLevel().kind);}
function dynamic(){return isAdvanced()&&['growth','vertical','peek','drift','path'].includes(currentLevel().kind);}
function resetTask(){Object.assign(E,{running:false,started:false,elapsed:0,progress:0,boost:false,boostTime:0,boostFrom:0,boostTo:0,roundElapsed:0});lastTick=0;}
function resetRound(){resetTask();roundStartAt=Date.now();if(currentLevel().kind==='peek'&&S.round>0){E.running=true;E.started=true;E.elapsed=1200;}}
function needsTaskTick(){return isAdvanced()&&E.running;}
function roundIndex(){return Math.min(2,Math.max(0,S.round-(S.reward?1:0)));}
function shapeName(){return ['圆形','正方形','三角形'][roundIndex()];}
function simpleArt(type,color){
 if(type==='circle')return svg(`<circle cx="160" cy="160" r="111" fill="${color}"/>`);
 if(type==='square')return svg(`<rect x="58" y="58" width="204" height="204" rx="5" fill="${color}"/>`);
 if(type==='triangle')return svg(`<path d="M160 48L279 263H41Z" fill="${color}"/>`);
 return arts.star().replaceAll('#ffe600',color);
}
function position(){
 const k=currentLevel().kind,r=roundIndex();
 if(isBoost()){
  if(k==='vertical'){const n=Math.min(2,Math.floor(E.progress*3)),f=E.progress*3-n,ys=[28,72,28,72];return{x:50,y:ys[n]+(ys[n+1]-ys[n])*f};}
  return{x:(k==='growth'?22:20)+(k==='growth'?56:60)*E.progress,y:50};
 }
 if(k==='horizontal')return{x:[22,50,78][r],y:50};
 if(k==='peek'){
  const previous=[{x:50,y:50},{x:22,y:50},{x:78,y:72}];
  const revealed=[{x:22,y:50},{x:78,y:72},{x:22,y:28}];
  return E.started&&E.elapsed>=2200?revealed[r]:previous[r];
 }
 if(k==='path'){
  const u=(E.elapsed/(E.easy?1.5:1))%20000;
  if(u<5000)return{x:22+56*u/5000,y:30};
  if(u<6500)return{x:78,y:30};
  if(u<10500)return{x:78,y:30+40*(u-6500)/4000};
  if(u<12000)return{x:78,y:70};
  if(u<16000)return{x:78,y:70-40*(u-12000)/4000};
  return{x:78-56*(u-16000)/4000,y:30};
 }
 return{x:50,y:50};
}
function taskScale(){return currentLevel().kind==='growth'?.48+.62*E.progress:(E.easy?1.18:1);}
function motionHidden(){return isAdvanced()&&currentLevel().kind==='peek'&&E.started&&E.elapsed>=1200&&E.elapsed<2200;}
function taskHint(){
 const l=currentLevel(),k=l.kind;
 if(isBoost())return S.reward?'到达终点啦！':E.boost?`加速前进中 · 已点击 ${S.round} / 3 次`:`${l.focus} · 已点击 ${S.round} / 3 次`;
 if(dynamic()&&!E.started)return '先观察，准备好后点击“开始运动”';
 if(k==='peek')return motionHidden()?'小球藏起来了，等它在新位置出现':l.focus;
 return l.focus;
}
function advancedModeNote(){return S.mode==='slap'?'拍击屏幕任意位置即可回应':S.mode==='precise'?'点击目标图形':'接触目标并停留 1.2 秒';}
function advancedGameView(){
 const l=currentLevel(),k=l.kind,idx=roundIndex(),pos=position(),type=k==='shapes'?['circle','square','triangle'][idx]:l.id;
 const response=Boolean(S.reward||E.boost);
 return `<section class="page game advanced-game ${E.easy?'easy-mode':''}" data-kind="${k}"><div class="topbar"><button class="icon-btn" data-action="pause" aria-label="暂停游戏">${icon.pause}</button><button class="icon-btn" data-action="menu" aria-label="打开游戏菜单">${icon.menu}</button><button class="small-btn" data-action="phases">返回阶段</button>${dynamic()&&!E.started?'<button class="small-btn motion-start" data-action="motion">开始运动</button>':''}</div><h1 class="advanced-title">P1 · ${S.level+1} / 10 · ${l.name}</h1><div class="task-content"><div class="task-stage"><div class="moving-anchor" style="--x:${pos.x}%;--y:${pos.y}%;--scale:${taskScale()}"><button class="object target task-object ${response?'task-reward':''}" data-object="target" aria-label="${k==='shapes'?'绿色'+shapeName():l.target}" ${motionHidden()?'hidden':''} style="--task-color:${l.color}"><div class="art">${simpleArt(type,l.color)}</div></button></div></div></div><p class="advanced-hint ${response?'feedback':''}" aria-live="polite">${!isBoost()&&S.reward?'做得好！':taskHint()}</p><p class="advanced-mode-note">${advancedModeNote()}</p><div class="toast" role="status">${S.toast}</div></section>`;
}
function gameView(){return isAdvanced()?advancedGameView():legacyGameView();}
function beginMotion(){if(!dynamic()||S.overlay||S.reward||E.started)return;E.started=true;E.running=true;E.elapsed=0;lastTick=0;render();}
function boostStep(){
 if(!isBoost()||S.page!=='game'||S.overlay||S.reward||E.boost||S.round>=3)return;
 endHold();E.started=true;E.running=true;E.boost=true;E.boostTime=0;E.boostFrom=E.progress;S.round++;E.boostTo=S.round/3;S.toast='';sound();render();
}
function respondAdvanced(){
 if(S.page!=='game'||S.overlay||S.reward)return;
 if(isBoost()){boostStep();return;}
 if(motionHidden()||(currentLevel().kind==='peek'&&E.started&&E.elapsed<2200))return;
 if(dynamic()&&!E.started){beginMotion();return;}
 endHold();recRound(Date.now()-roundStartAt);E.running=false;S.reward=1500;S.round++;S.toast='';S.toastRemaining=0;sound();render();
}
function advancedInput(node,pointer){
 if(S.reward||S.overlay||E.boost||motionHidden())return;
 if(S.mode==='slap'){respondAdvanced();return;}
 if(!node)return;
 if(S.mode==='precise'||!pointer){respondAdvanced();return;}
 endHold();S.hold={id:pointer.pointerId,elapsed:0,node};node.insertAdjacentHTML('beforeend','<span class="dwell-ring"></span>');requestTick();pointer.preventDefault();
}
function updatePosition(){const a=document.querySelector('.moving-anchor');if(!a)return;const p=position();a.style.setProperty('--x',p.x+'%');a.style.setProperty('--y',p.y+'%');a.style.setProperty('--scale',taskScale());}
function advanceTask(dt){
 if(!isAdvanced()||S.reward||!E.running||S.hold)return;
 if(isBoost()){
  if(E.boost){
   E.boostTime+=dt;const t=Math.min(1,E.boostTime/(E.easy?1200:900));const eased=t*t*(3-2*t);E.progress=E.boostFrom+(E.boostTo-E.boostFrom)*eased;
   if(t>=1){E.boost=false;E.progress=E.boostTo;if(S.round>=3){E.running=false;S.reward=1500;}render();}
  }else{
   // Slow baseline motion never reaches the endpoint without the third deliberate input.
   const cap=Math.min(.97,(S.round+1)/3-.025);E.progress=Math.min(cap,E.progress+dt/(E.easy?60000:45000));
  }
  updatePosition();return;
 }
 const wasHidden=motionHidden();E.elapsed+=dt;updatePosition();
 if(currentLevel().kind==='peek'){if(E.elapsed>=2200)E.running=false;if(wasHidden!==motionHidden())render();}
}

render();
/* 家长入口改为长按触发：短按不响应，避免孩子误触 */
document.addEventListener('pointerdown',e=>{const b=e.target&&e.target.closest&&e.target.closest('.parent-entry');if(b){parentHoldStart=Date.now();b.classList.add('holding');}},true);
document.addEventListener('pointerup',e=>{const b=e.target&&e.target.closest&&e.target.closest('.parent-entry');if(b){if(parentHoldStart)parentHoldMs=Date.now()-parentHoldStart;parentHoldStart=0;b.classList.remove('holding');}},true);
document.addEventListener('pointercancel',e=>{const b=e.target&&e.target.closest&&e.target.closest('.parent-entry');if(b){parentHoldStart=0;parentHoldMs=0;b.classList.remove('holding');}},true);
/* 家长端弹窗里的「开始训练」交回儿童模式：约定一条同源 postMessage */
window.addEventListener('message',e=>{
 if(e.origin!==location.origin)return;
 const d=e.data;
 if(!d||d.type!=='microstar:start-level')return;
 const phase=Math.max(1,Math.min(3,Number(d.phase)||1));
 const list=phase===1?stageOne:levels;
 const index=Math.max(0,Math.min(list.length-1,Number(d.index)||0));
 const mode=['slap','precise','dwell'].includes(d.mode)?d.mode:'slap';
 const t=Number(d.timeoutMs);if(isFinite(t))ROUND_TIMEOUT_MS=Math.max(10000,Math.min(90000,t));
 if(typeof d.sound==='boolean')soundOn=d.sound;
 if(d.size==='large'||d.size==='standard')document.documentElement?.style?.setProperty('--target-scale',d.size==='large'?'1.2':'1');
 parentPreviousOverlay=null;
 S.phase=phase;S.mode=mode;
 startLevel(index);
});
/* ---- 训练记录桥：把每关成绩写进 localStorage，家长端读取同一份 ---- */
var roundStartAt=0,currentRec=null;
var ROUND_TIMEOUT_MS=30000;
var GAME_RECORD_KEY='microstar.game.sessions';
function recStart(){currentRec={id:'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),startedAt:Date.now(),phase:S.phase,levelIndex:S.level,levelName:(phaseLevels()[S.level]||{}).name||'',mode:S.mode,rounds:[]};roundStartAt=Date.now();}
function recSave(){if(!currentRec||!currentRec.rounds.length)return;currentRec.endedAt=Date.now();try{var a=JSON.parse(localStorage.getItem(GAME_RECORD_KEY)||'[]');var i=-1;for(var k=0;k<a.length;k++){if(a[k]&&a[k].id===currentRec.id){i=k;break;}}if(i>=0){a[i]=currentRec;}else{a.push(currentRec);}localStorage.setItem(GAME_RECORD_KEY,JSON.stringify(a.slice(-40)));}catch(e){}}
function timeoutRound(){
 E.roundElapsed=0;recRound(null,true);
 S.round++;
 if(S.round>=3){if(S.level<phaseLevels().length-1)startLevel(S.level+1);else setOverlay('menu');render();requestTick();return;}
 roundStartAt=Date.now();
 if(isAdvanced())resetRound();
 S.targetSlot=phaseLevels()[S.level].id==='colors'?Math.min(2,S.round):S.phase===1?0:S.round%(S.phase===2?2:3);
 render();requestTick();
}
function recRound(latencyMs,isTimeout){if(!currentRec||currentRec.levelIndex!==S.level||currentRec.phase!==S.phase)recStart();currentRec.rounds.push(isTimeout?{latencyMs:null,ok:false}:{latencyMs:Math.max(0,Math.round(latencyMs)),ok:true});recSave();}
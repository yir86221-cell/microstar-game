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
const pigLevel={id:'pig',name:'小猪快跑',target:'小猪',action:'看看小猪会做什么',feedback:'小猪跑远啦！'};
const ballColors=[{label:'红色',base:'#ff3b30',lit:'#ff3b30',rgb:'255,59,48'},{label:'黄色',base:'#ffe600',lit:'#ffe600',rgb:'255,230,0'},{label:'蓝色',base:'#168bff',lit:'#168bff',rgb:'22,139,255'}];
function customLevels(){try{var a=JSON.parse(localStorage.getItem('microstar.custom-levels.v1')||'[]');return Array.isArray(a)?a.filter(function(x){return x&&x.id&&x.image;}):[];}catch(e){return [];}}
function customLevelById(id){var list=customLevels();for(var i=0;i<list.length;i++){if(list[i].id===id)return list[i];}return null;}
function artFor(lv){var c=customLevelById(lv.id);if(c)return '<img class="art-img" src="'+c.image+'" alt="" draggable="false">';return arts[lv.id](lv.color);}
function phaseLevels(){return S.phase===1?stageOne:S.phase===2?[...levels,pigLevel,...storyLevels]:[cupLevel,...customLevels()];}
function requiredResponses(){return (S.phase===1&&S.level<2)||isPig()?1:isStory()?storyResponses():3;}
function isPlanet(){return S.phase===1&&['circle','colors'].includes(phaseLevels()[S.level]?.id);}
function currentLevel(){const l=phaseLevels()[S.level];if(l.id!=='colors')return l;const c=ballColors[Math.min(2,Math.max(0,S.round-(S.reward?1:0)))];return {...l,target:c.label+'圆球',color:c.base,lit:c.lit,rgb:c.rgb};}

const phases=[{id:1,art:'circle',name:'发现目标'},{id:2,art:'horse',name:'认识物品'},{id:3,art:'cup',name:'生活探索'}];
const modes=[{id:'slap',name:'拍击',description:'触碰屏幕任意位置即可回应'},{id:'precise',name:'精准点击',description:'点击目标物体，触碰其他位置不会触发'},{id:'dwell',name:'悬停',description:'接触目标并停留 1.2 秒，无需抬手'}];
const S={page:'home',phase:1,level:0,mode:'slap',round:0,overlay:null,reward:0,hold:null,toast:'',toastRemaining:0,targetSlot:0};
let parentPreviousOverlay=null,parentHold=null,parentClickBlocked=false;
const PARENT_HOLD_MS=1000;
let gameStartedAt=0,gamePausedAt=0,gamePausedTotal=0;
let audio=null,soundOn=null,lastTick=0;
const icon={pause:'<svg viewBox="0 0 24 24"><path d="M7 4v16M17 4v16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',menu:'<svg viewBox="0 0 24 24"><path d="M3 5h18M3 12h18M3 19h18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',back:'<svg viewBox="0 0 24 24"><path d="m15 4-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'};
function sound(){if(!(soundOn??(S.phase===1||isPig()||isStory())))return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const t=audio.currentTime;[523.25,659.25,783.99].forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(0,t+i*.11);g.gain.linearRampToValueAtTime(.04,t+i*.11+.015);g.gain.exponentialRampToValueAtTime(.001,t+i*.11+.2);o.start(t+i*.11);o.stop(t+i*.11+.22);});}catch{}}
let framePending=false;
function requestTick(){if(framePending||S.page!=='game'||S.overlay||!(S.hold||S.reward||S.toastRemaining||needsTaskTick()||needsPigTick()||needsStoryTick()))return;framePending=true;requestAnimationFrame(t=>{framePending=false;if(!lastTick)lastTick=t;tick(t);});}
function endHold(){S.hold=null;document.querySelector('.dwell-ring')?.remove();}
function setOverlay(value){if(S.page==='game'){if(value&&!S.overlay)gamePausedAt=Date.now();if(!value&&S.overlay&&gamePausedAt){const pauseDelta=Date.now()-gamePausedAt;gamePausedTotal+=pauseDelta;roundStartAt+=pauseDelta;gamePausedAt=0;}}endHold();Cup.drag=null;S.overlay=value;render();}
function startLevel(index=S.level){gameStartedAt=Date.now();gamePausedAt=0;gamePausedTotal=0;endHold();S.page='game';S.level=index;S.round=0;S.reward=0;S.overlay=null;S.targetSlot=0;S.toast='';resetTask();resetPig();resetStory();resetCup();recStart();render();}
function tell(message){S.toast=message;S.toastRemaining=1800;const n=document.querySelector('.toast');if(n)n.textContent=message;}
function home(){endHold();Object.assign(S,{page:'home',overlay:null,reward:0});render();}
function phaseView(){endHold();Object.assign(S,{page:'phases',overlay:null,reward:0});render();}
function homeView(){return `<section class="page home" aria-label="开始游戏"><button class="home-chick" data-action="start" aria-label="点击或拍击来开始">${arts.chick()}</button><h1 class="home-prompt">点击或拍击来开始吧！</h1><span class="quiet-brand">微动星瞳 · 游戏 DEMO</span></section>`;}
function phasesView(){return `<section class="page"><div class="topbar"><button class="icon-btn" data-action="home" aria-label="返回首页">${icon.back}</button><span class="top-spacer"></span><button class="small-btn" data-action="fullscreen">全屏体验</button></div><h1 class="phase-heading">选择探索模式</h1><div class="phase-grid">${phases.map(p=>`<button class="phase-card" data-phase="${p.id}" aria-label="Phase ${['','I','II','III'][p.id]} ${p.name}"><div class="art">${arts[p.art]()}</div><strong>Phase ${['','I','II','III'][p.id]}</strong><span>${p.name}</span></button>`).join('')}</div><span class="quiet-brand">微动星瞳 · 横屏体验更舒展</span></section>`;}
function legacyGameView(){const l=currentLevel(),isColors=l.id==='colors',count=isColors?3:S.phase===1?1:S.phase===2?2:3;const other=levels.filter(x=>x.id!==l.id);const items=isColors?ballColors.map((c,i)=>({...colorLevel,target:c.label+'圆球',color:c.base,lit:c.lit,rgb:c.rgb,isTarget:i===S.targetSlot})):Array.from({length:count},(_,i)=>i===S.targetSlot?{...l,isTarget:true}:{...other[(i+S.round)%other.length],isTarget:false});return `<section class="page game phase${S.phase} ${isPlanet()?'planet-game':''} ${isColors?'color-game':''}"><div class="topbar"><button class="icon-btn" data-action="pause" aria-label="暂停游戏">${icon.pause}</button><button class="icon-btn" data-action="menu" aria-label="打开游戏菜单">${icon.menu}</button><button class="small-btn" data-action="phases" aria-label="返回阶段选择">返回阶段</button></div><h1 class="game-title">${l.name}</h1><div class="rounds" aria-label="已完成 ${S.round} 次，共 ${requiredResponses()} 次">${Array.from({length:requiredResponses()},(_,i)=>i).map(i=>`<i class="${i<S.round?'done':''}"></i>`).join('')}</div><div class="playfield ${count===1?'single':''}">${items.map(x=>`<button class="object ${x.isTarget?'target':'distractor'} ${x.isTarget&&S.reward?'celebrate':''} ${isColors&&x.isTarget&&!S.reward?'guided':''}" data-object="${x.isTarget?'target':'other'}" aria-label="${x.target}" ${x.color?`style="--planet-color:${x.color};--planet-lit-color:${x.lit};--planet-rgb:${x.rgb}"`:""}><div class="art">${artFor(x)}</div></button>`).join('')}</div><div class="toast child-sr-only" role="status">${S.toast}</div></section>`;}
function instruction(){const l=currentLevel();if(S.mode==='slap')return `拍击屏幕，${l.action}`;if(S.mode==='precise')return `找到${l.target}，点一下吧！`;return `接触${l.target}并停留一会儿`}
function menuView(){return `<div class="overlay"><section class="drawer" role="dialog" aria-modal="true" aria-label="游戏菜单"><div class="drawer-head"><div><h2>游戏菜单</h2><p>游戏已暂停</p></div><button class="close-btn" data-action="resume" aria-label="关闭菜单">×</button></div><div class="section-head"><h3>选择关卡</h3><button class="phase-link" data-action="phases">Phase ${['','I','II','III'][S.phase]} · 切换阶段</button></div><div class="preview-grid ${S.phase===1?'expanded-levels':S.phase===2?'story-levels':''}">${phaseLevels().map((l,i)=>`<button class="preview ${S.level===i?'selected':''}" data-level="${i}" aria-pressed="${S.level===i}"><div class="preview-art">${customLevelById(l.id)?artFor(l):l.kind?simpleArt(l.id,l.color):arts[l.id]()}</div><span class="preview-label">${S.phase===1?(i+1)+'. ':''}${l.name}</span>${S.level===i?'<span class="selected-mark">✓</span>':''}</button>`).join('')}</div>${S.phase===1?`<div class="menu-tools"><button class="small-btn" data-action="easier">${E.easy?'恢复标准':'降低难度'}</button><button class="small-btn" data-action="sound">${(soundOn??true)?'关闭':'开启'}声音</button></div>`:''}<h3 class="mode-head">交互模式</h3><div class="mode-row">${modes.map(m=>`<button class="mode-chip ${m.id===S.mode?'selected':''}" data-mode="${m.id}" aria-pressed="${m.id===S.mode}">${m.name}</button>`).join('')}</div><p class="mode-description">${modes.find(m=>m.id===S.mode).description}</p><button class="primary" data-action="resume">${(isPig()&&Pig.phase==='complete')||(isStory()&&Story.done)?'再玩一次':'继续游戏'}</button></section></div>`;}
function pauseView(){return `<div class="overlay modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-label="游戏已暂停"><div class="pause-symbol">Ⅱ</div><h2>休息一下吧</h2><p>游戏已暂停，准备好再继续。</p><button class="primary" data-action="resume">继续游戏</button><button class="secondary" data-action="menu">选择关卡</button><button class="small-btn" data-action="home">返回首页</button><button class="small-btn" data-action="sound">${(soundOn??(S.phase===1||isPig()||isStory()))?'关闭':'开启'}声音反馈</button></section></div>`;}
function parentEntry(){return '<button class="parent-entry" data-action="parent" aria-label="家长入口，按住一秒进入" title="按住一秒进入" style="--parent-hold-duration:'+PARENT_HOLD_MS+'ms" aria-haspopup="dialog" aria-expanded="'+(S.overlay==='parent')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 21v-3a7 7 0 0 1 14 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span>家长入口</span></button>';}
function parentView(){return '<div class="overlay parent-overlay"><section class="parent-shell" role="dialog" aria-modal="true" aria-label="家长空间"><header class="parent-toolbar"><span>家长空间</span><button class="small-btn" data-action="parent-return">'+(S.page==='game'?'返回游戏':'返回上一页')+'</button></header><iframe class="parent-frame" src="parent/index.html" title="微动星瞳家长端" allow="bluetooth"></iframe></section></div>';}
function openParent(){if(S.overlay==='parent')return;parentPreviousOverlay=S.overlay;setOverlay('parent');}
function closeParent(){setOverlay(parentPreviousOverlay);parentPreviousOverlay=null;requestAnimationFrame(()=>document.querySelector('.parent-entry')?.focus({preventScroll:true}));}
function render(){cancelParentHold();requestTick();app.innerHTML=(S.page==='home'?homeView():S.page==='phases'?phasesView():gameView())+(S.overlay==='menu'?menuView():S.overlay==='pause'?pauseView():S.overlay==='parent'?parentView():'')+parentEntry();if(S.overlay){requestAnimationFrame(()=>document.querySelector('[role="dialog"] button')?.focus({preventScroll:true}));}}
function respond(){if(isCup()){endHold();Cup.drag=null;turnCup(.5);return;}if(isStory())return triggerStory();if(isPig())return triggerPig();if(isAdvanced())return respondAdvanced();if(S.page!=='game'||S.overlay||S.reward)return;endHold();S.reward=1500;recRound(Date.now()-roundStartAt);S.round++;S.toast='';sound();render();}
function action(name){switch(name){case'cup-left':turnCup(-.5);break;case'cup-right':turnCup(.5);break;case'cup-up':turnCup(0,-.25);break;case'cup-reset':resetCup();paintCup();break;case'parent':return;case'parent-return':closeParent();break;case'motion':beginMotion();break;case'easier':E.easy=!E.easy;startLevel();setOverlay('menu');break;case'start':phaseView();break;case'home':home();break;case'phases':phaseView();break;case'pause':setOverlay('pause');break;case'menu':setOverlay('menu');break;case'resume':if((isPig()&&Pig.phase==='complete')||(isStory()&&Story.done))startLevel();else setOverlay(null);break;case'replay':startLevel();break;case'next':S.level===phaseLevels().length-1?setOverlay('menu'):startLevel(S.level+1);break;case'sound':soundOn=!(soundOn??(S.phase===1||isPig()||isStory()));render();break;case'fullscreen':if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{});}else{document.documentElement.requestFullscreen?.().catch(()=>{});}break;}}
app.addEventListener('click',e=>{if(parentClickBlocked){parentClickBlocked=false;e.preventDefault();return;}const b=e.target.closest('button');if(b?.dataset.action){action(b.dataset.action);return;}if(S.overlay==='parent')return;if(b?.dataset.phase){S.phase=Number(b.dataset.phase);startLevel(0);return;}if(b?.dataset.level!==undefined){endHold();startLevel(Number(b.dataset.level));setOverlay('menu');return;}if(b?.dataset.mode){endHold();S.mode=b.dataset.mode;startLevel();setOverlay('menu');return;}if(S.page==='home'){phaseView();return;}if(isAdvanced()&&e.detail===0&&S.page==='game'&&!S.overlay){advancedInput(b?.dataset.object?b:null,null);return;}if(e.detail===0&&b?.dataset.object&&S.page==='game'&&!S.overlay){if((S.mode==='slap'&&currentLevel().id!=='colors')||b.dataset.object==='target')respond();}});
app.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('[data-action],.overlay,[data-phase]'))return;if(S.page!=='game'||S.overlay||S.reward)return;const obj=e.target.closest('[data-object]');if(isCup()){cupInput(obj,e);return;}if(isStory()){storyInput(obj,e);return;}if(isAdvanced()){advancedInput(obj,e);return;}if(currentLevel().id==='colors'&&obj?.dataset.object!=='target')return;if(S.mode==='slap'){respond();return;}if(obj?.dataset.object!=='target'){if(obj)tell('再找找目标吧');return;}if(S.mode==='precise'){markOffset(obj,e);respond();return;}endHold();S.hold={id:e.pointerId,elapsed:0,node:obj};obj.insertAdjacentHTML('beforeend','<span class="dwell-ring"></span>');requestTick();e.preventDefault();});
window.addEventListener('pointermove',e=>{if(!S.hold||e.pointerId!==S.hold.id)return;const r=S.hold.node.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)endHold();});
window.addEventListener('pointerup',e=>{if(S.hold?.id===e.pointerId)endHold();});window.addEventListener('pointercancel',endHold);window.addEventListener('blur',()=>{if(S.page==='game'&&!S.overlay)setOverlay('pause');else endHold();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&S.page==='game'&&!S.overlay)setOverlay('pause');});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(S.overlay==='parent'){closeParent();return;}if(S.page==='game')setOverlay(S.overlay===null?'pause':null);else if(S.page==='phases')home();return;}if(S.overlay&&e.key==='Tab'){const controls=[...document.querySelectorAll('[role="dialog"] button')];if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
function tick(t){const dt=Math.min(t-lastTick,70);lastTick=t;if(S.page==='game'&&!S.overlay){advanceStory(dt);advancePig(dt);advanceTask(dt);if(S.hold){S.hold.elapsed+=dt;document.querySelector('.dwell-ring')?.style.setProperty('--progress',`${Math.min(360,S.hold.elapsed/1200*360)}deg`);if(S.hold.elapsed>=1200)respond();}if(S.reward){S.reward=Math.max(0,S.reward-dt);if(S.reward===0){if(S.round>=requiredResponses()){saveGameRecord();if(S.level<phaseLevels().length-1)startLevel(S.level+1);else if(S.phase<3){S.phase++;startLevel(0);}else setOverlay('menu');}else {roundStartAt=Date.now();if(isAdvanced())resetRound();S.targetSlot=phaseLevels()[S.level].id==='colors'?Math.min(2,S.round):S.phase===1?0:S.round%(S.phase===2?2:3);}render();}}if(S.toastRemaining){S.toastRemaining=Math.max(0,S.toastRemaining-dt);if(!S.toastRemaining){S.toast='';const n=document.querySelector('.toast');if(n)n.textContent='';}}}if(S.page==='game'&&!S.overlay&&(S.hold||S.reward||S.toastRemaining||needsTaskTick()||needsPigTick()||needsStoryTick()))requestTick();else lastTick=0;}

// P1-only additions. P2/P3 use the original game, assets, menus and task lists.
const p1Task=(id,name,target,kind,focus,color)=>({id,name,target,kind,focus,color,action:'和'+target+'互动',feedback:'做得好！'});
const stageOne=[planetLevel,levels[3],colorLevel,
 p1Task('circle','形状朋友','绿色图形','shapes','圆形 → 正方形 → 三角形','#54e373'),
 p1Task('circle','大小星球','橙色圆球','growth','点击三次，加速长大并前进到终点','#ff9637'),
 p1Task('circle','躲猫猫','粉色圆球','peek','左侧 → 右下角 → 左上角','#ff70ba'),
 p1Task('circle','星球换位置','紫色圆球','horizontal','左 → 中 → 右','#b128ff'),
 p1Task('star','上下找星星','粉色星星','vertical','点击三次，带星星上下移动到终点','#ff79bf'),
 p1Task('circle','漂流星球','绿色圆球','drift','点击三次，推动星球加速到右侧终点','#39df96'),
 p1Task('circle','星光旅行','紫色圆球','path','点击三次，沿横向和纵向路径加速到终点','#b128ff')];
const E={easy:false,running:false,started:false,elapsed:0,progress:0,boost:false,boostTime:0,boostFrom:0,boostTo:0};
function isAdvanced(){return S.phase===1&&S.level>=3;}
function isBoost(){return isAdvanced()&&['growth','vertical','drift','path'].includes(currentLevel().kind);}
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
  if(k==='path'){const n=Math.min(2,Math.floor(E.progress*3)),f=E.progress*3-n,points=[{x:22,y:30},{x:50,y:30},{x:78,y:30},{x:78,y:70}];return{x:points[n].x+(points[n+1].x-points[n].x)*f,y:points[n].y+(points[n+1].y-points[n].y)*f};}
  if(k==='vertical'){const n=Math.min(2,Math.floor(E.progress*3)),f=E.progress*3-n,ys=[28,72,28,72];return{x:50,y:ys[n]+(ys[n+1]-ys[n])*f};}
  return{x:(k==='growth'?22:20)+(k==='growth'?56:60)*E.progress,y:50};
 }
 if(k==='horizontal')return{x:[22,50,78][r],y:50};
 if(k==='peek'){
  const previous=[{x:50,y:50},{x:22,y:50},{x:78,y:72}];
  const revealed=[{x:22,y:50},{x:78,y:72},{x:22,y:28}];
  return E.started&&E.elapsed>=2200?revealed[r]:previous[r];
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
 return `<section class="page game advanced-game ${E.easy?'easy-mode':''}" data-kind="${k}"><div class="topbar"><button class="icon-btn" data-action="pause" aria-label="暂停游戏">${icon.pause}</button><button class="icon-btn" data-action="menu" aria-label="打开游戏菜单">${icon.menu}</button><button class="small-btn" data-action="phases">返回阶段</button>${dynamic()&&!E.started?'<button class="small-btn motion-start" data-action="motion">开始运动</button>':''}</div><h1 class="advanced-title">P1 · ${S.level+1} / 10 · ${l.name}</h1><div class="task-content"><div class="task-stage"><div class="moving-anchor" style="--x:${pos.x}%;--y:${pos.y}%;--scale:${taskScale()}"><button class="object target task-object ${response?'task-reward':''}" data-object="target" aria-label="${k==='shapes'?'绿色'+shapeName():l.target}" ${motionHidden()?'hidden':''} style="--task-color:${l.color}"><div class="art">${simpleArt(type,l.color)}</div></button></div></div></div><div class="toast child-sr-only" role="status">${S.toast}</div></section>`;
}
function gameView(){return isCup()?cupView():isStory()?storyView():isPig()?pigView():isAdvanced()?advancedGameView():legacyGameView();}
function beginMotion(){if(!dynamic()||S.overlay||S.reward||E.started)return;E.started=true;E.running=true;E.elapsed=0;lastTick=0;render();}
function boostStep(){
 if(!isBoost()||S.page!=='game'||S.overlay||S.reward||E.boost||S.round>=3)return;
 endHold();E.started=true;E.running=true;E.boost=true;E.boostTime=0;E.boostFrom=E.progress;recRound(Date.now()-roundStartAt);S.round++;E.boostTo=S.round/3;S.toast='';sound();render();
}
function respondAdvanced(){
 if(S.page!=='game'||S.overlay||S.reward)return;
 if(isBoost()){boostStep();return;}
 if(motionHidden()||(currentLevel().kind==='peek'&&E.started&&E.elapsed<2200))return;
 if(dynamic()&&!E.started){beginMotion();return;}
 endHold();E.running=false;S.reward=1500;recRound(Date.now()-roundStartAt);S.round++;S.toast='';S.toastRemaining=0;sound();render();
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

// P2 fifth task: one deliberate input starts a complete tail-wag and escape sequence.
arts.pig=()=>svg(`<g fill="#ed448b"><path d="M107 201h24v64q-12 10-24 0Z"/><path d="M191 204h24v61q-12 10-24 0Z"/></g><g fill="#ff72b3"><ellipse cx="139" cy="170" rx="87" ry="58"/><path d="M89 202h26v64q-13 10-26 0ZM178 202h26v64q-13 10-26 0Z"/><ellipse cx="223" cy="151" rx="44" ry="43"/><path d="M202 121l-2-43q28 5 36 38Z"/><ellipse cx="272" cy="164" rx="24" ry="19"/></g><g fill="#e83f86"><ellipse cx="284" cy="164" rx="8" ry="15"/></g><g fill="#080808"><circle cx="243" cy="143" r="5"/><ellipse cx="285" cy="160" rx="2.5" ry="3"/><ellipse cx="285" cy="169" rx="2.5" ry="3"/><path d="M89 260h26v7q-13 8-26 0ZM178 260h26v7q-13 8-26 0Z"/></g><g class="pig-tail"><path d="M62 167C35 150 18 160 22 176C26 193 52 188 50 173C48 160 31 161 33 174" fill="none" stroke="#ff72b3" stroke-width="11" stroke-linecap="round"/></g>`,'pig-art');
const pigGrass=()=>svg('<path fill="#42da71" d="M38 274Q55 219 33 175Q78 194 84 244Q80 166 61 124Q121 162 123 238Q124 141 155 84Q167 166 163 234Q192 148 232 128Q200 209 199 247Q238 188 284 189Q243 232 244 274Z"/>');
const Pig={phase:'idle',elapsed:0,x:54,tail:0};
function isPig(){return S.phase===2&&currentLevel().id==='pig';}
function resetPig(){Object.assign(Pig,{phase:'idle',elapsed:0,x:54,tail:0});}
function needsPigTick(){return isPig()&&['wag','run'].includes(Pig.phase);}
function pigView(){
 const hint=Pig.phase==='idle'?'点点小猪，看看会发生什么':Pig.phase==='wag'?'小猪在摇尾巴！':Pig.phase==='run'?'小猪跑起来啦！':'小猪跑远啦！';
 return `<section class="page game pig-game"><div class="topbar"><button class="icon-btn" data-action="pause" aria-label="暂停游戏">${icon.pause}</button><button class="icon-btn" data-action="menu" aria-label="打开游戏菜单">${icon.menu}</button><button class="small-btn" data-action="phases">返回阶段</button></div><h1 class="advanced-title">P2 · 5 / 10 · 小猪快跑</h1><div class="pig-field"><div class="pig-grass" aria-hidden="true">${pigGrass()}</div><div class="pig-runner ${Pig.phase==='run'?'pig-running':''}" style="--pig-x:${Pig.x}%;--tail-angle:${Pig.tail}deg"><button class="pig-target" data-object="target" aria-label="粉色侧面小猪" ${Pig.phase!=='idle'?'aria-disabled="true"':''}>${arts.pig()}</button></div></div></section>`;
}
function triggerPig(){if(!isPig()||S.page!=='game'||S.overlay||Pig.phase!=='idle')return;endHold();Pig.phase='wag';Pig.elapsed=0;S.round=1;S.toast='';lastTick=0;sound();render();}
function advancePig(dt){
 if(!needsPigTick()||needsStoryTick())return;
 Pig.elapsed+=dt;
 if(Pig.phase==='wag'){
  Pig.tail=25*Math.sin(Pig.elapsed/900*Math.PI*6);
  if(Pig.elapsed>=900){Pig.phase='run';Pig.elapsed=0;Pig.tail=0;render();}
 }else if(Pig.phase==='run'){
  const t=Math.min(1,Pig.elapsed/2200);Pig.x=54+95*t*t;
  if(t>=1){Pig.x=149;Pig.phase='complete';S.reward=650;render();}
 }
 const runner=document.querySelector('.pig-runner');runner?.style.setProperty('--pig-x',Pig.x+'%');runner?.style.setProperty('--tail-angle',Pig.tail+'deg');
}

// P2 6–10: deliberate inputs start deterministic, pause-safe scene animations.
const storyLevels=[['tree','苹果落下来','苹果树'],['panda','熊猫吃竹子','竹子和熊猫'],['egg','神奇的蛋','黄色的蛋'],['leaf','苹果长叶子','红苹果'],['shadow','影子朋友','相同的影子']].map(([id,name,target])=>({id,name,target,feedback:'做得好！'}));
const Story={busy:false,time:0,step:0,done:false,choice:null};
const appleBody='<path fill="#ff293a" d="M160 100Q105 70 71 112Q36 152 71 229Q104 300 160 268Q216 300 249 229Q284 152 249 112Q215 70 160 100Z"/>';
const stalk='<path fill="#b67b40" d="M154 100Q145 65 164 39L178 46Q163 69 169 100Z"/>';
const leaf='<path fill="#55e548" d="M172 73Q197 22 245 49Q227 89 172 73Z"/>';
arts.tree=()=>svg('<path d="M145 123h33l18 178h-70Z" fill="#ab713d"/><path fill="#35d466" d="M46 151Q16 99 71 79Q61 24 120 29Q158-12 198 31Q256 19 258 78Q310 99 276 153Q249 194 201 171Q157 205 113 176Q65 199 46 151Z"/>');
arts.panda=()=>svg('<g fill="#fff"><ellipse cx="160" cy="222" rx="89" ry="79"/><circle cx="160" cy="107" r="77"/></g><g fill="#28282d"><circle cx="96" cy="51" r="31"/><circle cx="224" cy="51" r="31"/><ellipse cx="127" cy="106" rx="22" ry="30" transform="rotate(25 127 106)"/><ellipse cx="194" cy="106" rx="22" ry="30" transform="rotate(-25 194 106)"/><ellipse cx="82" cy="213" rx="25" ry="51"/><ellipse cx="238" cy="213" rx="25" ry="51"/><ellipse cx="111" cy="282" rx="41" ry="23"/><ellipse cx="209" cy="282" rx="41" ry="23"/><ellipse cx="160" cy="137" rx="13" ry="10"/></g><g fill="#fff"><circle cx="130" cy="103" r="7"/><circle cx="191" cy="103" r="7"/></g>');
arts.egg=()=>svg('<path fill="#ffdc24" d="M160 25C103 25 46 162 48 218C50 319 270 319 272 218C274 162 217 25 160 25Z"/>');
arts.leaf=()=>svg(appleBody+stalk+leaf);arts.shadow=arts.car;
const bamboo=(cut=false)=>svg('<g fill="#48e46b"><rect x="93" y="'+(cut?102:25)+'" width="26" height="'+(cut?197:274)+'" rx="9"/><rect x="198" y="67" width="24" height="232" rx="9"/><path d="M108 104Q36 50 32 99Q65 126 108 116ZM211 167Q281 103 287 151Q250 182 211 181Z"/></g><g stroke="#156f36" stroke-width="5"><path d="M94 95h24M94 168h24M94 239h24M199 132h22M199 205h22M199 270h22"/></g>');
function isStory(){return S.phase===2&&S.level>=5;}
function storyResponses(){return currentLevel().id==='panda'?2:3;}
function resetStory(){Object.assign(Story,{busy:false,time:0,step:0,done:false,choice:null});}
function needsStoryTick(){return isStory()&&Story.busy;}
function sceneButton(label,id,x,y,w,art,extra=''){return `<button class="scene-object ${extra}" data-object="${id}" aria-label="${label}" style="left:${x}%;top:${y}%;width:${w}%">${art}</button>`;}
function storyView(){const l=currentLevel();return `<section class="page game story-game"><div class="topbar"><button class="icon-btn" data-action="pause" aria-label="暂停游戏">${icon.pause}</button><button class="icon-btn" data-action="menu" aria-label="打开游戏菜单">${icon.menu}</button><button class="small-btn" data-action="phases">返回阶段</button></div><h1 class="advanced-title">P2 · ${S.level+1} / 10 · ${l.name}</h1><div class="story-field">${storyScene()}</div><div class="toast child-sr-only" role="status">${S.toast}</div></section>`;}
function storyHint(){if(Story.done)return '做得好！';const id=currentLevel().id;if(id==='tree')return Story.busy?'苹果落下来，慢慢滚到树下':'点点树，让苹果落下来';if(id==='panda')return Story.busy?(Story.step===0?'竹子落下来啦':'熊猫在吃竹子'):(Story.step===0?'点点右边的竹子':'点点熊猫，吃竹子');if(id==='egg')return Story.busy?(Story.step===2?'长出翅膀，飞起来啦':'小眼睛眨一眨'):'点点黄色的蛋';if(id==='leaf')return Story.busy?'仔细看看，苹果在变化':'点点苹果，看看新特征';return '看看上面的物体，找到相同的黑色影子';}
function pandaEatingArt(t){
 const eating=Story.busy&&Story.step===1&&t>=650;
 const open=eating?3+3*(.5+.5*Math.sin((t-650)/95)):2;
 const mouth=`<ellipse class="panda-mouth" cx="160" cy="157" rx="9" ry="${open}" fill="#19191e"/>`;
 const bite=eating&&t<2000?`<path class="panda-bite" d="M168 155l13-2-1 6-12 1Z" fill="#48e46b"/>`:'';
 return arts.panda().replace('</svg>',mouth+bite+'</svg>');
}
function storyScene(){const id=currentLevel().id,t=Story.time;let out='';
 if(id==='tree'){
  out=sceneButton('苹果树','target',50,40,42,arts.tree());
  // First apple rolls left; the next two roll right and settle side by side without overlap.
  const destinations=[[25,84],[70,84],[63,84]];
  for(let i=0;i<3;i++){if(i>Story.step||i===Story.step&&!Story.busy)continue;let [x,y]=destinations[i],rot=i===0?-230:230;
   if(i===Story.step&&Story.busy){if(t<850){const p=t/850;x=50;y=28+56*p*p;rot=0;}else{const p=Math.min(1,(t-850)/1550),e=1-(1-p)**3;x=50+(x-50)*e;y=84-2*Math.sin(p*Math.PI)*Math.exp(-p*3);rot=(i===0?-230:230)*e;}}
   out+=`<div class="scene-apple" style="left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${rot}deg)">${svg(appleBody+stalk+leaf)}</div>`;
  }
 }else if(id==='panda'){
  out=sceneButton('熊猫',Story.step===1?'target':'other',28,58,36,pandaEatingArt(t),'');
  out+=sceneButton('竹子',Story.step===0?'target':'other',76,46,31,bamboo(Story.busy||Story.step>0));
  if(Story.step||Story.busy){let x=45,y=72,r=75,remaining=1;
   if(Story.busy&&Story.step===0){const p=Math.min(1,t/1100);x=76-31*p;y=46+26*p*p;r=75*p;}
   if(Story.busy&&Story.step===1){const p=Math.min(1,t/650),e=p*p*(3-2*p);x=45-8.5*e;y=72-15*e;r=75*(1-e);remaining=t<650?1:Math.max(0,1-(t-650)/1550);}
   if(Story.done)remaining=0;
   out+=`<div class="bamboo-piece" style="left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${r}deg)"><svg viewBox="0 0 160 40" aria-hidden="true"><defs><clipPath id="bamboo-bite-clip"><rect width="${160*remaining}" height="40"/></clipPath></defs><g clip-path="url(#bamboo-bite-clip)"><rect x="3" y="7" width="154" height="26" rx="9" fill="#48e46b"/><path d="M38 7v26M116 7v26" stroke="#156f36" stroke-width="4"/></g></svg></div>`;
  }
 }else if(id==='egg'){
  const fly=Story.busy&&Story.step===2,p=fly?Math.min(1,t/2400):0;
  let art=arts.egg();if(Story.busy&&Story.step<2){const blink=t>450&&t<670?0.08:1,opacity=t<1000?1:Math.max(0,1-(t-1000)/300);art=svg('<path fill="#ffdc24" d="M160 25C103 25 46 162 48 218C50 319 270 319 272 218C274 162 217 25 160 25Z"/>'+`<g opacity="${opacity}" transform="translate(0 152) scale(1 ${blink}) translate(0 -152)"><g fill="#70e83b"><ellipse cx="123" cy="152" rx="24" ry="29"/><ellipse cx="197" cy="152" rx="24" ry="29"/></g><g fill="#080808"><ellipse cx="126" cy="153" rx="10" ry="18"/><ellipse cx="194" cy="153" rx="10" ry="18"/></g></g>`);}
  if(fly)out+=`<div class="egg-wings" style="top:${48-140*p*p}%"><svg viewBox="0 0 500 320" aria-hidden="true"><g fill="#fff" transform="translate(250 160) scale(1 ${.7+.3*Math.sin(t/160)}) translate(-250 -160)"><path d="M150 193Q35 210 10 76Q80 98 150 154ZM350 193Q465 210 490 76Q420 98 350 154Z"/></g></svg></div>`;
  out+=sceneButton('黄色的蛋','target',50,48-140*p*p,31,art);
 }else if(id==='leaf'){
  const p=Story.busy?Math.min(1,t/1300):0;const stem=Story.step>=1?1:Story.busy?p:0,leaves=Story.step>=2?1:Story.step===1&&Story.busy?p:0;
  out=sceneButton('红苹果','target',50,49,42,svg(appleBody+`<g opacity="${stem}">${stalk}</g><g opacity="${leaves}" transform="translate(172 73) scale(${Math.max(.001,leaves)}) translate(-172 -73)">${leaf}</g>`),Story.busy?'scene-glow':'');
 }else{
  const ids=['car','horse','apple'],goal=ids[Math.min(2,Story.step)];out=`<div class="shadow-sample">${arts[goal]()}</div>`;
  const order=[['horse','apple','car'],['apple','car','horse'],['car','apple','horse']][Math.min(2,Story.step)];
  out+=order.map((name,i)=>sceneButton(name===goal?'相同的影子':'其他影子',name===goal?'target':'other',20+i*30,72,23,arts[name](),'shadow-pad '+(Story.busy&&name===goal?'matched':''))).join('');
 }
 return out;}
function triggerStory(){if(!isStory()||S.overlay||S.reward||Story.busy||Story.done)return;endHold();Story.busy=true;Story.time=0;recRound(Date.now()-roundStartAt);S.round++;S.toast='';sound();render();}
function storyInput(obj,e){if(Story.busy||Story.done)return;const matching=currentLevel().id==='shadow';if((S.mode==='slap'&&!matching)||obj?.dataset.object==='target'){if(S.mode!=='dwell'){triggerStory();return;}endHold();S.hold={id:e.pointerId,elapsed:0,node:obj};obj.insertAdjacentHTML('beforeend','<span class="dwell-ring"></span>');e.preventDefault();requestTick();}else if(obj)tell('再看看，找到对应的物体');}
function advanceStory(dt){if(!needsStoryTick())return;Story.time+=dt;const id=currentLevel().id;const duration=id==='tree'?2600:id==='panda'?(Story.step===0?1250:2200):id==='egg'?(Story.step===2?2400:1350):id==='leaf'?1450:1000;
 if(Story.time>=duration){Story.busy=false;Story.step++;Story.time=0;if(Story.step>=storyResponses()){Story.done=true;S.reward=1100;}render();}else{const field=document.querySelector('.story-field');if(field)field.innerHTML=storyScene();}}

// Dependency-free projected 3D mesh: hollow tapered vessel, rim, base and rounded handle.
const cupLevel={id:'yellowCup',name:'转转黄杯子',target:'黄色杯子',action:'拖动杯子，看看不同方向',feedback:'换个方向看看'};
const Cup={yaw:.45,pitch:-.3,drag:null};
function isCup(){return S.phase===3&&currentLevel().id==='yellowCup';}
function resetCup(){Cup.yaw=.45;Cup.pitch=-.3;Cup.drag=null;}
function cupMesh(){
 const faces=[],tau=Math.PI*2,n=40;
 const point=(r,y,a)=>[r*Math.cos(a),y,r*Math.sin(a)];
 const add=(v,inside=false)=>faces.push({v,inside});
 for(let i=0;i<n;i++){const a=i/n*tau,b=(i+1)/n*tau;
  add([point(1,-1,a),point(.82,1,a),point(.82,1,b),point(1,-1,b)]);
  add([point(.89,-1,b),point(.72,.78,b),point(.72,.78,a),point(.89,-1,a)],true);
  add([point(1,-1,b),point(.89,-1,b),point(.89,-1,a),point(1,-1,a)]);
  add([[0,.78,0],point(.72,.78,a),point(.72,.78,b)],true);
  add([[0,1,0],point(.82,1,b),point(.82,1,a)]);
 }
 const hp=(a,b)=>{const y=(.72+.115*Math.cos(b))*Math.sin(a);return [.875-.09*y+(.7+.115*Math.cos(b))*Math.cos(a),y,.115*Math.sin(b)];};
 for(let i=0;i<28;i++)for(let j=0;j<8;j++){const a=-Math.PI/2+i/28*Math.PI,b=-Math.PI/2+(i+1)/28*Math.PI,c=j/8*tau,d=(j+1)/8*tau;add([hp(a,c),hp(b,c),hp(b,d),hp(a,d)]);}
 const transform=([x,y,z])=>{const xx=x*Math.cos(Cup.yaw)+z*Math.sin(Cup.yaw),zz=-x*Math.sin(Cup.yaw)+z*Math.cos(Cup.yaw);return[xx,y*Math.cos(Cup.pitch)-zz*Math.sin(Cup.pitch),y*Math.sin(Cup.pitch)+zz*Math.cos(Cup.pitch)];};
 const polygons=faces.map(f=>{const v=f.v.map(transform),a=v[0],u=v[1].map((x,i)=>x-a[i]),w=v[2].map((x,i)=>x-a[i]),normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...normal)||1;
  const light=Math.max(0,(-normal[0]*.35-normal[1]*.6+normal[2]*.72)/len),shade=(f.inside?.65:.78)+light*.22;
  const color=`rgb(${Math.round(255*shade)},${Math.round(221*shade)},${Math.round(25*shade)})`;
  const points=v.map(([x,y,z])=>{const p=5/(5-z);return `${(225+x*103*p).toFixed(2)},${(225+y*103*p).toFixed(2)}`;}).join(' ');
  return {z:v.reduce((s,p)=>s+p[2],0)/v.length,markup:`<polygon points="${points}" fill="${color}" stroke="${color}" stroke-width=".55" stroke-linejoin="round"/>`};
 }).sort((a,b)=>a.z-b.z);
 return `<svg class="cup-mesh" viewBox="0 0 500 450" aria-hidden="true">${polygons.map(p=>p.markup).join('')}</svg>`;
}
arts.yellowCup=()=>svg('<path d="M225 115h27q51 0 28 64q-15 32-51 29" fill="none" stroke="#ffdf24" stroke-width="23"/><path fill="#ffdf24" d="M62 91h174l-16 151q-65 36-137 0Z"/><ellipse cx="149" cy="91" rx="87" ry="27" fill="#ffe94b"/><ellipse cx="149" cy="92" rx="72" ry="17" fill="#b99b12"/>');
function cupView(){return `<section class="page game cup-game"><div class="topbar"><button class="icon-btn" data-action="pause" aria-label="暂停游戏">${icon.pause}</button><button class="icon-btn" data-action="menu" aria-label="打开游戏菜单">${icon.menu}</button><button class="icon-btn" data-action="phases" aria-label="返回阶段">${icon.back}</button></div><button class="cup-stage" data-object="target" aria-label="可旋转的黄色立体杯子，拖动或使用方向键旋转">${cupMesh()}</button></section>`;}
function turnCup(dx,dy=0){if(!isCup()||S.overlay)return;Cup.yaw+=dx;Cup.pitch=Math.max(-1.15,Math.min(1.15,Cup.pitch+dy));paintCup();}
function paintCup(){const node=document.querySelector('.cup-stage');if(node)node.innerHTML=cupMesh();}
function cupInput(obj,e){if(!isCup()||S.overlay)return;if(!obj){if(S.mode==='slap')turnCup(.4);return;}endHold();Cup.drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,node:obj};obj.setPointerCapture?.(e.pointerId);if(S.mode==='dwell'){S.hold={id:e.pointerId,elapsed:0,node:obj};requestTick();}e.preventDefault();}
window.addEventListener('pointermove',e=>{const d=Cup.drag;if(!d||d.id!==e.pointerId||!isCup()||S.overlay)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>2){d.moved=true;endHold();turnCup(dx*.012,dy*.008);d.x=e.clientX;d.y=e.clientY;}});
window.addEventListener('pointerup',e=>{if(Cup.drag?.id!==e.pointerId)return;const d=Cup.drag;Cup.drag=null;if(!d.moved&&S.mode!=='dwell')turnCup(.4);});
window.addEventListener('pointercancel',()=>{Cup.drag=null;});
window.addEventListener('keydown',e=>{if(!isCup()||S.overlay||!e.target?.closest?.('.cup-stage'))return;const moves={ArrowLeft:[-.25,0],ArrowRight:[.25,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]};if(moves[e.key]){e.preventDefault();turnCup(...moves[e.key]);}});

render();
/* Android long presses can omit click. Complete the hold directly, while the
   finger is still down; never depend on a synthetic click after pointerup. */
function cancelParentHold(){
 const hold=parentHold;parentHold=null;
 if(!hold)return;
 clearTimeout(hold.timer);hold.node.classList.remove('holding');
 if(hold.node.hasPointerCapture?.(hold.id))hold.node.releasePointerCapture(hold.id);
}
document.addEventListener('pointerdown',e=>{
 if(parentHold){cancelParentHold();return;}
 parentClickBlocked=false;
 const b=e.target?.closest?.('.parent-entry');
 if(!b||e.button!==0||e.isPrimary===false||S.overlay==='parent')return;
 e.preventDefault();
 const hold={id:e.pointerId,node:b,timer:null};parentHold=hold;
 b.classList.add('holding');b.setPointerCapture?.(e.pointerId);
 hold.timer=setTimeout(()=>{
  if(parentHold!==hold)return;
  if(document.hidden||!b.isConnected){cancelParentHold();return;}
  // Keep the release on the stable app root when render replaces the button.
  // Otherwise a touchend can click a tab inside the newly opened iframe.
  parentClickBlocked=true;app.setPointerCapture?.(hold.id);
  cancelParentHold();openParent();
 },PARENT_HOLD_MS);
},true);
document.addEventListener('pointermove',e=>{
 if(!parentHold||e.pointerId!==parentHold.id)return;
 const r=parentHold.node.getBoundingClientRect();
 if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cancelParentHold();
},true);
for(const type of ['pointerup','pointercancel','lostpointercapture']){
 document.addEventListener(type,e=>{if(e.pointerId===parentHold?.id)cancelParentHold();},true);
}
document.addEventListener('contextmenu',e=>{if(e.target?.closest?.('.parent-entry'))e.preventDefault();},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelParentHold();});
window.addEventListener('blur',cancelParentHold);
// Compatibility clicks can be hit-tested inside the iframe even when the
// pointer stream stayed captured by the app. Guard that same-origin document
// too, until the old release is consumed or the next deliberate press starts.
app.addEventListener('load',e=>{
 if(!e.target.matches?.('.parent-frame'))return;
 const doc=e.target.contentDocument;
 if(!doc)return;
 doc.addEventListener('pointerdown',()=>{parentClickBlocked=false;},true);
 doc.addEventListener('click',e=>{
  if(!parentClickBlocked)return;
  parentClickBlocked=false;e.preventDefault();e.stopImmediatePropagation();
 },true);
},true);
/* 家长端弹窗里的「开始训练」交回儿童模式：约定一条同源 postMessage */
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==document.querySelector('.parent-frame')?.contentWindow)return;
 const d=e.data;
 if(!d||d.type!=='microstar:start-level')return;
 const phase=Math.max(1,Math.min(3,Math.floor(Number(d.phase))||1));
 const list=phase===1?stageOne:phase===2?[...levels,pigLevel,...storyLevels]:[cupLevel,...customLevels()];
 const index=Math.max(0,Math.min(list.length-1,Math.floor(Number(d.index))||0));
 const mode=['slap','precise','dwell'].includes(d.mode)?d.mode:'slap';
 const t=Number(d.timeoutMs);if(isFinite(t))ROUND_TIMEOUT_MS=Math.max(10000,Math.min(90000,t));
 if(typeof d.sound==='boolean')soundOn=d.sound;
 if(['standard','large','huge'].includes(d.size)){TARGET_SIZE=d.size;document.documentElement?.style?.setProperty('--target-scale',d.size==='huge'?'1.48':d.size==='large'?'1.2':'1');}
 parentPreviousOverlay=null;
 S.phase=phase;S.mode=mode;
 startLevel(index);
});
/* ---- 训练记录桥：把每关成绩写进 localStorage，家长端读取同一份 ---- */
var roundStartAt=0,currentRec=null,pendingOffset=null,TARGET_SIZE='standard';
var ROUND_TIMEOUT_MS=30000;
var GAME_RECORD_KEY='microstar.game.sessions';
function recStart(){currentRec={id:'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),startedAt:Date.now(),phase:S.phase,levelIndex:S.level,levelName:(phaseLevels()[S.level]||{}).name||'',mode:S.mode,size:TARGET_SIZE,rounds:[]};roundStartAt=Date.now();}
function recSave(){if(!currentRec||!currentRec.rounds.length)return;currentRec.endedAt=Date.now();try{var a=JSON.parse(localStorage.getItem(GAME_RECORD_KEY)||'[]');var i=-1;for(var k=0;k<a.length;k++){if(a[k]&&a[k].id===currentRec.id){i=k;break;}}if(i>=0){a[i]=currentRec;}else{a.push(currentRec);}localStorage.setItem(GAME_RECORD_KEY,JSON.stringify(a.slice(-40)));}catch(e){}}
function timeoutRound(){
 E.roundElapsed=0;recRound(null,true);
 recRound(Date.now()-roundStartAt);S.round++;
 if(S.round>=3){if(S.level<phaseLevels().length-1)startLevel(S.level+1);else setOverlay('menu');render();requestTick();return;}
 roundStartAt=Date.now();
 if(isAdvanced())resetRound();
 S.targetSlot=phaseLevels()[S.level].id==='colors'?Math.min(2,S.round):S.phase===1?0:S.round%(S.phase===2?2:3);
 render();requestTick();
}
function recRound(latencyMs,isTimeout){if(!currentRec||currentRec.levelIndex!==S.level||currentRec.phase!==S.phase)recStart();currentRec.rounds.push(isTimeout?{latencyMs:null,ok:false}:{latencyMs:Math.max(0,Math.round(latencyMs)),ok:true,offsetRatio:pendingOffset});pendingOffset=null;recSave();}
function saveGameRecord(){if(isPig()&&currentRec&&!currentRec.rounds.length)recRound(Date.now()-roundStartAt);try{let a=JSON.parse(localStorage.getItem('microstar.game-records.v1')||'[]');if(!Array.isArray(a))a=[];a.push({at:Date.now(),phase:S.phase,level:S.level,name:currentLevel().name,mode:S.mode,responses:S.round,durationMs:Math.max(0,Date.now()-gameStartedAt-gamePausedTotal)});localStorage.setItem('microstar.game-records.v1',JSON.stringify(a.slice(-200)));}catch{}recSave();}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==document.querySelector('.parent-frame')?.contentWindow||e.data?.type!=='microstar:start-game')return;const p=e.data.settings;if(!p||![1,2,3].includes(p.phase)||!['slap','precise','dwell'].includes(p.mode))return;S.phase=p.phase;S.mode=p.mode;soundOn=p.sound;parentPreviousOverlay=null;startLevel(0);});

function markOffset(node,ev){try{if(!node||!ev||typeof ev.clientX!=='number')return;const r=node.getBoundingClientRect();if(!r||!r.width)return;const cx=r.left+r.width/2,cy=r.top+r.height/2;pendingOffset=Math.min(3,Math.hypot(ev.clientX-cx,ev.clientY-cy)/(r.width/2));}catch(e){}}

// Native Android back never advances a round or silently resumes a paused game.
window.microstarAndroidBack=function(){
 if(S.overlay==='parent'){closeParent();return true;}
 if(S.page==='game'){
  if(S.overlay==='menu'){setOverlay('pause');return true;}
  if(S.overlay){phaseView();return true;}
  setOverlay('pause');return true;
 }
 if(S.page==='phases'){home();return true;}
 return false;
};
window.microstarAndroidPause=function(){
 endHold();cancelParentHold();Cup.drag=null;
 if(S.page==='game'&&!S.overlay)setOverlay('pause');
};

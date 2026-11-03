const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function environment(source){const listeners={},wins={},root={innerHTML:'',addEventListener:(t,f)=>listeners[t]=f};const c={document:{querySelector:s=>s==='#app'?root:null,querySelectorAll:()=>[],addEventListener:()=>{},hidden:false},window:{addEventListener:(t,f)=>wins[t]=f},requestAnimationFrame:()=>{},console};vm.createContext(c);vm.runInContext(source,c);return{root,listeners,wins,run:s=>vm.runInContext(s,c)};}
const env=environment(fs.readFileSync(require('node:path').join(__dirname,'../dist/game.js'),'utf8')), {root,run,listeners,wins}=env;
let time=0;function advance(ms){for(let n=0;n<ms;n+=50){time+=50;run(`tick(${time})`);}}
function start(p,l,mode='slap'){run(`S.phase=${p};S.mode=${JSON.stringify(mode)};startLevel(${l})`);}
const node={dataset:{object:'target'},insertAdjacentHTML:()=>{},getBoundingClientRect:()=>({left:0,right:100,top:0,bottom:100})};
function tap(target=node,id=1){listeners.pointerdown({button:0,pointerId:id,preventDefault:()=>{},target:{closest:s=>s==='[data-object]'?target:null}});}
assert.match(root.innerHTML,/点击或拍击来开始吧/);run('phaseView()');assert.match(root.innerHTML,/Phase III/);
for(const p of [1,2,3]){run(`S.phase=${p}`);assert.equal(run('phaseLevels().length'),p===1?10:4);}
// Compare the restored P2/P3 with actual historical source, not a hand-written replica.
const old=environment(fs.readFileSync(require('node:path').join(__dirname,'fixtures/legacy-game.js'),'utf8'));
const normalize=s=>s.replace(/<button class="parent-entry"[\s\S]*?<\/button>/g,'').replace(/class="([^"]*)"/g,(_,x)=>'class="'+x.trim().replace(/\s+/g,' ')+'"');
for(const p of [2,3])for(let l=0;l<4;l++)for(const mode of ['slap','precise','dwell']){
 start(p,l,mode);old.run(`S.phase=${p};S.mode=${JSON.stringify(mode)};startLevel(${l})`);
 assert.equal(normalize(root.innerHTML),normalize(old.root.innerHTML),`P${p}.${l+1} game restored`);
 run('setOverlay("menu")');old.run('setOverlay("menu")');assert.equal(normalize(root.innerHTML),normalize(old.root.innerHTML),'original menu restored');
 run('setOverlay(null);respond()');old.run('setOverlay(null);respond()');assert.equal(normalize(root.innerHTML),normalize(old.root.innerHTML),'original feedback restored');
}
start(1,0);advance(3000);assert.equal(run('S.round'),0);tap();assert.equal(run('S.round'),1);tap();assert.equal(run('S.round'),1);run('setOverlay("pause")');advance(1600);assert.equal(run('S.reward'),1500);
start(1,1);assert.match(root.innerHTML,/star-art/);
start(1,2);for(let i=0;i<3;i++){assert.equal(run('S.targetSlot'),i);tap({dataset:{object:'other'}});assert.equal(run('S.round'),i);tap();advance(1800);}assert.notEqual(run('S.overlay'),'done');
// Three inputs accelerate three segments; success requires arriving at the actual final endpoint.
for(const l of [4,7,8]){
 start(1,l);assert.equal(run('E.progress'),0);advance(2000);assert.equal(run('E.progress'),0,'initial observation remains still');
 for(let i=0;i<3;i++){
  tap();assert.equal(run('S.round'),i+1);assert.equal(run('S.reward'),0,'a tap does not freeze the object');assert.equal(run('E.running'),true);
  const before=run('E.progress');advance(350);assert.ok(run('E.progress')>before,'object moves after tap');
  tap();assert.equal(run('S.round'),i+1,'tap during the same acceleration cannot skip segments');
  const frozen=run('E.progress');run('setOverlay("pause")');advance(600);assert.equal(run('E.progress'),frozen);run('setOverlay(null)');
  if(i===2)assert.equal(run('S.overlay'),null,'third tap is not immediate success');
  advance(700);if(i<2){assert.equal(run('S.overlay'),null);assert.equal(run('S.reward'),0);assert.equal(run('E.running'),true);}
 }
 assert.equal(run('E.progress'),1);assert.ok(run('S.reward')>0);advance(1700);assert.notEqual(run('S.overlay'),'done');
 run('action("replay")');assert.equal(run('E.progress'),0);assert.equal(run('S.round'),0);
}
// Peek reappears at three different spatial positions and never counts hidden taps.
start(1,5);run('beginMotion()');
for(const [i,pos] of [[0,[22,50]],[1,[78,72]],[2,[22,28]]]){
 if(i===0)advance(1500);else advance(200);
 assert.equal(run('motionHidden()'),true);tap();assert.equal(run('S.round'),i);
 advance(1100);assert.equal(run('motionHidden()'),false);assert.deepEqual(JSON.parse(JSON.stringify(run('position()'))),{x:pos[0],y:pos[1]});
 tap();assert.equal(run('S.round'),i+1);advance(1700);
}
assert.notEqual(run('S.overlay'),'done');
// Rest of P1 still completes normally; colors vary by task without recoloring the original first three.
for(const l of [3,6,9]){start(1,l,'precise');for(let i=0;i<3;i++){if(run('dynamic()')){run('beginMotion()');advance(100);}tap();advance(1800);}assert.notEqual(run('S.overlay'),'done');}
assert.equal(run('stageOne[3].color'),'#54e373');assert.equal(run('stageOne[4].color'),'#ff9637');assert.equal(run('stageOne[5].color'),'#ff70ba');assert.equal(run('stageOne[6].color'),'#b57aff');
start(1,8,'dwell');tap(node,8);advance(500);wins.pointermove({pointerId:8,clientX:200,clientY:50});assert.equal(run('S.hold'),null);assert.equal(run('S.round'),0);tap(node,9);advance(1250);assert.equal(run('S.round'),1);
console.log('PASS: P2/P3 historical rendering and input regression, restored stage entry, P1 first three, three-tap accelerated motion with arrival-based success, pause/replay/dwell, spatial hide-and-seek and color variation.');

for(const p of [1,2,3]){start(p,0);assert.match(root.innerHTML,/class="parent-entry"/);run("action('parent')");assert.equal(run('S.overlay'),'parent');const round=run('S.round');advance(2000);assert.equal(run('S.round'),round);run("action('parent-return')");assert.equal(run('S.overlay'),null);}
start(1,4);run("setOverlay('menu');action('parent');action('parent-return')");assert.equal(run('S.overlay'),'menu');

for(const p of [1,2,3]){start(p,0);run('S.round=3;S.reward=1');advance(100);assert.equal(run('S.level'),1);assert.equal(run('S.overlay'),null);assert.equal(run('S.round'),0);start(p,p===1?9:3);run('S.round=3;S.reward=1');advance(100);assert.equal(run('S.overlay'),'menu');assert.doesNotMatch(root.innerHTML,/这一关完成啦/);}

start(2,1);run("respond();action('parent')");assert.match(root.innerHTML,/src="parent\/index.html"/);assert.match(root.innerHTML,/title="微动星瞳家长端"/);advance(2000);assert.equal(run('S.reward'),1500);run("action('parent-return')");assert.equal(run('S.level'),1);assert.equal(run('S.round'),1);assert.equal(run('S.overlay'),null);

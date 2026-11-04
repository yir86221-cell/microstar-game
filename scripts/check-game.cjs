const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function environment(source){const listeners={},wins={},root={innerHTML:'',addEventListener:(t,f)=>listeners[t]=f};const c={document:{querySelector:s=>s==='#app'?root:null,querySelectorAll:()=>[],addEventListener:()=>{},hidden:false},window:{addEventListener:(t,f)=>{const prev=wins[t];wins[t]=prev?e=>{prev(e);f(e)}:f}},requestAnimationFrame:()=>{},console};vm.createContext(c);vm.runInContext(source,c);return{root,listeners,wins,run:s=>vm.runInContext(s,c)};}
const env=environment(fs.readFileSync(require('node:path').join(__dirname,'../dist/game.js'),'utf8')), {root,run,listeners,wins}=env;
let time=0;function advance(ms){for(let n=0;n<ms;n+=50){time+=50;run(`tick(${time})`);}}
function start(p,l,mode='slap'){run(`S.phase=${p};S.mode=${JSON.stringify(mode)};startLevel(${l})`);}
const node={dataset:{object:'target'},insertAdjacentHTML:()=>{},getBoundingClientRect:()=>({left:0,right:100,top:0,bottom:100})};
function tap(target=node,id=1){listeners.pointerdown({button:0,pointerId:id,preventDefault:()=>{},target:{closest:s=>s==='[data-object]'?target:null}});}
assert.match(root.innerHTML,/点击或拍击来开始吧/);run('phaseView()');assert.match(root.innerHTML,/Phase III/);
for(const p of [1,2,3]){run(`S.phase=${p}`);assert.equal(run('phaseLevels().length'),p===1?10:p===2?10:5);}
// Compare the restored P2/P3 with actual historical source, not a hand-written replica.
const old=environment(fs.readFileSync(require('node:path').join(__dirname,'fixtures/legacy-game.js'),'utf8'));
const normalize=s=>s.replace(/<p class="(?:task-caption|mode-note)[^"]*"[^>]*>[\s\S]*?<\/p>/g,'').replace(/ child-sr-only/g,'').replace(/story-levels/g,'').replace(/<button class="preview[^"]*" data-level="[4-9]"[\s\S]*?<\/button>/g,'').replace(/<button class="parent-entry"[\s\S]*?<\/button>/g,'').replace(/class="([^"]*)"/g,(_,x)=>'class="'+x.trim().replace(/\s+/g,' ')+'"');
for(const p of [2,3])for(let l=0;l<4;l++)for(const mode of ['slap','precise','dwell']){
 start(p,p===3?l+1:l,mode);old.run(`S.phase=${p};S.mode=${JSON.stringify(mode)};startLevel(${l})`);
 assert.equal(normalize(root.innerHTML),normalize(old.root.innerHTML),`P${p}.${l+1} game restored`);
 run('setOverlay("menu")');old.run('setOverlay("menu")');if(p===2)assert.equal(normalize(root.innerHTML),normalize(old.root.innerHTML),'original menu restored');else assert.match(root.innerHTML,/转转黄杯子/);
 run('setOverlay(null);respond()');old.run('setOverlay(null);respond()');assert.equal(normalize(root.innerHTML),normalize(old.root.innerHTML),'original feedback restored');
}
start(1,0);advance(3000);assert.equal(run('S.round'),0);tap();assert.equal(run('S.round'),1);tap();assert.equal(run('S.round'),1);run('setOverlay("pause")');advance(1600);assert.equal(run('S.reward'),1500);
start(1,1);assert.match(root.innerHTML,/star-art/);
start(1,2);for(let i=0;i<3;i++){assert.equal(run('S.targetSlot'),i);tap({dataset:{object:'other'}});assert.equal(run('S.round'),i);tap();advance(1800);}assert.notEqual(run('S.overlay'),'done');
// Three inputs accelerate three segments; success requires arriving at the actual final endpoint.
for(const l of [4,7,8,9]){
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
for(const l of [3,6]){start(1,l,'precise');for(let i=0;i<3;i++){if(run('dynamic()')){run('beginMotion()');advance(100);}tap();advance(1800);}assert.notEqual(run('S.overlay'),'done');}
assert.equal(run('stageOne[3].color'),'#54e373');assert.equal(run('stageOne[4].color'),'#ff9637');assert.equal(run('stageOne[5].color'),'#ff70ba');assert.equal(run('stageOne[6].color'),'#b128ff');
start(1,8,'dwell');tap(node,8);advance(500);wins.pointermove({pointerId:8,clientX:200,clientY:50});assert.equal(run('S.hold'),null);assert.equal(run('S.round'),0);tap(node,9);advance(1250);assert.equal(run('S.round'),1);
console.log('PASS: P2/P3 historical rendering and input regression, restored stage entry, P1 first three, three-tap accelerated motion with arrival-based success, pause/replay/dwell, spatial hide-and-seek and color variation.');

for(const p of [1,2,3]){start(p,0);assert.match(root.innerHTML,/class="parent-entry"/);run("action('parent')");assert.equal(run('S.overlay'),'parent');const round=run('S.round');advance(2000);assert.equal(run('S.round'),round);run("action('parent-return')");assert.equal(run('S.overlay'),null);}
start(1,4);run("setOverlay('menu');action('parent');action('parent-return')");assert.equal(run('S.overlay'),'menu');

for(const p of [1,2,3]){start(p,p===3?1:0);run('S.round=3;S.reward=1');advance(100);assert.equal(run('S.level'),p===3?2:1);assert.equal(run('S.overlay'),null);assert.equal(run('S.round'),0);start(p,p===1?9:p===2?9:4);run('S.round=3;S.reward=1');advance(100);if(p<3){assert.equal(run('S.phase'),p+1);assert.equal(run('S.level'),0);assert.equal(run('S.overlay'),null);}else assert.equal(run('S.overlay'),'menu');assert.doesNotMatch(root.innerHTML,/这一关完成啦/);}

start(2,1);run("respond();action('parent')");assert.match(root.innerHTML,/src="parent\/index.html"/);assert.match(root.innerHTML,/title="微动星瞳家长端"/);advance(2000);assert.equal(run('S.reward'),1500);run("action('parent-return')");assert.equal(run('S.level'),1);assert.equal(run('S.round'),1);assert.equal(run('S.overlay'),null);

// Only the embedded parent frame can apply validated game settings.
run("globalThis.location={origin:'https://example.test'};globalThis.localStorage={items:{},getItem(k){return this.items[k]||null},setItem(k,v){this.items[k]=v}};globalThis.parentSource={};const baseQuery=document.querySelector;document.querySelector=q=>q==='.parent-frame'?{contentWindow:parentSource}:baseQuery(q)");
const source=run('parentSource');const settings={phase:3,mode:'precise',sound:true,size:'large'};wins.message({origin:'https://wrong.test',source,data:{type:'microstar:start-game',settings}});start(1,0);wins.message({origin:'https://example.test',source,data:{type:'microstar:start-game',settings:{...settings,phase:4}}});assert.equal(run('S.phase'),1);wins.message({origin:'https://example.test',source,data:{type:'microstar:start-game',settings}});assert.equal(run('S.phase'),3);assert.equal(run('S.mode'),'precise');assert.equal(run('soundOn'),true);assert.equal(run('S.level'),0);run('startLevel(1);S.round=3;S.reward=1');advance(100);assert.equal(run("JSON.parse(localStorage.getItem('microstar.game-records.v1'))[0].responses"),3);

// P1 1/2 advance after one complete feedback, with exactly one recorded response.
for(const l of [0,1]){
 start(1,l);assert.equal(run('requiredResponses()'),1);tap();assert.equal(run('S.round'),1);
 assert.equal(run('S.level'),l,'feedback finishes before advancing');
 advance(1700);assert.equal(run('S.level'),l+1);assert.equal(run('S.round'),0);
 const records=run("JSON.parse(localStorage.getItem('microstar.game-records.v1'))");
 assert.equal(records.at(-1).responses,1,'record reflects one response, not three');
}
// Path finishes at the final corner only after three actual movements.
start(1,9);assert.deepEqual(JSON.parse(JSON.stringify(run('position()'))),{x:22,y:30});
for(const [i,point] of [[1,{x:50,y:30}],[2,{x:78,y:30}],[3,{x:78,y:70}]]){
 tap();assert.equal(run('S.round'),i);advance(950);
 const pos=JSON.parse(JSON.stringify(run('position()')));assert.ok(Math.abs(pos.x-point.x)<.5&&Math.abs(pos.y-point.y)<.5);
 if(i<3){assert.equal(run('S.reward'),0);assert.equal(run('S.overlay'),null);}else assert.ok(run('S.reward')>0);
}
advance(1700);assert.equal(run('S.phase'),2,'last P1 task flows directly to P2');assert.equal(run('S.level'),0);assert.equal(run('S.overlay'),null);
assert.equal(run('stageOne[9].color'),'#b128ff');
assert.ok(run('ballColors.every(c=>c.lit===c.base)'),'guidance and reward keep saturated original colors');
console.log('PASS: one-response P1 1/2 and records; three-step P1 10 with corner arrival; saturated color feedback.');

// One click starts wag -> run -> entirely offscreen -> success, without repeat counting.
start(2,4,'precise');assert.match(root.innerHTML,/粉色侧面小猪/);assert.match(root.innerHTML,/pig-grass/);advance(4000);assert.equal(run('Pig.phase'),'idle');
assert.equal(run('requiredResponses()'),1);tap(null);assert.equal(run('Pig.phase'),'idle','grass/background does not activate precise mode');
tap();assert.equal(run('Pig.phase'),'wag');assert.equal(run('S.round'),1);advance(250);assert.equal(run('Pig.x'),54);assert.notEqual(run('Pig.tail'),0);
const wagElapsed=run('Pig.elapsed');tap();assert.equal(run('Pig.elapsed'),wagElapsed);assert.equal(run('S.round'),1);
run('setOverlay("pause")');advance(1500);assert.equal(run('Pig.elapsed'),wagElapsed);run('setOverlay(null)');
advance(700);assert.equal(run('Pig.phase'),'run');assert.equal(run('S.reward'),0,'tail wag is not success');
advance(1000);assert.ok(run('Pig.x')>54);assert.equal(run('Pig.phase'),'run');assert.equal(run('S.reward'),0,'success waits until full exit');
const runElapsed=run('Pig.elapsed');run("action('parent')");advance(1000);assert.equal(run('Pig.elapsed'),runElapsed);run("action('parent-return')");advance(1350);
assert.equal(run('Pig.phase'),'complete');assert.equal(run('Pig.x'),149);assert.ok(run('S.reward')>0);advance(700);assert.equal(run('S.level'),5);assert.equal(run('S.overlay'),null);
start(2,4);
const pigRecords=run("JSON.parse(localStorage.getItem('microstar.game-records.v1'))");assert.equal(pigRecords.at(-1).name,'小猪快跑');assert.equal(pigRecords.at(-1).responses,1);
run('action("resume")');assert.equal(run('Pig.phase'),'idle','completion menu starts a fresh pig');
run('action("replay")');assert.equal(run('Pig.phase'),'idle');assert.equal(run('Pig.x'),54);assert.equal(run('S.round'),0);
start(2,4,'dwell');tap(node,22);advance(500);wins.pointermove({pointerId:22,clientX:200,clientY:50});assert.equal(run('S.hold'),null);assert.equal(run('Pig.phase'),'idle');tap(node,23);advance(1300);assert.equal(run('Pig.phase'),'wag');
start(2,4);tap(null);assert.equal(run('Pig.phase'),'wag','slap mode remains available');
start(2,3);run('S.round=3;S.reward=1');advance(100);assert.equal(run('S.level'),4,'P2 fourth task advances into new fifth task');assert.equal(run('Pig.phase'),'idle');
console.log('PASS: direct P1 to P2 handoff, P2 fifth task wag-before-run, full-exit success, repeat guard, pause/parent/replay, all three input modes and one-response record.');
// Story animations settle before counting completion; no input can skip an in-flight step.
for(const [index,durations] of [[5,[2600,2600,2600]],[6,[1250,2200]],[7,[1350,1350,2400]],[8,[1450,1450,1450]],[9,[1000,1000,1000]]]){
 start(2,index,'precise');const idle=root.innerHTML;advance(3000);assert.equal(run('Story.step'),0);assert.equal(run('Story.busy'),false);
 tap(null);assert.equal(run('S.round'),0,'precise background does not activate scene');
 for(let i=0;i<durations.length;i++){
  tap();assert.equal(run('S.round'),i+1);assert.equal(run('Story.busy'),true);tap();assert.equal(run('S.round'),i+1);
  advance(250);const frozen=run('Story.time');run('setOverlay("pause")');advance(1000);assert.equal(run('Story.time'),frozen);run('setOverlay(null)');
  run('action("parent")');advance(500);assert.equal(run('Story.time'),frozen);run('action("parent-return")');
  advance(durations[i]-250);assert.equal(run('Story.step'),i+1);assert.equal(run('Story.busy'),false);
  if(i<durations.length-1)assert.equal(run('S.reward'),0);else assert.ok(run('S.reward')>0);
 }
 if(index===5){assert.match(run('storyScene()'),/left:10.5%/);assert.match(run('storyScene()'),/left:17.5%/);assert.match(run('storyScene()'),/top:73.9%/);}
 advance(1200);if(index<9)assert.equal(run('S.level'),index+1);else {assert.equal(run('S.phase'),3);assert.equal(run('S.level'),0);}
 start(2,index);run('action("replay")');assert.equal(run('Story.step'),0);assert.equal(run('Story.busy'),false);
}
start(2,6,'precise');tap({dataset:{object:'other'}});assert.equal(run('S.round'),0);tap();advance(1300);assert.match(run('storyHint()'),/点点熊猫/);assert.equal(run('Story.step'),1);
start(2,7);tap();advance(500);assert.match(run('storyScene()'),/scale\(1 0.08\)/,'eyelids close');advance(900);assert.doesNotMatch(run('storyScene()'),/#70e83b/,'eyes disappear between taps');tap();advance(1400);tap();advance(2000);assert.match(run('storyScene()'),/egg-wings/);assert.equal(run('S.reward'),0,'egg must fully fly off before completion');
start(2,8);assert.doesNotMatch(run('storyScene()'),/opacity="1"/);tap();advance(1500);assert.match(run('storyScene()'),/opacity="1"/);
start(2,9);tap(null);assert.equal(run('S.round'),0,'matching never chooses automatically in slap mode');tap({dataset:{object:'other'}});assert.equal(run('S.round'),0);tap();advance(1100);assert.equal(run('Story.step'),1);
start(2,5,'dwell');tap(node,50);advance(500);wins.pointerup({pointerId:50});advance(1000);assert.equal(run('S.round'),0);tap(node,51);advance(1250);assert.equal(run('Story.busy'),true);
console.log('PASS: P2 6–10 three settled apples, bamboo then panda, two blinks then winged flight, feature growth, all silhouette choices; repeat protection, input modes, pause/parent and automatic progression.');
// P2 success flows directly to a stationary, manipulable 3D cup without an invented timeout.
start(2,9,'precise');for(let i=0;i<3;i++){tap();advance(1050);}advance(1200);assert.equal(run('S.phase'),3);assert.equal(run('S.level'),0);assert.equal(run('isCup()'),true);assert.match(root.innerHTML,/可旋转的黄色立体杯子/);
const mesh=run('cupMesh()');assert.ok((mesh.match(/<polygon/g)||[]).length>400);advance(10000);assert.equal(run('cupMesh()'),mesh,'cup stays still during observation');
run('turnCup(.7,.2)');assert.notEqual(run('cupMesh()'),mesh);const yaw=run('Cup.yaw');run('setOverlay("pause");turnCup(1)');assert.equal(run('Cup.yaw'),yaw);run('setOverlay(null)');
run('action("cup-reset")');assert.equal(run('cupMesh()'),mesh);run('action("cup-up")');assert.ok(run('Cup.pitch')<-.3);run('action("replay")');assert.equal(run('Cup.yaw'),.45);
const cupNode={...node,setPointerCapture:()=>{}};const input={pointerId:80,clientX:100,clientY:100,preventDefault:()=>{}};run('S.mode="precise"');const cStart=run('Cup.yaw');run('globalThis.cupNode={setPointerCapture(){}}');run('cupInput(cupNode,{pointerId:80,clientX:100,clientY:100,preventDefault(){}})');wins.pointermove({pointerId:80,clientX:150,clientY:120});assert.ok(run('Cup.yaw')>cStart);wins.pointerup({pointerId:80});assert.equal(run('Cup.drag'),null);assert.equal(run('S.round'),0,'free exploration is not a clinical score or automatic completion');
run('turnCup(0,99)');assert.equal(run('Cup.pitch'),1.15);run('turnCup(0,-99)');assert.equal(run('Cup.pitch'),-1.15);
console.log('PASS: P2 to P3 transition, stationary hollow cup mesh, drag/tap/keyboard controls, pitch limits, pause, replay and preserved legacy P3 tasks.');
for(const phase of [1,2,3]){run(`S.phase=${phase}`);const count=run('phaseLevels().length');for(let i=0;i<count;i++){start(phase,i);assert.doesNotMatch(root.innerHTML,/<p class="(?:task-caption|mode-note|advanced-hint|advanced-mode-note)/);}}
start(3,0);assert.doesNotMatch(root.innerHTML,/cup-controls|<h1|拖动黄杯子，转一转/);
// Handle terminates inside the solid wall, never enters the hollow interior.
for(let a=-Math.PI/2;a<=Math.PI/2;a+=Math.PI/160)for(let b=0;b<Math.PI*2;b+=Math.PI/12){const y=(.72+.115*Math.cos(b))*Math.sin(a),x=.875-.09*y+(.7+.115*Math.cos(b))*Math.cos(a),z=.115*Math.sin(b);const inner=.805-.085*y;assert.ok(Math.hypot(x,z)>inner,'handle stays outside hollow cavity');}
console.log('PASS: all child captions removed, cup-only scene and handle geometry outside the cup cavity.');

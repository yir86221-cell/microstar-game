import { store, type SessionRecord } from './store.js';
import type { RangeResult } from './range-lamp.js';
export function saveRangeResult(result: RangeResult): void {
  if(store.state.isDemo)store.clearDemo();
  if(store.state.sessions.some(s=>s.id===result.id))return;
  const elapsed=result.outcome==='found' ? result.sample!.elapsedMs : null;
  const record: SessionRecord = {
    id:result.id,startedAt:result.startedAt,endedAt:result.endedAt,stage:4,levelId:'physical',levelName:'实物寻找 · 设备测距',
    mode:'physical',origin:'parent',brightness:result.color[4]!,litMinutes:(result.endedAt-result.startedAt)/60000,rangeResult:result,
    trials:[{id:result.id,index:0,tStim:0,tFirstMotion:null,tHit:elapsed,tRelease:null,
      outcome:result.outcome==='found'?'hit':'abort',judge:'range',latencyMs:elapsed,pickedUpAtStart:false,abortReason:result.reason}],
  };
  store.update(s=>{s.sessions.push(record);});
}

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { EventBus } from '../src/core/EventBus.js';
import { WaveManager, planWave } from '../src/systems/WaveManager.js';

const tick=()=>new Promise(resolve=>setTimeout(resolve,5));

// 用旧调度规则复现：spawn 失败仍递增 spawned，实际只生成 13/14，最终永久剩 1。
function reproduceLegacyWave2(){
  const total=planWave(2).sequence.length,hardLimit=total-1,active=[];
  let plannedSpawned=0,spawned=0,remaining=total,spawnTimer=.45,queue=0;
  while(plannedSpawned<total){
    spawnTimer-=1;
    if(spawnTimer<=0){if(active.length<hardLimit)active.push({alive:true});plannedSpawned++;spawned++;spawnTimer=.55;}
  }
  for(const enemy of active){enemy.alive=false;remaining--;}
  return {wave:2,total,remaining,active:active.filter(e=>e.alive).length,queue,plannedSpawned,spawned,spawnTimer:+spawnTimer.toFixed(2),settlement:false};
}

class HeadlessEnemyManager{
  constructor(bus,{mobile=false,hardLimit=50}={}){
    this.bus=bus;this.mobile=mobile;this.hardLimit=hardLimit;this.active=[];this.spawnLog=[];this.positions=[];
    // 注册顺序与正式 EnemyManager 一致：先回收，再由 WaveManager 收到 despawn 并补位。
    bus.on('enemy:despawn',({enemy})=>this.recycle(enemy));
  }
  setDifficulty(scale){this.scale=scale;}
  spawn(type,wave){
    if(this.active.length>=this.hardLimit)return null;
    const enemy={type,wave,alive:true,id:this.spawnLog.length+1};this.active.push(enemy);this.spawnLog.push(enemy);return enemy;
  }
  recycle(enemy){const i=this.active.indexOf(enemy);if(i<0)return false;this.active.splice(i,1);return true;}
}

async function runTenWaves({mobile=false}={}){
  const bus=new EventBus(),enemies=new HeadlessEnemyManager(bus,{mobile}),cleared=[],rows=[];
  const waves=new WaveManager(bus,enemies,{random:()=>0,clearDelay:0});
  bus.on('wave:cleared',({wave})=>cleared.push(wave));
  for(let wave=1;wave<=10;wave++){
    const before=enemies.spawnLog.length;waves.start(wave);
    let peak=enemies.active.length,bossSummoned=false,replenishments=0,guard=0;
    while(waves.running&&guard++<500){
      const live=enemies.active.filter(e=>e.alive);
      peak=Math.max(peak,enemies.active.length);
      const boss=live.find(e=>e.type==='boss');
      if(boss&&!bossSummoned){bossSummoned=true;bus.emit('boss:phase',{enemy:boss});peak=Math.max(peak,enemies.active.length);}
      const target=live[0];
      assert.ok(target,`第 ${wave} 波运行中却没有可消灭敌人`);
      const queuedBefore=waves.queue.length,activeBefore=enemies.active.length;
      target.alive=false;bus.emit('enemy:killed',{enemy:target});bus.emit('enemy:killed',{enemy:target});
      bus.emit('enemy:despawn',{enemy:target});
      if(queuedBefore>0){
        replenishments++;
        assert.equal(enemies.active.length,activeBefore,`第 ${wave} 波回收后未立即补位`);
        const expectedFloor=Math.min(waves.activeCap-2,waves.remaining);
        assert.ok(enemies.active.filter(e=>e.alive).length>=expectedFloor,`第 ${wave} 波补位后活跃数低于 activeCap-2`);
      }
      peak=Math.max(peak,enemies.active.length);
      assert.ok(enemies.active.length<=waves.activeCap,`第 ${wave} 波突破同屏上限`);
    }
    await tick();
    const actualSpawned=enemies.spawnLog.length-before;
    assert.ok(guard<500,`第 ${wave} 波疑似卡关`);
    assert.equal(waves.remaining,0,`第 ${wave} 波 remaining 未归零`);
    assert.equal(enemies.active.length,0,`第 ${wave} 波 active 未归零`);
    assert.equal(waves.queue.length,0,`第 ${wave} 波 queue 未清空`);
    assert.equal(actualSpawned,waves.total,`第 ${wave} 波实际刷出数不等于 total`);
    assert.equal(cleared.at(-1),wave,`第 ${wave} 波没有进入结算`);
    rows.push({wave,type:waves.plan.rhythm,total:waves.total,activeCap:waves.activeCap,peakActive:peak,actualSpawned,replenishments,remaining:waves.remaining,active:0,queue:0,settlement:true});
  }
  return rows;
}

const reproduction=reproduceLegacyWave2();
assert.deepEqual({remaining:reproduction.remaining,active:reproduction.active,settlement:reproduction.settlement},{remaining:1,active:0,settlement:false});
const desktop=await runTenWaves();
const mobile=await runTenWaves({mobile:true});
assert.ok(mobile.every(row=>row.peakActive<=12),'手机端出现超过 12 个活跃敌人');

const result={generatedAt:new Date().toISOString(),legacyWave2Reproduction:reproduction,desktop10Waves:desktop,mobileSummary:{waves:mobile.length,maxPeak:Math.max(...mobile.map(r=>r.peakActive)),allSettled:mobile.every(r=>r.settlement)}};
await mkdir('artifacts/batch4',{recursive:true});
await writeFile('artifacts/batch4/verification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));

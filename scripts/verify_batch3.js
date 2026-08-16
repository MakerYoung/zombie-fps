import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { EventBus } from '../src/core/EventBus.js';
import { WaveManager } from '../src/systems/WaveManager.js';
import { Progression, LOCKED_WEAPONS } from '../src/progression/Progression.js';
import { Stats } from '../src/player/Stats.js';

class MemoryStorage{
  constructor(){this.values=new Map();}
  getItem(k){return this.values.has(k)?this.values.get(k):null;}
  setItem(k,v){this.values.set(k,String(v));}
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));

async function verifyWaves(){
  const bus=new EventBus(),active=[],cleared=[];
  const enemies={setDifficulty(){},spawn(type,wave){const enemy={type,wave,alive:true};active.push(enemy);return enemy;}};
  const waves=new WaveManager(bus,enemies,{random:()=>0,clearDelay:0});
  bus.on('wave:cleared',e=>cleared.push(e.wave));
  const details=[];
  for(let wave=1;wave<=5;wave++){
    waves.start(wave);
    let bossPhased=false,guard=0;
    const initialBoss=active.find(e=>e.alive&&e.type==='boss');
    if(initialBoss){bossPhased=true;bus.emit('boss:phase',{enemy:initialBoss});}
    while(waves.plannedSpawned<waves.plan.sequence.length&&guard++<100){waves.update(1,true);const boss=active.find(e=>e.alive&&e.type==='boss');if(boss&&!bossPhased){bossPhased=true;bus.emit('boss:phase',{enemy:boss});}}
    const spawnedTypes=active.filter(e=>e.alive).map(e=>e.type);
    for(const enemy of [...active]){if(!enemy.alive)continue;enemy.alive=false;bus.emit('enemy:killed',{enemy});bus.emit('enemy:killed',{enemy});active.splice(active.indexOf(enemy),1);bus.emit('enemy:despawn',{enemy});}
    await tick();
    assert.equal(waves.remaining,0,`第 ${wave} 波剩余数应归零`);
    assert.equal(waves.running,false,`第 ${wave} 波应结束`);
    assert.equal(cleared.at(-1),wave,`第 ${wave} 波应进入结算`);
    details.push({wave,spawnedTypes,total:waves.total,spawned:waves.spawned,remaining:waves.remaining,active:active.length,settlement:cleared.includes(wave)});
  }
  assert.deepEqual(details[4].spawnedTypes.sort(),['assault','assault','assault','assault','boss','rocketeer'].sort());
  return details;
}

function verifyProgression(){
  const storage=new MemoryStorage(),fresh=new Progression(storage);
  assert.equal(fresh.data.cores,20);assert.deepEqual(LOCKED_WEAPONS.filter(id=>fresh.isWeaponUnlocked(id)),[]);
  const earned=fresh.award({kills:80,waves:5,bossKills:1});
  assert.equal(earned,115);assert.equal(fresh.data.cores,135);
  assert.equal(fresh.unlockWeapon('ace').ok,true);assert.equal(fresh.isWeaponUnlocked('ace'),true);
  fresh.award({kills:500});
  for(const id of ['moveSpeed','maxHealth','startingCoins','startingBuffs'])assert.equal(fresh.upgradeTalent(id).ok,true);
  const stats=new Stats(),run=fresh.applyRun(stats);
  assert.ok(Math.abs(stats.get('moveSpeed')-7.35)<1e-9);assert.equal(stats.get('maxHealth'),110);assert.deepEqual(run,{coins:20,freeChoices:1});
  const restored=new Progression(storage);
  assert.equal(restored.isWeaponUnlocked('ace'),true);assert.deepEqual(restored.data.talents,{moveSpeed:1,maxHealth:1,startingCoins:1,startingBuffs:1});
  return {initialCores:20,lockedAtStart:LOCKED_WEAPONS,earnedFormula:'80×1 + 5×3 + 1×20 = 115',afterUnlockCores:75,unlockedWeapon:'ace',talents:restored.data.talents,runStats:{moveSpeed:+stats.get('moveSpeed').toFixed(2),maxHealth:stats.get('maxHealth'),startingCoins:run.coins,freeChoices:run.freeChoices},persisted:true};
}

const result={generatedAt:new Date().toISOString(),waves:await verifyWaves(),progression:verifyProgression()};
await mkdir('artifacts/batch3',{recursive:true});
await writeFile('artifacts/batch3/verification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));

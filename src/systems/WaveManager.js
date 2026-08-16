import { ENEMY_ORDER, unlockWave } from '../enemies/enemyTypes.js';

const RHYTHM=['rest','small','large']; // wave % 3: 1 小、2 大、0 喘息
const BASE={easy:{count:.8,health:.85,speed:.92,mix:.75},normal:{count:1,health:1,speed:1,mix:1},hard:{count:1.25,health:1.2,speed:1.1,mix:1.3}};
const sequence=(counts)=>Object.entries(counts).flatMap(([type,count])=>Array(Math.max(0,count)).fill(type));

export function buildScale(strength=0,difficulty='normal'){
  const base=BASE[difficulty]||BASE.normal,bonus=Math.min(.45,Math.max(0,strength)*.03),countBonus=Math.min(.45,Math.max(0,strength)*.02);
  return {health:base.health*(1+bonus),speed:base.speed,count:base.count*(1+countBonus),strength,bonus:+bonus.toFixed(3)};
}

export function planWave(wave,{difficulty='normal',strength=0,boss=false}={}){
  const scale=buildScale(strength,difficulty),rhythm=RHYTHM[wave%3];
  if(boss){const composition=wave===5?{boss:1,rocketeer:1}:{boss:1};return {wave,rhythm:'boss',boss:true,dropMultiplier:2,scale,composition,sequence:sequence(composition)};}
  const baseCount=rhythm==='large'?10+wave*2:rhythm==='rest'?3+Math.ceil(wave*.65):5+wave;
  const total=Math.max(2,Math.round(baseCount*scale.count)),unlocked=ENEMY_ORDER.filter(t=>t!=='boss'&&unlockWave(t)<=wave),c={};
  if(wave<=2)c.assault=total;
  else if(rhythm==='large'){
    // 大波优先使用明确协同组合，再用突击兵填充规模。
    if(wave>=6){c.shooter=Math.max(2,Math.round(total*.3));c.exploder=Math.max(2,Math.round(total*.2));}
    else if(wave>=4){c.assault=Math.max(3,Math.round(total*.5));c.heavy=Math.max(1,Math.round(total*.2));}
    else{c.assault=Math.ceil(total*.65);c.shooter=total-c.assault;}
  }else{
    c.assault=Math.ceil(total*.55);let left=total-c.assault;const extras=unlocked.filter(t=>t!=='assault');for(let i=0;i<left;i++){const t=extras[i%Math.max(1,extras.length)]||'assault';c[t]=(c[t]||0)+1;}
  }
  const current=Object.values(c).reduce((a,b)=>a+b,0);c.assault=(c.assault||0)+Math.max(0,total-current);
  // 解锁波保证新单位实际登场，而不只是进入随机池。
  for(const type of unlocked){if(type!=='assault'&&unlockWave(type)===wave&&!c[type]){c[type]=1;c.assault=Math.max(0,c.assault-1);}}
  return {wave,rhythm,boss:false,dropMultiplier:rhythm==='rest'?1.8:1,scale,composition:c,sequence:sequence(c)};
}

export class WaveManager {
  constructor(bus,enemies,{difficulty='normal',getStrength=()=>0,random=Math.random,clearDelay=650,activeCaps={}}={}){
    this.bus=bus;this.enemies=enemies;this.difficulty=difficulty;this.getStrength=getStrength;this.random=random;this.clearDelay=clearDelay;
    this.activeCaps={mobile:12,desktop:25,boss:15,special:18,...activeCaps};this.wave=0;this.running=false;this.nextBoss=5;this.killed=new WeakSet();
    bus.on('enemy:killed',({enemy})=>this.countKill(enemy));
    // EnemyManager 更早注册该事件，因此执行到这里时对象已经离开 active，可立即补位。
    bus.on('enemy:despawn',({enemy})=>this.onDespawn(enemy));
    bus.on('boss:phase',()=>this.summon());
  }
  isBossWave(wave){return wave===5||wave===this.nextBoss;}
  resolveActiveCap(plan){
    const platform=this.enemies.mobile?this.activeCaps.mobile:this.activeCaps.desktop;
    if(plan.boss)return Math.min(platform,this.activeCaps.boss);
    const hasSpecial=plan.sequence.some(type=>type==='exploder'||type==='sniper');
    return hasSpecial?Math.min(platform,this.activeCaps.special):platform;
  }
  start(wave){
    const boss=this.isBossWave(wave);if(boss)this.nextBoss=wave+5+Math.floor(this.random()*3);
    this.plan=planWave(wave,{difficulty:this.difficulty,strength:this.getStrength(),boss});this.wave=wave;this.running=true;this.clearScheduled=false;this.killed=new WeakSet();
    this.queue=[...this.plan.sequence];this.spawned=0;this.plannedSpawned=0;this.defeated=0;this.total=this.queue.length;this.remaining=this.total;this.spawnTimer=0;this.activeCap=this.resolveActiveCap(this.plan);
    this.enemies.setDifficulty(this.plan.scale);this.bus.emit('wave:start',{...this.plan,total:this.total,activeCap:this.activeCap});this.fillActiveSlots();return this.plan;
  }
  activeCount(){return Array.isArray(this.enemies.active)?this.enemies.active.length:0;}
  update(){if(this.running)this.fillActiveSlots();}
  fillActiveSlots(){
    if(!this.running)return 0;let added=0;
    while(this.queue.length&&this.activeCount()<this.activeCap){
      const type=this.queue[0],enemy=this.enemies.spawn(type,this.wave);
      // 生成失败时保留队首，下帧重试，绝不把不存在的敌人记成已刷出。
      if(!enemy)break;
      // 对象池会在同一波复用 Enemy；新生命必须移除该对象上一条生命的死亡标记。
      this.killed.delete(enemy);
      this.queue.shift();this.spawned++;this.plannedSpawned=this.spawned;added++;
    }
    this.emitCount();return added;
  }
  summon(){
    if(!this.running)return;const summons=Array(4).fill('assault');this.queue.push(...summons);this.remaining+=summons.length;this.total+=summons.length;
    this.bus.emit('boss:summoned',{count:summons.length});this.fillActiveSlots();
  }
  countKill(enemy){
    if(!this.running||!enemy||this.killed.has(enemy))return;
    this.killed.add(enemy);this.defeated++;this.remaining=Math.max(0,this.total-this.defeated);this.emitCount();
  }
  onDespawn(enemy){
    if(!this.running)return;
    // 非死亡回收不能吞掉计划数：把同类型放回队首重新生成。
    if(enemy&&!this.killed.has(enemy)){this.queue.unshift(enemy.type);this.spawned=Math.max(0,this.spawned-1);this.plannedSpawned=this.spawned;}
    this.fillActiveSlots();this.check();
  }
  emitCount(){this.bus.emit('wave:count',{remaining:this.remaining,active:this.activeCount(),queued:this.queue.length,spawned:this.spawned,total:this.total,activeCap:this.activeCap});}
  check(){
    this.emitCount();
    if(this.remaining===0&&this.queue.length===0&&this.activeCount()===0&&!this.clearScheduled){
      this.running=false;this.clearScheduled=true;const wave=this.wave,dropMultiplier=this.plan.dropMultiplier;
      setTimeout(()=>{if(this.wave===wave&&this.clearScheduled)this.bus.emit('wave:cleared',{wave,dropMultiplier});},this.clearDelay);
    }
  }
}

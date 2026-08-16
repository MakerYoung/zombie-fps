import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port=41746,out=new URL('../artifacts/batch6/',import.meta.url);fs.mkdirSync(out,{recursive:true});
const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe'],detached:true});
const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Vite 启动超时')),15000),done=d=>{if(String(d).includes('Local:')){clearTimeout(timer);resolve();}};server.stdout.on('data',done);server.stderr.on('data',done);});
const report={generatedAt:new Date().toISOString(),runtime:'Playwright + Vite 真实游戏 ?verify=1',waves:[],navigation:{}};
const round=n=>+n.toFixed(2),vec=p=>({x:round(p.x),z:round(p.z)});

// 在真实游戏循环中，通过正常的输入开火杀敌；只用 verify 权限提高伤害和选择可见射位来缩短八波耗时。
async function clearWave(page,wave){
  const started=Date.now(),samples=[];let maxActive=0,shotsBefore=await page.evaluate(()=>window.__batch6.shots);
  while(Date.now()-started<60000){
    const state=await page.evaluate(()=>{const g=window.__verifyGame,w=g.waves,alive=g.enemies.active.filter(e=>e.alive),p=g.engine.camera.position;g.health.value=9999;g.weapon.ammo=999;
      const e=alive[0];if(e){const ep=e.group.position;let firing=false;for(const radius of [8,12,16])for(let i=0;i<16&&!firing;i++){const a=i*Math.PI/8,c={x:ep.x+Math.cos(a)*radius,y:1.72,z:ep.z+Math.sin(a)*radius};if(g.map.collides(c,.38))continue;let open=true;for(let s=1;s<=6;s++){const q={x:c.x+(ep.x-c.x)*s/7,y:1.25,z:c.z+(ep.z-c.z)*s/7};if(g.map.collides(q,.08)){open=false;break;}}if(!open)continue;g.engine.camera.position.set(c.x,c.y,c.z);const dx=ep.x-c.x,dz=ep.z-c.z,dy=1.08*e.def.scale-c.y;g.player.yaw=Math.atan2(-dx,-dz);g.player.pitch=Math.atan2(dy,Math.hypot(dx,dz));g.input.state.move.y=0;g.input.state.fire=true;firing=true;}if(!firing){g.input.state.fire=false;g.input.state.move.y=0;}}else{g.input.state.fire=false;g.input.state.move.y=0;}
      const r=n=>Math.round(n*100)/100;return{remaining:w.remaining,active:w.activeCount(),queue:w.queue.length,spawned:w.spawned,total:w.total,state:g.state,enemy:e?{type:e.type,x:r(e.group.position.x),y:r(e.group.position.y),z:r(e.group.position.z),collides:g.map.collides(e.group.position,.42*e.def.scale)}:null};});
    maxActive=Math.max(maxActive,state.active);if(!samples.length||samples.at(-1).remaining!==state.remaining||samples.at(-1).queue!==state.queue)samples.push({...state,t:round((Date.now()-started)/1000)});
    if(state.state==='choice'){await page.evaluate(()=>window.__verifyGame.input.state.fire=false);const shots=await page.evaluate(()=>window.__batch6.shots);assert.equal(state.remaining,0,`第 ${wave} 波 remaining 未归零`);assert.equal(state.active,0,`第 ${wave} 波仍有 active`);assert.equal(state.queue,0,`第 ${wave} 波仍有 queue`);return{wave,total:state.total,spawned:state.spawned,remaining:0,active:0,queue:0,maxActive,shots:shots-shotsBefore,elapsedSeconds:round((Date.now()-started)/1000),settlement:true,samples};}
    await page.waitForTimeout(35);
  }
  throw new Error(`第 ${wave} 波 60 秒内未结算: ${JSON.stringify(samples.at(-1))}`);
}

async function runNavigation(page,mapId,setup){
  const initial=await page.evaluate(({mapId,setup})=>{const g=window.__verifyGame;g.loop.timeScale=4;g.input.state.fire=false;g.enemies.clear();g.enemyProjectiles.clear();g.waves.running=false;g.setActive(g.maps[mapId]);g.state='playing';g.health.value=1000;g.engine.camera.position.set(setup.player.x,1.72,setup.player.z);g.player.velocity.set(0,0,0);const e=g.enemies.spawn(setup.type||'assault',8,setup.enemy);window.__batch6.nav={attacks:0,projectiles:0};g.bus.on('enemy:attack',({enemy})=>{if(enemy===e)window.__batch6.nav.attacks++;});g.bus.on('enemy:projectile',({enemy})=>{if(enemy===e)window.__batch6.nav.projectiles++;});return{visible:e.hasLineOfSight(g.engine.camera.position,g.map),health:g.health.value};},{mapId,setup});
  assert.equal(initial.visible,false,`${mapId} 初始位置没有被墙遮挡`);const start=Date.now(),track=[];let blockedHealth=initial.health,firstAttackAt=null,firstVisibleAt=null;
  while(Date.now()-start<60000){const s=await page.evaluate(()=>{const g=window.__verifyGame,e=g.enemies.active[0],visible=e?.hasLineOfSight(g.engine.camera.position,g.map);return{position:e?{x:e.group.position.x,z:e.group.position.z}:null,visible,health:g.health.value,attacks:window.__batch6.nav.attacks,projectiles:window.__batch6.nav.projectiles,distance:e?e.group.position.distanceTo(g.engine.camera.position):99};});
    const elapsed=(Date.now()-start)/1000;if(!track.length||elapsed-track.at(-1).t>=.25)track.push({t:round(elapsed),...vec(s.position)});if(!s.visible&&blockedHealth===undefined&&elapsed>.5)blockedHealth=s.health;if(s.visible&&firstVisibleAt===null)firstVisibleAt=elapsed;if((s.attacks||s.projectiles)&&firstAttackAt===null)firstAttackAt=elapsed;
    if(firstAttackAt!==null){assert.equal(blockedHealth,1000,'隔墙阶段玩家血量下降');return{start:track[0],waypoint:track[Math.floor(track.length/2)],end:track.at(-1),elapsedSeconds:round(elapsed),firstVisibleSeconds:round(firstVisibleAt??elapsed),firstAttackSeconds:round(firstAttackAt),blockedHealth,finalHealth:s.health,attacks:s.attacks,projectiles:s.projectiles,trackPoints:track.length,track};}await page.waitForTimeout(40);
  }throw new Error(`${mapId} 绕行后 60 秒内未攻击: ${JSON.stringify({start:track[0],mid:track[Math.floor(track.length/2)],end:track.at(-1),points:track.length})}`);
}

try{
  await ready;const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});await page.goto(`http://127.0.0.1:${port}?verify=1`,{waitUntil:'networkidle'});await page.locator('#start').click();await page.locator('[data-map="transportShip"]').click();await page.locator('#confirmLoadout').click();
  await page.evaluate(()=>{const g=window.__verifyGame;g.stats.add('batch6Damage','damage',80);g.stats.add('batch6Health','maxHealth',100,'mul');window.__batch6={shots:0};g.bus.on('weapon:shoot',()=>window.__batch6.shots++);});
  if(!process.argv.includes('--nav-only'))for(let wave=1;wave<=8;wave++){const row=await clearWave(page,wave);report.waves.push(row);console.log(`[batch6] 运输船第 ${wave} 波: total=${row.total} spawned=${row.spawned} remaining=0 active=0 queue=0 shots=${row.shots} ${row.elapsedSeconds}s`);if(wave<8){await page.locator('#cards .card').first().click();await page.locator('.nextWave').click();await page.waitForFunction(n=>window.__verifyGame.wave===n,wave+1);}}
  report.navigation.container=await runNavigation(page,'transportShip',{player:{x:5.7,z:9},enemy:{x:11,z:9}});
  report.navigation.room=await runNavigation(page,'base',{player:{x:-20,z:18},enemy:{x:-12,z:14}});
  report.navigation.rangedLos=await runNavigation(page,'transportShip',{player:{x:5.7,z:9},enemy:{x:11,z:9},type:'shooter'});
  assert(report.navigation.container.firstAttackSeconds>report.navigation.container.firstVisibleSeconds,'集装箱隔墙时发生攻击');assert(report.navigation.room.firstAttackSeconds>report.navigation.room.firstVisibleSeconds,'房间隔墙时发生攻击');assert.equal(report.navigation.rangedLos.projectiles>0,true,'远程敌人绕出墙后未射击');
  await page.screenshot({path:new URL('final-real-game.png',out).pathname});await browser.close();fs.writeFileSync(new URL('verification.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{try{process.kill(-server.pid,'SIGTERM');}catch{} }

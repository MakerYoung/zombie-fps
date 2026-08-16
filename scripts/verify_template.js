import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { WEAPONS } from '../src/weapons/weaponData.js';
import { ENEMY_TYPES, ENEMY_ORDER, unlockWave } from '../src/enemies/enemyTypes.js';
import { MAP_DEFS } from '../src/map/mapDefs.js';
import { planWave } from '../src/systems/WaveManager.js';

const port=4174,out='artifacts/step5-template';fs.mkdirSync(out,{recursive:true});
const report={generatedAt:new Date().toISOString(),assertions:{},maps:{},screenshots:[]};
let server=null;
try{const response=await fetch(`http://127.0.0.1:${port}/`);if(!response.ok)throw new Error();}
catch{server=spawn('npx',['vite','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe'],detached:true});}
const ready=server?new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Vite preview startup timed out')),15000),done=data=>{if(String(data).includes('Local:')){clearTimeout(timer);resolve();}};server.stdout.on('data',done);server.stderr.on('data',done);}):Promise.resolve();
const shot=async(page,name)=>{await page.screenshot({path:`${out}/${name}`});report.screenshots.push(`${out}/${name}`);};

try{
  await ready;const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:812,height:375},screen:{width:812,height:375},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();await page.goto(`http://127.0.0.1:${port}/?verify&map=base`,{waitUntil:'networkidle'});
  const uiRegistry=await page.evaluate(desc=>{const g=window.__verifyGame,loadout=document.querySelector('#loadout').textContent;return {unlocked:g.progression.isWeaponUnlocked('longbow'),loadoutHasWeapon:loadout.includes('长弓'),loadoutHasMap:loadout.includes('边境哨站'),loadoutHasDesc:loadout.includes(desc)};},MAP_DEFS.borderPost.desc);
  const registry={weapon:Boolean(WEAPONS.longbow),weaponData:WEAPONS.longbow&&{category:WEAPONS.longbow.category,damage:WEAPONS.longbow.damage,headshotMultiplier:WEAPONS.longbow.headshotMultiplier,hasAnims:Boolean(WEAPONS.longbow.anims?.config)},enemy:Boolean(ENEMY_TYPES.striker),enemyOrder:ENEMY_ORDER.indexOf('striker'),unlockWave:unlockWave('striker'),waveSixCount:planWave(6).composition.striker||0,map:Boolean(MAP_DEFS.borderPost),...uiRegistry};
  report.assertions.registries={pass:registry.weapon&&registry.weaponData.category==='pistol'&&registry.weaponData.damage===120&&registry.weaponData.headshotMultiplier===3&&registry.weaponData.hasAnims&&registry.unlocked&&registry.loadoutHasWeapon&&registry.enemy&&registry.enemyOrder>=0&&registry.unlockWave===6&&registry.waveSixCount>=1&&registry.map&&registry.loadoutHasMap&&registry.loadoutHasDesc,...registry};
  assert(report.assertions.registries.pass,'Asset registration or loadout visibility failed');

  const weapon=await page.evaluate(async()=>{
    const g=window.__verifyGame;g.start({mapId:'base',weaponIds:{pistol:'longbow'}});g.waves.running=false;g.enemies.clear();
    const selected=g.inventory.find(w=>w.data.id==='longbow'),parts=selected.group.userData.partCount,arms=selected.group.userData.armCount;
    const switched=g.switchWeapon('longbow');for(let i=0;i<20;i++)g.inventory.forEach(w=>w.update(.02,false));
    return {inventory:g.inventory.map(w=>w.data.id),parts,arms,switched,current:g.weapon.data.id,switching:g.switchingWeapon,visible:selected.group.visible,anims:Boolean(selected.anims?.config)};
  });
  report.assertions.weapon={pass:weapon.inventory.includes('longbow')&&weapon.parts>0&&weapon.arms===2&&weapon.switched&&weapon.current==='longbow'&&!weapon.switching&&weapon.visible&&weapon.anims,...weapon};
  assert(report.assertions.weapon.pass,'Longbow model, animation, or switching failed');
  await page.evaluate(()=>{const g=window.__verifyGame;g.state='paused';g.engine.camera.rotation.set(0,0,0);document.querySelectorAll('.show').forEach(e=>e.classList.remove('show'));g.engine.render();});
  await shot(page,'longbow-812x375.png');

  const enemy=await page.evaluate(()=>{
    const g=window.__verifyGame;g.enemies.clear();g.weapon.group.visible=false;const striker=g.enemies.spawn('striker',6,{x:1.2,z:0}),assault=g.enemies.spawn('assault',6,{x:-1.2,z:0});
    let kills=0;g.bus.on('enemy:killed',({enemy})=>{if(enemy===striker)kills++;});const before=g.economy.coins,names=striker.parts.map(p=>p.name),modelType=striker.model.group.userData.modelType,parts=striker.parts.length,coinValue=striker.def.coinValue;
    striker.hit(striker.health+1);return {kills,before,after:g.economy.coins,gain:g.economy.coins-before,alive:striker.alive,coinValue,names,modelType,parts,assaultParts:assault.parts.length};
  });
  report.assertions.enemy={pass:enemy.kills===1&&!enemy.alive&&enemy.gain===6&&enemy.coinValue===6&&enemy.parts>0&&enemy.names.includes('head')&&enemy.names.includes('body')&&enemy.modelType==='striker',...enemy};
  assert(report.assertions.enemy.pass,'Striker factory model or kill settlement failed');
  await page.waitForTimeout(500);
  await page.evaluate(()=>{const g=window.__verifyGame;g.enemies.clear();const a=g.enemies.spawn('assault',6,{x:-.8,z:0}),s=g.enemies.spawn('striker',6,{x:.8,z:0});a.group.rotation.y=Math.PI;s.group.rotation.y=Math.PI;g.engine.camera.position.set(0,1.45,3.8);g.engine.camera.lookAt(0,1,0);g.engine.camera.updateMatrixWorld(true);g.engine.render();});
  await shot(page,'striker-assault-812x375.png');

  const maps=await page.evaluate(()=>{
    const result={},g=window.__verifyGame;
    for(const id of ['base','transportShip','testmap','borderPost']){const map=g.maps[id],def=map.def;let correct=0;for(let i=0;i<200;i++){const p={x:((i*73)%199)/198*def.width-def.width/2,y:1.72,z:((i*47)%197)/196*def.length-def.length/2},r=.38;const expected=Math.abs(p.x)+r>map.boundsX-.5||Math.abs(p.z)+r>map.boundsZ-.5||map.colliders.some(b=>p.x+r>b.min.x&&p.x-r<b.max.x&&p.z+r>b.min.z&&p.z-r<b.max.z&&p.y>b.min.y-.2&&p.y-1.7<b.max.y);if(map.collides(p,r)===expected)correct++;}const spawn={...map.playerSpawn};result[id]={samples:200,correct,accuracy:correct/2,colliders:map.colliders.length,platforms:map.platforms.length,spawnCollides:map.collides(spawn,.38),objects:def.objects.length};}return result;
  });
  report.maps=maps;report.assertions.maps={pass:Object.values(maps).every(m=>m.correct===200&&!m.spawnCollides)&&maps.borderPost.objects>=40,ids:Object.keys(maps),borderPostObjects:maps.borderPost.objects};
  assert(report.assertions.maps.pass,'Map collision sampling or borderPost structure failed');

  await page.evaluate(()=>{const g=window.__verifyGame;g.start({mapId:'borderPost',weaponIds:{pistol:'longbow'}});g.state='paused';g.waves.running=false;g.enemies.clear();g.inventory.forEach(w=>w.group.visible=false);g.engine.camera.position.set(g.map.playerSpawn.x,g.map.playerSpawn.y,g.map.playerSpawn.z);g.engine.camera.rotation.set(0,g.map.playerSpawn.yaw,0);g.engine.render();});
  await shot(page,'border-post-player-812x375.png');
  await page.evaluate(()=>{const g=window.__verifyGame;g.engine.camera.position.set(0,48,0);g.engine.camera.rotation.set(-Math.PI/2,0,0);g.engine.camera.fov=62;g.engine.camera.updateProjectionMatrix();g.engine.render();});
  await shot(page,'border-post-top-812x375.png');
  report.assertions.screenshots={pass:report.screenshots.length===4&&report.screenshots.every(path=>fs.existsSync(path)),viewport:'812x375',paths:report.screenshots};
  assert(report.assertions.screenshots.pass,'Required screenshots were not generated');
  await browser.close();fs.writeFileSync(`${out}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{if(server)try{process.kill(-server.pid,'SIGTERM');}catch{}}

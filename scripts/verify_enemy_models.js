import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port=4174,out=new URL('../artifacts/step3-enemy/',import.meta.url);fs.mkdirSync(out,{recursive:true});
const report={generatedAt:new Date().toISOString(),assertions:{},screenshots:[]};
let server=null;
try{const response=await fetch(`http://127.0.0.1:${port}/`);if(!response.ok)throw new Error();}catch{server=spawn('npx',['vite','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe'],detached:true});}
const ready=server?new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Vite preview startup timed out')),15000),done=data=>{if(String(data).includes('Local:')){clearTimeout(timer);resolve();}};server.stdout.on('data',done);server.stderr.on('data',done);}):Promise.resolve();
const round=value=>+value.toFixed(6);

async function setup(page){
  await page.goto(`http://127.0.0.1:${port}/?verify&map=base`,{waitUntil:'networkidle'});
  await page.evaluate(()=>{const g=window.__verifyGame;g.start({mapId:'base'});g.state='paused';g.waves.running=false;g.enemies.clear();g.enemyProjectiles.clear();g.weapon.group.visible=false;});
}

try{
  await ready;
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:812,height:375},screen:{width:812,height:375},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();await setup(page);
  const models=await page.evaluate(()=>{
    const g=window.__verifyGame,assault=g.enemies.spawn('assault',7,{x:-1.35,z:0}),drone=g.enemies.spawn('drone',7,{x:1.35,z:0});
    window.__step3={assault,drone};
    const names=enemy=>enemy.parts.map(part=>part.name);
    return {assault:{childCount:assault.model.group.children.length,names:names(assault),modelType:assault.model.group.userData.modelType},drone:{childCount:drone.model.group.children.length,names:names(drone),modelType:drone.model.group.userData.modelType,partLinks:drone.parts.filter(part=>part.userData.enemy===drone&&Number.isFinite(part.userData.baseEmissive)).length,parts:drone.parts.length}};
  });
  report.assertions.defaultModel={pass:models.assault.childCount>0&&models.assault.names.includes('head')&&models.assault.names.includes('body')&&models.assault.modelType==='assault',...models.assault};
  report.assertions.customModel={pass:models.drone.modelType==='drone'&&models.drone.names.includes('drone-core')&&models.drone.names.includes('drone-ring-a')&&models.drone.partLinks===models.drone.parts,...models.drone};
  assert(report.assertions.defaultModel.pass,'Default assault model regressed');assert(report.assertions.customModel.pass,'Drone custom model was not loaded');

  const animation=await page.evaluate(async()=>{
    const {assault,drone}=window.__step3,g=window.__verifyGame,samples=[],swings=[];
    g.engine.camera.position.set(0,1.72,8);
    for(let i=0;i<12;i++){assault.update(1/30,g.engine.camera,g.map);drone.update(1/30,g.engine.camera,g.map);samples.push(drone.group.position.y);swings.push(assault.group.rotation.z);await new Promise(resolve=>setTimeout(resolve,24));}
    return {floatMin:Math.min(...samples),floatMax:Math.max(...samples),floatDelta:Math.max(...samples)-Math.min(...samples),walkPeak:Math.max(...swings.map(Math.abs)),walkParts:assault.walkParts.length};
  });
  report.assertions.animation={pass:animation.floatDelta>.02&&animation.walkPeak>.005&&animation.walkParts===2,...Object.fromEntries(Object.entries(animation).map(([key,value])=>[key,typeof value==='number'?round(value):value]))};
  assert(report.assertions.animation.pass,'Enemy animation parameters were not applied');

  const killed=await page.evaluate(()=>{const g=window.__verifyGame,{drone}=window.__step3;let events=0;g.bus.on('enemy:killed',({enemy})=>{if(enemy===drone)events++;});const before=g.economy.coins;drone.hit(drone.health+1);return{events,before,after:g.economy.coins,gain:g.economy.coins-before,alive:drone.alive,coinValue:drone.def.coinValue};});
  report.assertions.killChain={pass:killed.events===1&&!killed.alive&&killed.gain===9&&killed.coinValue===9,...killed};assert(report.assertions.killChain.pass,'Drone kill event or coin settlement failed');

  await page.waitForTimeout(500);await page.evaluate(()=>{
    const g=window.__verifyGame;g.enemies.clear();const assault=g.enemies.spawn('assault',7,{x:-1.25,z:0}),drone=g.enemies.spawn('drone',7,{x:1.25,z:0});assault.group.rotation.y=Math.PI;drone.group.rotation.y=Math.PI;g.engine.camera.position.set(0,1.55,6);g.engine.camera.lookAt(0,1.15,0);g.engine.camera.updateMatrixWorld(true);
  });
  await page.waitForTimeout(150);let name='assault-drone-812x375.png';await page.screenshot({path:new URL(name,out).pathname});report.screenshots.push(`artifacts/step3-enemy/${name}`);
  await page.evaluate(()=>{const g=window.__verifyGame;g.enemies.clear();const drone=g.enemies.spawn('drone',7,{x:0,z:0});drone.group.rotation.y=Math.PI;g.engine.camera.position.set(0,1.42,2.7);g.engine.camera.lookAt(0,1.25,0);g.engine.camera.updateMatrixWorld(true);});
  await page.waitForTimeout(150);name='drone-closeup-812x375.png';await page.screenshot({path:new URL(name,out).pathname});report.screenshots.push(`artifacts/step3-enemy/${name}`);
  report.assertions.screenshots={pass:report.screenshots.length===2,viewport:'812x375',count:report.screenshots.length,paths:report.screenshots};assert(report.assertions.screenshots.pass,'Required screenshots are missing');
  await browser.close();fs.writeFileSync(new URL('verification.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{if(server)try{process.kill(-server.pid,'SIGTERM');}catch{}}

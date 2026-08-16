import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { defaultAnims } from '../src/weapons/animations.js';

const port=4174,out=new URL('../artifacts/step1-anim/',import.meta.url);fs.mkdirSync(out,{recursive:true});
let server=null;
try{const response=await fetch(`http://127.0.0.1:${port}/`);if(!response.ok)throw new Error();}catch{server=spawn('npx',['vite','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe'],detached:true});}
const ready=server?new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Vite preview startup timed out')),15000),done=data=>{if(String(data).includes('Local:')){clearTimeout(timer);resolve();}};server.stdout.on('data',done);server.stderr.on('data',done);}):Promise.resolve();
const report={generatedAt:new Date().toISOString(),assertions:{},screenshots:[]};
const round=value=>+value.toFixed(8);

async function setup(page){
  await page.goto(`http://127.0.0.1:${port}/?verify&map=base`,{waitUntil:'networkidle'});
  await page.evaluate(()=>{const g=window.__verifyGame;g.start({mapId:'base'});g.state='menu';g.waves.running=false;g.enemies.clear();});
}

async function capture(page,size,label,prepare){
  await page.setViewportSize(size);
  await page.evaluate(prepare);
  const name=`${label}-${size.width}x${size.height}.png`,path=new URL(name,out).pathname;
  await page.screenshot({path});report.screenshots.push(`artifacts/step1-anim/${name}`);
}

try{
  await ready;
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});await setup(page);
  const recoil=await page.evaluate(()=>{const w=window.__verifyGame.weapon;w.fireTime=.05;w.update(0,false);const peak=w.group.position.z-w.restPosition.z;w.fireTime=.6;w.update(0,false);const recovered=w.group.position.z-w.restPosition.z;return{peak,recovered};});
  report.assertions.recoil={pass:recoil.peak<0&&Math.abs(recoil.recovered)<1e-4,offsetAt50ms:round(recoil.peak),recoveryError:round(Math.abs(recoil.recovered))};
  assert(report.assertions.recoil.pass,'Recoil did not move backward and recover');

  const reload=await page.evaluate(()=>{const g=window.__verifyGame,w=g.weapon,stages=[];g.bus.on('weapon:reloadStage',e=>{if(e.weapon===w)stages.push(e.stage);});w.ammo=0;w.reload();for(let i=0;i<80&&w.reloading>0;i++)w.update(.025,false);return{stages,ammo:w.ammo};});
  report.assertions.reloadStages={pass:reload.stages.join(',')==='remove,insert,chamber',stages:reload.stages,finalAmmo:reload.ammo};
  assert(report.assertions.reloadStages.pass,'Reload stages are out of order');

  const switching=await page.evaluate(()=>{const g=window.__verifyGame;g.state='menu';const old=g.weapon;g.switchWeapon((g.inventory.indexOf(old)+1)%g.inventory.length);for(let i=0;i<16;i++)g.inventory.forEach(w=>{if(w.switchAnimation)w.update(.025,false);});const w=g.weapon;return{positionError:w.group.position.distanceTo(w.restPosition),rotationError:Math.max(Math.abs(w.group.rotation.x-w.restRotation.x),Math.abs(w.group.rotation.y-w.restRotation.y),Math.abs(w.group.rotation.z-w.restRotation.z)),scaleError:w.group.scale.distanceTo(w.restScale),locked:w.switchLocked};});
  const switchError=Math.max(switching.positionError,switching.rotationError,switching.scaleError);
  report.assertions.weaponSwitch={pass:switchError<1e-4&&!switching.locked,error:round(switchError),elapsedSeconds:.4,locked:switching.locked};
  assert(report.assertions.weaponSwitch.pass,'Switched weapon did not return to rest');

  const sway=await page.evaluate(()=>{const g=window.__verifyGame,w=g.weapon;let peak=0;for(let i=0;i<5;i++){g.engine.camera.rotation.y+=.15;w.update(1/60,false);peak=Math.max(peak,Math.abs(w.group.position.x-w.restPosition.x));}for(let i=0;i<90;i++)w.update(1/60,false);return{peak,recovered:Math.abs(w.group.position.x-w.restPosition.x)};});
  report.assertions.moveSway={pass:Math.abs(sway.peak-.03)<1e-6&&sway.recovered<1e-4,peakOffsetX:round(sway.peak),expectedPeak:.03,recoveryError:round(sway.recovered),decaySeconds:1.5};
  assert(report.assertions.moveSway.pass,'Move sway did not appear and decay');

  const idle=defaultAnims().config.idle;
  report.assertions.idle={pass:idle.amplitude===.002&&idle.frequency===.008,...idle};
  assert(report.assertions.idle.pass,'Default idle configuration changed unexpectedly');

  for(const size of [{width:812,height:375},{width:1280,height:720}]){
    await capture(page,size,'idle',()=>{const g=window.__verifyGame,w=g.weapon;g.state='menu';w.switchAnimation=null;w.switchLocked=false;w.reloading=0;w.fireTime=99;w.update(0,false);});
    await capture(page,size,'fire',()=>{const w=window.__verifyGame.weapon;w.fireTime=.05;w.update(0,false);});
    await capture(page,size,'reload',()=>{const w=window.__verifyGame.weapon;w.reloading=w.reloadDuration=1;w.update(.5,false);});
    await capture(page,size,'switch',()=>{const w=window.__verifyGame.weapon;w.beginSwitch('in');w.update(.1,false);});
  }
  await browser.close();fs.writeFileSync(new URL('verification.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{if(server)try{process.kill(-server.pid,'SIGTERM');}catch{}}

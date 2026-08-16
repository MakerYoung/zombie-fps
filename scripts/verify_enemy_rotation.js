import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port=4174,out=new URL('../artifacts/step3-fix/',import.meta.url);fs.mkdirSync(out,{recursive:true});
const report={generatedAt:new Date().toISOString(),viewport:'812x375',assertions:{},screenshot:'artifacts/step3-fix/flip-fix.png'};
let server=null;
try{const response=await fetch(`http://127.0.0.1:${port}/`);if(!response.ok)throw new Error();}catch{server=spawn('npx',['vite','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe'],detached:true});}
const ready=server?new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Vite preview startup timed out')),15000),done=data=>{if(String(data).includes('Local:')){clearTimeout(timer);resolve();}};server.stdout.on('data',done);server.stderr.on('data',done);}):Promise.resolve();
const round=value=>+value.toFixed(6);

async function setup(page){
  await page.goto(`http://127.0.0.1:${port}/?verify&map=base`,{waitUntil:'networkidle'});
  await page.evaluate(()=>{const g=window.__verifyGame;g.start({mapId:'base'});g.state='paused';g.waves.running=false;g.enemies.clear();g.enemyProjectiles.clear();g.weapon.group.visible=false;g.engine.camera.position.set(0,1.72,9);g.engine.camera.lookAt(0,1.1,12);g.engine.camera.updateMatrixWorld(true);});
}

async function runScenario(page,name,spawns,frames,captureFrame=0){
  await page.evaluate(({spawns})=>{const g=window.__verifyGame;g.enemies.clear();window.__rotationEnemies=spawns.map(pos=>g.enemies.spawn('assault',1,pos));},{spawns});
  let minUpY=Infinity,minPartY=Infinity;
  for(let frame=1;frame<=frames;frame++){
    const sample=await page.evaluate(()=>{const g=window.__verifyGame;g.engine.scene.updateMatrixWorld(true);g.enemies.update(1/60,g.engine.camera,g.map);g.engine.scene.updateMatrixWorld(true);let minUpY=Infinity,minPartY=Infinity;for(const enemy of window.__rotationEnemies){const m=enemy.model.group.matrixWorld.elements;minUpY=Math.min(minUpY,m[5]);enemy.model.group.traverse(object=>{if(object.isMesh)minPartY=Math.min(minPartY,object.matrixWorld.elements[13]);});}return{minUpY,minPartY};});
    minUpY=Math.min(minUpY,sample.minUpY);minPartY=Math.min(minPartY,sample.minPartY);
    // 局部上方向(0,1,0)映射到世界 y 必须为正:模型未上下翻转
    assert(sample.minUpY>0,`${name} frame ${frame}: model flipped (upY=${sample.minUpY})`);
    // 所有部件不得穿地
    assert(sample.minPartY>=-.05,`${name} frame ${frame}: mesh y reached ${sample.minPartY}`);
    if(frame===captureFrame)await page.screenshot({path:new URL('flip-fix.png',out).pathname});
  }
  return{pass:true,frames,enemyCount:spawns.length,minUpWorldY:round(minUpY),minPartWorldY:round(minPartY)};
}

try{
  await ready;
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:812,height:375},screen:{width:812,height:375},deviceScaleFactor:1});
  const page=await context.newPage();await setup(page);
  report.assertions.negativeZ=await runScenario(page,'negativeZ',[{x:0,z:12}],120,60);
  report.assertions.positiveZ=await runScenario(page,'positiveZ',[{x:0,z:-12}],60);
  report.assertions.fourDirections=await runScenario(page,'fourDirections',[{x:-12,z:9},{x:-12,z:10},{x:12,z:9},{x:12,z:10},{x:0,z:-12},{x:1,z:-12},{x:0,z:21},{x:1,z:21}],300);
  await browser.close();
  fs.writeFileSync(new URL('verification.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){report.error=String(error?.stack||error);fs.writeFileSync(new URL('verification.json',out),JSON.stringify(report,null,2));throw error;}
finally{if(server)try{process.kill(-server.pid,'SIGTERM');}catch{}}

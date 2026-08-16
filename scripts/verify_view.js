import fs from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import * as THREE from 'three';
import {Weapon} from '../src/player/Weapon.js';
import {WEAPONS} from '../src/weapons/weaponData.js';
import {EventBus} from '../src/core/EventBus.js';
import {PlayerController} from '../src/player/PlayerController.js';
import {ScreenShake} from '../src/systems/ScreenShake.js';

const width=812,height=375,buttonIds=['fire','reload','switchWeapon','jump','menuBtn'];
const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const outputDir=new URL('../artifacts/weapon-verify/',import.meta.url);fs.mkdirSync(outputDir,{recursive:true});
function cssNumber(id,name){const rule=css.match(new RegExp(`#${id}\\s*\\{([^}]*)\\}`))?.[1],v=rule?.match(new RegExp(`${name}\\s*:\\s*([\\d.]+)px`))?.[1];if(v===undefined)throw new Error(`无法读取 #${id} ${name}`);return Number(v);}
function buttonRect(id){const w=cssNumber(id,'width'),h=cssNumber(id,'height'),rule=css.match(new RegExp(`#${id}\\s*\\{([^}]*)\\}`))?.[1]||'';const left=rule.includes('right:')?width-cssNumber(id,'right')-w:cssNumber(id,'left'),top=rule.includes('bottom:')?height-cssNumber(id,'bottom')-h:cssNumber(id,'top');return {left,top,right:left+w,bottom:top+h};}
function overlap(a,b){const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));return w*h/Math.max(1,(a.right-a.left)*(a.bottom-a.top));}
function projection(data){
  const camera=new THREE.PerspectiveCamera(75,width/height,.08,220),weapon=new Weapon(camera,{emit(){}},{get(){return 1;}},data);camera.updateMatrixWorld(true);const points=[];
  weapon.group.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(o.matrixWorld).project(camera);if(Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&Math.abs(p.z)<=1)points.push({x:(p.x*.5+.5)*width,y:(-.5*p.y+.5)*height});}});
  const box={left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};box.cx=(box.left+box.right)/2;box.cy=(box.top+box.bottom)/2;
  // 枪口轴平行相机 -Z，投影延长线的消失点即屏幕中心。
  const muzzle=weapon.muzzle.getWorldPosition(new THREE.Vector3()).project(camera);box.muzzle=[(muzzle.x*.5+.5)*width,(-muzzle.y*.5+.5)*height];return box;
}
function pil(image,base,box){const py=`from PIL import Image,ImageChops,ImageStat\nimport json,sys\na=Image.open(sys.argv[1]).convert('RGB');b=Image.open(sys.argv[2]).convert('RGB');d=ImageChops.difference(a,b);box=tuple(map(int,map(float,sys.argv[3:7])));r=d.crop(box);s=ImageStat.Stat(r);mean=sum(s.mean)/3;peak=max(v[1] for v in r.getextrema());print(json.dumps({'meanDiff':round(mean,2),'peakDiff':peak,'visible':mean>2 and peak>35}))`;
  const r=spawnSync('python3',['-c',py,image,base,String(box.left),String(box.top),String(box.right),String(box.bottom)],{encoding:'utf8'});if(r.status)throw new Error(r.stderr);return JSON.parse(r.stdout);
}
let failed=false;const boxes={};
for(const [id,data] of Object.entries(WEAPONS)){const b=projection(data);boxes[id]=b;const cx=b.cx/width,cy=b.cy/height,os=buttonIds.map(x=>[x,overlap(b,buttonRect(x))]);const ok=cx>=.55&&cx<=.65&&cy>=.63&&cy<=.72&&os.every(x=>x[1]<.15);console.log(`${id}: 投影中心=${(cx*100).toFixed(1)}%,${(cy*100).toFixed(1)}% 枪口=${b.muzzle.map(x=>x.toFixed(1)).join(',')} 重叠=${os.map(x=>`${x[0]} ${(x[1]*100).toFixed(1)}%`).join(' / ')} ${ok?'PASS':'FAIL'}`);failed||=!ok;}

const port=41729,server=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Vite 启动超时')),15000),ready=d=>{if(String(d).includes('Local:')){clearTimeout(timer);resolve();}};server.stdout.on('data',ready);server.stderr.on('data',ready);});
  const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width,height},screen:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await context.newPage();await page.goto(`http://127.0.0.1:${port}?verify=1`,{waitUntil:'networkidle'});await page.locator('#start').click();await page.waitForTimeout(600);
  for(const id of Object.keys(WEAPONS)){await page.evaluate(id=>window.__verifyGame.switchWeapon(id),id);await page.waitForTimeout(180);const image=new URL(`${id}_812x375.png`,outputDir).pathname,base=new URL(`${id}_baseline.png`,outputDir).pathname;await page.screenshot({path:image});await page.evaluate(()=>window.__verifyGame.weapon.group.visible=false);await page.screenshot({path:base});await page.evaluate(()=>window.__verifyGame.weapon.group.visible=true);const result=pil(image,base,boxes[id]);console.log(`${id}: PIL 差分 mean=${result.meanDiff} peak=${result.peakDiff} 可见=${result.visible?'PASS':'FAIL'} 截图=${image}`);failed||=!result.visible;}
  await browser.close();
}finally{if(process.platform==='win32')server.kill('SIGTERM');else try{process.kill(-server.pid,'SIGTERM');}catch{}}

// 以固定 25ms 步长模拟开火和 20 帧恢复，验证 pitch 与独立 fire shake 的运行态增量。
globalThis.localStorage={getItem(){return null;}};const bus=new EventBus(),camera=new THREE.PerspectiveCamera(),input={state:{move:{x:0,y:0},sprint:false},consumeLook(){return{x:0,y:0}},consume(){return false}},map={collides(){return false}},stats={get(){return 1}},player=new PlayerController(camera,input,map,stats,bus),shake=new ScreenShake(camera,bus);bus.emit('weapon:shoot',{data:WEAPONS.shotgun});player.update(.025,true);shake.update(.025);const firstPitch=camera.rotation.x,shakeDelta=shake.lastPosition.length();for(let i=1;i<20;i++){player.update(.025,true);shake.update(.025);}const finalPitch=player.pitchOffset,recoilOk=firstPitch>0&&finalPitch<.0002,shakeOk=shakeDelta>0;console.log(`射击模拟: 首帧pitch=${firstPitch.toFixed(6)}rad, 0.5s后=${finalPitch.toFixed(6)}rad, shake位移=${shakeDelta.toExponential(3)} ${recoilOk&&shakeOk?'PASS':'FAIL'}`);failed||=!recoilOk||!shakeOk;
if(failed)throw new Error('枪械视觉或射击反馈验收失败');console.log('三枪视觉、差分、后坐力恢复与开火震动验收全部通过。');

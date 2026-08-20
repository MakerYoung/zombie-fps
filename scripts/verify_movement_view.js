import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const out=new URL('../artifacts/movement/',import.meta.url);fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:812,height:375},isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto('http://127.0.0.1:5173/?verify=1',{waitUntil:'networkidle'});
  await page.evaluate(()=>{const g=window.__verifyGame;g.start({mapId:'base'});g.enemies.clear();g.waves.running=false;g.state='playing';});
  const ids=['fire','reload','switchWeapon','jump','sprint','crouch'];
  const boxes=await page.evaluate(ids=>Object.fromEntries(ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x,y:r.y,w:r.width,h:r.height}];})),ids);
  for(const [id,r] of Object.entries(boxes))assert(r.x>=0&&r.y>=0&&r.x+r.w<=812&&r.y+r.h<=375,`${id} 超出横屏视口`);
  const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)assert(!overlaps(boxes[ids[i]],boxes[ids[j]]),`${ids[i]} 与 ${ids[j]} 重叠`);
  await page.screenshot({path:fileURLToPath(new URL('mobile-idle-812x375.png',out))});
  const sprint=page.locator('#sprint');await sprint.dispatchEvent('pointerdown',{pointerId:7,pointerType:'touch',clientX:boxes.sprint.x+20,clientY:boxes.sprint.y+20});
  const before=await page.evaluate(()=>{const g=window.__verifyGame;g.input.state.move.y=1;g.input.state.fire=true;return g.weapon.ammo;});await page.waitForTimeout(260);
  const sprintState=await page.evaluate(before=>{const g=window.__verifyGame;return{before,after:g.weapon.ammo,sprinting:g.player.sprinting,blend:g.weapon.sprintBlend,rotation:g.weapon.group.rotation.toArray(),rest:g.weapon.restRotation.toArray()};},before);
  assert(sprintState.sprinting&&sprintState.blend>.8,'移动端奔跑状态或枪械姿态未生效');assert.equal(sprintState.after,sprintState.before,'奔跑期间仍消耗弹药');
  await page.screenshot({path:fileURLToPath(new URL('mobile-sprint-812x375.png',out))});
  await sprint.dispatchEvent('pointerup',{pointerId:7,pointerType:'touch'});await page.evaluate(()=>{const g=window.__verifyGame;g.input.state.move.y=0;g.input.state.fire=false;});
  await page.locator('#crouch').tap();await page.waitForTimeout(240);const crouch=await page.evaluate(()=>({active:window.__verifyGame.player.crouching,height:window.__verifyGame.engine.camera.position.y}));
  assert(crouch.active&&crouch.height<1.25,'移动端蹲下交互未生效');await page.screenshot({path:fileURLToPath(new URL('mobile-crouch-812x375.png',out))});
  console.log(JSON.stringify({boxes,sprint:sprintState,crouch,screenshots:['mobile-idle-812x375.png','mobile-sprint-812x375.png','mobile-crouch-812x375.png']},null,2));
}finally{await browser.close();}

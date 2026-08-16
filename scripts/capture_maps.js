import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const output='artifacts/step4-map/after';await mkdir(output,{recursive:true});await mkdir('artifacts/step4-map',{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
for(const id of ['base','transportShip','testmap']){
  await page.goto(`http://127.0.0.1:4174/?verify=1&map=${id}`,{waitUntil:'networkidle'});
  await page.evaluate(mapId=>{const g=window.__verifyGame;g.start({mapId});g.state='paused';document.querySelectorAll('.show').forEach(e=>e.classList.remove('show'));g.inventory.forEach(w=>w.group.visible=false);g.engine.camera.position.set(g.map.playerSpawn.x,g.map.playerSpawn.y,g.map.playerSpawn.z);const captureYaw=g.map.playerSpawn.yaw+(mapId==='transportShip'?-.42:0);g.engine.camera.rotation.set(0,captureYaw,0);g.engine.render();},id);
  await page.screenshot({path:`${output}/${id}-after-player.png`});
  await page.evaluate(()=>{const g=window.__verifyGame;g.engine.camera.position.set(0,g.map.size*.78,0);g.engine.camera.rotation.set(-Math.PI/2,0,0);g.engine.camera.fov=62;g.engine.camera.updateProjectionMatrix();g.engine.render();});
  await page.screenshot({path:`${output}/${id}-after-top.png`});
  if(id==='testmap')await page.screenshot({path:'artifacts/step4-map/testmap.png'});
}
await browser.close();console.log('已生成注册表内三张地图的玩家视角与俯视截图');

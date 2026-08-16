const SPAWN_RADIUS=.45;

function point(map,x,z){return {x,y:0,z};}

export function isSafeSpawn(map,p){
  const bx=map.boundsX||map.bounds,bz=map.boundsZ||map.bounds;
  return Number.isFinite(p?.x)&&Number.isFinite(p?.z)&&Math.abs(p.x)<=bx-1.5&&Math.abs(p.z)<=bz-1.5&&!map.collides(point(map,p.x,p.z),SPAWN_RADIUS);
}

// 地图建成后一次性扫描各出生区，运行时只从已验证的点中抽取。
export function buildSafeSpawns(map){
  map.safeSpawnsByRegion=map.enemySpawns.map((origin,spawnIndex)=>{
    const points=[];
    for(let dx=-3;dx<=3+.001;dx+=.8){
      for(let dz=-3;dz<=3+.001;dz+=.8){
        const candidate={x:Number((origin.x+dx).toFixed(3)),z:Number((origin.z+dz).toFixed(3)),spawnIndex};
        if(isSafeSpawn(map,candidate))points.push(candidate);
      }
    }
    return points;
  });
  map.safeSpawns=map.safeSpawnsByRegion.flat();
}

function playerFallback(map){
  const center=map.playerSpawn;
  // 由近到远扫描玩家出生点四周 4 单位；极端情况下仍返回出生点，不抛异常。
  for(let radius=0;radius<=4+.001;radius+=.8){
    for(let dx=-radius;dx<=radius+.001;dx+=.8){
      for(const dz of [-radius,radius]){
        const candidate={x:center.x+dx,z:center.z+dz};
        if(isSafeSpawn(map,candidate))return candidate;
      }
    }
    for(let dz=-radius+.8;dz<radius-.001;dz+=.8){
      for(const dx of [-radius,radius]){
        const candidate={x:center.x+dx,z:center.z+dz};
        if(isSafeSpawn(map,candidate))return candidate;
      }
    }
  }
  return {x:center.x,z:center.z};
}

export function randomSafeSpawn(map){
  const spawnIndex=Math.floor(Math.random()*map.enemySpawns.length);
  const origin=map.enemySpawns[spawnIndex];
  const region=map.safeSpawnsByRegion?.[spawnIndex]||map.safeSpawns||[];
  // 防御性复验最多 15 次，兼容运行时地图碰撞体被动态修改的情况。
  for(let attempt=0;attempt<15&&region.length;attempt++){
    const candidate=region[Math.floor(Math.random()*region.length)];
    if(isSafeSpawn(map,candidate))return {x:candidate.x,z:candidate.z};
  }
  if(isSafeSpawn(map,origin))return {x:origin.x,z:origin.z};
  return playerFallback(map);
}

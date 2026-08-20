const DIRECTIONS=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
const key=(x,z)=>`${x},${z}`;

class MinHeap{
  constructor(){this.items=[];}
  push(node){const a=this.items;a.push(node);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].f<=node.f)break;a[i]=a[p];i=p;}a[i]=node;}
  pop(){const a=this.items,root=a[0],last=a.pop();if(a.length&&last){let i=0;a[0]=last;while(true){let l=i*2+1,r=l+1,b=i;if(l<a.length&&a[l].f<a[b].f)b=l;if(r<a.length&&a[r].f<a[b].f)b=r;if(b===i)break;[a[i],a[b]]=[a[b],a[i]];i=b;}}return root;}
  get length(){return this.items.length;}
}

export class NavGrid{
  constructor(map,{cellSize=1,clearance=.52}={}){
    this.map=map;this.cellSize=cellSize;this.clearance=clearance;this.minX=-map.boundsX+1;this.minZ=-map.boundsZ+1;
    this.cols=Math.max(1,Math.floor((map.boundsX*2-2)/cellSize)+1);this.rows=Math.max(1,Math.floor((map.boundsZ*2-2)/cellSize)+1);this.walkable=new Uint8Array(this.cols*this.rows);
    for(let z=0;z<this.rows;z++)for(let x=0;x<this.cols;x++){const p=this.toWorld(x,z);this.walkable[this.index(x,z)]=map.collides({x:p.x,y:0,z:p.z},clearance)?0:1;}
  }
  index(x,z){return z*this.cols+x;}
  valid(x,z){return x>=0&&z>=0&&x<this.cols&&z<this.rows;}
  open(x,z){return this.valid(x,z)&&this.walkable[this.index(x,z)]===1;}
  toCell(point){return{x:Math.round((point.x-this.minX)/this.cellSize),z:Math.round((point.z-this.minZ)/this.cellSize)};}
  toWorld(x,z){return{x:this.minX+x*this.cellSize,z:this.minZ+z*this.cellSize};}
  nearestOpen(point,maxRadius=8,radius=this.clearance){
    const origin=this.toCell(point),reachable=(x,z)=>this.open(x,z)&&this.segmentClear(point,this.toWorld(x,z),radius);if(reachable(origin.x,origin.z))return origin;
    for(let radius=1;radius<=maxRadius;radius++)for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;const x=origin.x+dx,z=origin.z+dz;if(reachable(x,z))return{x,z};
    }return null;
  }
  segmentClear(a,b,radius){
    const distance=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(distance/(this.cellSize*.45)));
    for(let i=1;i<=steps;i++){const t=i/steps;if(this.map.collides({x:a.x+(b.x-a.x)*t,y:0,z:a.z+(b.z-a.z)*t},radius))return false;}return true;
  }
  simplify(points,start,radius){
    if(points.length<2)return points;const out=[];let anchor=start,i=0;
    while(i<points.length){let furthest=i;for(let j=i;j<points.length;j++){if(!this.segmentClear(anchor,points[j],radius))break;furthest=j;}out.push(points[furthest]);anchor=points[furthest];i=furthest+1;}return out;
  }
  findPath(startPoint,endPoint,radius=.42){
    const start=this.nearestOpen(startPoint,8,radius),goal=this.nearestOpen(endPoint,8,radius);if(!start||!goal)return[];if(start.x===goal.x&&start.z===goal.z)return this.segmentClear(startPoint,endPoint,radius)?[{x:endPoint.x,z:endPoint.z}]:[];
    const open=new MinHeap(),g=new Map(),parents=new Map(),closed=new Set(),startKey=key(start.x,start.z);g.set(startKey,0);open.push({...start,f:0});
    while(open.length){const current=open.pop(),currentKey=key(current.x,current.z);if(closed.has(currentKey))continue;if(current.x===goal.x&&current.z===goal.z){const cells=[];let cursor=currentKey;while(cursor!==startKey){const [x,z]=cursor.split(',').map(Number);cells.push(this.toWorld(x,z));cursor=parents.get(cursor);if(!cursor)return[];}cells.push(this.toWorld(start.x,start.z));cells.reverse();const path=this.simplify(cells,startPoint,radius),last=path.at(-1)||startPoint;if(this.segmentClear(last,endPoint,radius)){if(path.length)path[path.length-1]={x:endPoint.x,z:endPoint.z};else path.push({x:endPoint.x,z:endPoint.z});}return path;}
      closed.add(currentKey);const base=g.get(currentKey);
      for(const [dx,dz,cost] of DIRECTIONS){const x=current.x+dx,z=current.z+dz;if(!this.open(x,z))continue;if(dx&&dz&&(!this.open(current.x+dx,current.z)||!this.open(current.x,current.z+dz)))continue;const nextKey=key(x,z);if(closed.has(nextKey))continue;const score=base+cost;if(score>=(g.get(nextKey)??Infinity))continue;g.set(nextKey,score);parents.set(nextKey,currentKey);const h=Math.hypot(goal.x-x,goal.z-z);open.push({x,z,f:score+h});}
    }return[];
  }
}

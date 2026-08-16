export class Pool {
  constructor(factory,size=20){ this.factory=factory; this.free=[]; this.active=[]; for(let i=0;i<size;i++)this.free.push(factory()); }
  acquire(){ const item=this.free.pop()||this.factory(); this.active.push(item); return item; }
  release(item){ const i=this.active.indexOf(item); if(i>=0)this.active.splice(i,1); item.object3D&&(item.object3D.visible=false); this.free.push(item); }
  clear(){ [...this.active].forEach(x=>this.release(x)); }
}

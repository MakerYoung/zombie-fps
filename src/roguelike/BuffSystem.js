import { BUFF_POOL } from './buffPool.js';
export class BuffSystem {
  constructor(bus,stats,health){this.bus=bus;this.stats=stats;this.health=health;this.stacks=new Map();this.unsubs=new Map();}
  context(){return{bus:this.bus,stats:this.stats,health:this.health,listen:(id,event,fn)=>{this.unsubs.get(id)?.();this.unsubs.set(id,this.bus.on(event,fn));}};}
  choices(){const eligible=BUFF_POOL.filter(b=>!b.negative),out=[];while(out.length<3){const b=eligible[Math.floor(Math.random()*eligible.length)];if(!out.includes(b))out.push(b);}return out;}
  apply(buff){const stack=(this.stacks.get(buff.id)||0)+1;this.stacks.set(buff.id,stack);buff.apply(this.context(),stack); // 配对的代价词条自动随主词条生效
    const penalties={glass:'glasshp',berserk:'smallmag',heavy:'slow',tank:'tankslow',supermag:'slowreload',runner:'runnerhp',precision:'precisioncrit',storm:'stormmag'};if(penalties[buff.id]){const p=BUFF_POOL.find(x=>x.id===penalties[buff.id]);p.apply(this.context(),stack);}this.bus.emit('buff:applied',{buff,stack});}
  reset(){this.stacks.clear();this.unsubs.forEach(fn=>fn());this.unsubs.clear();}
}

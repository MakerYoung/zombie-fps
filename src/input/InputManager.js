import { PCInput } from './PCInput.js'; import { TouchInput } from './TouchInput.js';
export class InputManager {
  constructor(element,ui){ this.state={move:{x:0,y:0},look:{x:0,y:0},fire:false,reload:false,jump:false,aim:false}; this.touch=matchMedia('(pointer:coarse)').matches; this.adapter=this.touch?new TouchInput(element,this.state,ui):new PCInput(element,this.state); }
  consumeLook(){ const v={...this.state.look}; this.state.look.x=this.state.look.y=0; return v; }
  consume(name){ const v=this.state[name]; this.state[name]=false; return v; }
  reset(){ this.state.fire=false; this.state.reload=false; this.state.jump=false; this.state.move={x:0,y:0}; this.state.look={x:0,y:0}; }
}

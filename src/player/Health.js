export class Health {
  constructor(stats,bus){this.stats=stats;this.bus=bus;this.value=100;this.armor=0;}
  reset(){this.value=this.stats.get('maxHealth');this.armor=this.stats.get('armor');}
  damage(amount,source='僵尸'){const absorbed=Math.min(this.armor,amount*.55);this.armor-=absorbed;this.value=Math.max(0,this.value-amount+absorbed);this.bus.emit('player:damaged',{amount,health:this.value,max:this.stats.get('maxHealth')});if(this.value<=0)this.bus.emit('player:died',{source});}
  heal(amount){this.value=Math.min(this.stats.get('maxHealth'),this.value+amount);this.bus.emit('player:health',{health:this.value,max:this.stats.get('maxHealth')});}
}

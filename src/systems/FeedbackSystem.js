export class FeedbackSystem {
  constructor(bus,ui,loop){this.bus=bus;this.ui=ui;this.loop=loop;this.streak=0;this.lastKill=0;
    bus.on('shot:hit',e=>{ui.hitMarker(e.headshot?'head':'hit');ui.damageNumber(e.damage,e.point,e.headshot);loop.slowMotion(.72,28);});
    bus.on('enemy:killed',()=>{setTimeout(()=>ui.hitMarker('kill'),0);const now=performance.now();this.streak=now-this.lastKill<1200?this.streak+1:1;this.lastKill=now;if(this.streak>=3)loop.slowMotion(.45,85);});
    bus.on('player:damaged',()=>ui.damageFlash());
  }
}

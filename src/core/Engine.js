import * as THREE from 'three';
export class Engine {
  constructor(container,quality='medium'){
    // 明快未来天空：仅保留极淡的远距线性雾，不遮挡战斗视野。
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color(0x8dcef2); this.scene.fog=new THREE.Fog(0xd9e9ee,150,215);
    this.camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.08,220); this.camera.rotation.order='YXZ';
    // 枪械和手臂挂在相机下；相机必须加入场景图，其子节点才会被 WebGLRenderer 绘制。
    this.scene.add(this.camera);
    this.renderer=new THREE.WebGLRenderer({antialias:quality!=='low',powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?2:1.35)); this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.shadowMap.enabled=quality==='high'; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.18;
    container.appendChild(this.renderer.domElement); addEventListener('resize',()=>this.resize());
    this.addSky();
    this.scene.add(new THREE.HemisphereLight(0xf2fbff,0x718894,2.75));
    // 冷白天光配暖橙地平线边光，保持阴影清爽并凸显蓝橙饰条。
    const sun=new THREE.DirectionalLight(0xfff4e8,3.35); sun.position.set(-35,55,-30); sun.castShadow=quality==='high'; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-70; sun.shadow.camera.right=70; sun.shadow.camera.top=70; sun.shadow.camera.bottom=-70; sun.shadow.bias=-.00015;this.scene.add(sun);
    const rim=new THREE.DirectionalLight(0xffb36d,1.45);rim.position.set(45,16,28);this.scene.add(rim);
  }
  addSky(){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d');
    const gradient=c.createLinearGradient(0,0,0,512);gradient.addColorStop(0,'#4aa8e8');gradient.addColorStop(.58,'#a9daf2');gradient.addColorStop(1,'#ffe8c8');c.fillStyle=gradient;c.fillRect(0,0,1024,512);
    // 稀疏柔云由 Canvas 程序化生成，不依赖外部贴图。
    c.filter='blur(10px)';for(let i=0;i<18;i++){const x=Math.random()*1024,y=120+Math.random()*210,w=55+Math.random()*130;c.fillStyle=`rgba(255,255,255,${.12+Math.random()*.22})`;for(let j=0;j<4;j++){c.beginPath();c.ellipse(x+j*w*.18,y+Math.sin(j)*12,w*(.32+Math.random()*.22),18+Math.random()*18,0,0,Math.PI*2);c.fill();}}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sky=new THREE.Mesh(new THREE.SphereGeometry(195,32,18),new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide,fog:false,depthWrite:false}));sky.name='futureSky';this.scene.add(sky);
  }
  resize(){ this.camera.aspect=innerWidth/innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth,innerHeight); }
  render(){ this.renderer.render(this.scene,this.camera); }
}

import * as THREE from 'three';
// 统一资源入口；当前版本全部程序化生成，后续本地贴图可经此处缓存加载。
export class ResourceLoader { constructor(){this.manager=new THREE.LoadingManager();this.textures=new Map();} texture(url){if(!this.textures.has(url))this.textures.set(url,new THREE.TextureLoader(this.manager).load(url));return this.textures.get(url);} }

import './style.css';import { UI } from './ui/UI.js';import { Game } from './core/Game.js';
const root=document.querySelector('#game'),ui=new UI(root),game=new Game(root,ui),touch=matchMedia('(pointer:coarse)').matches;
// 仅供自动横屏验收临时隐藏枪模并生成同帧基线，不暴露在正常游戏页面。
if(new URLSearchParams(location.search).has('verify'))window.__verifyGame=game;
const toggleFullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen?.();else await document.documentElement.requestFullscreen?.();}catch(error){console.warn('浏览器拒绝全屏请求',error);}};
ui.onStart(async selection=>{// 无头横屏验收通过查询参数跳过浏览器不稳定的全屏权限流程。
if(touch&&!document.fullscreenElement&&!new URLSearchParams(location.search).has('verify'))await toggleFullscreen();game.start(selection);});ui.onFullscreen(toggleFullscreen);ui.onHome(()=>game.home());ui.onResume(()=>game.togglePause());ui.onPause(()=>game.togglePause());document.addEventListener('fullscreenchange',()=>{ui.fullscreenChanged(Boolean(document.fullscreenElement));game.engine.resize();});addEventListener('keydown',e=>{if(e.code==='Escape')setTimeout(()=>game.togglePause(),0);});

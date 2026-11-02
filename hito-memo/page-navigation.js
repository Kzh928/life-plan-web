/* 図の操作とページ移動を分け，固定タブと上部への退避経路を残す． */
'use strict';
let pageNavigationTicket=0;
function pageTopControl(){return '<button type="button" class="page-top-button" data-action="page-top" aria-label="相関図の大画面を閉じてページ上部へ戻る">ページ上部へ</button>';}
function syncPageNavigation(){
  if(typeof window==='undefined')return;
  const tabs=document.querySelector('.app-tabs');
  if(tabs)document.documentElement.style.setProperty('--app-tabs-height',Math.ceil(tabs.getBoundingClientRect().height)+'px');
}
function scrollPageToGraph(){
  if(typeof window==='undefined')return;const ticket=++pageNavigationTicket;
  const move=()=>{
    if(ticket!==pageNavigationTicket||page!=='graph')return;
    const frame=document.querySelector('#graph-scroller');if(!frame||graphExpanded)return;
    syncPageNavigation();const tabs=document.querySelector('.app-tabs'),offset=(tabs?.getBoundingClientRect().height||72)+12;
    window.scrollTo({top:Math.max(0,window.scrollY+frame.getBoundingClientRect().top-offset),behavior:'auto'});
  };
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(move);else move();
}
function scrollPageToTop(){
  if(typeof window==='undefined')return;++pageNavigationTicket;
  if(typeof graphGesture!=='undefined')graphGesture=null;
  if(typeof graphDrag!=='undefined'&&graphDrag)void finishGraphDrag({pointerId:graphDrag.pointerId},true);
  if(typeof graphExpanded!=='undefined'&&graphExpanded){graphExpanded=false;render();}
  window.scrollTo({top:0,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
document.addEventListener('click',e=>{if(e.target.closest('[data-action]')?.dataset.action==='page-top')scrollPageToTop();});

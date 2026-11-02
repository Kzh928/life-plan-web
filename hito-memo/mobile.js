/* このコードは，スマホのキーボード・画面回転・確認画面に合わせて入力領域を調整します． */
'use strict';
function mobileGeometry(innerHeight, viewport){
  const zoomed=viewport&&Math.abs((viewport.scale||1)-1)>.05;
  const height=zoomed||!viewport?innerHeight:viewport.height;
  const top=zoomed||!viewport?0:viewport.offsetTop;
  return {top,height,bottom:Math.max(0,innerHeight-top-height),inputMax:Math.max(64,Math.min(160,Math.floor(height*.28)))};
}
if(typeof module!=='undefined')module.exports={mobileGeometry};
if(typeof window!=='undefined'){
  let queued=false,locked=false,savedScroll=0;
  const root=document.documentElement;
  window.syncMobileModal=function(open){
    if(open&&!locked){savedScroll=window.scrollY;document.body.style.position='fixed';document.body.style.top=-savedScroll+'px';document.body.style.width='100%';locked=true;}
    else if(!open&&locked){document.body.style.position='';document.body.style.top='';document.body.style.width='';locked=false;window.scrollTo(0,savedScroll);}
    document.body.classList.toggle('dialog-open',open);schedule();
  };
  function update(){
    queued=false;
    const g=mobileGeometry(window.innerHeight,window.visualViewport);
    root.style.setProperty('--visible-top',g.top+'px');root.style.setProperty('--visible-height',g.height+'px');root.style.setProperty('--keyboard-bottom',g.bottom+'px');root.style.setProperty('--input-max',g.inputMax+'px');
    const composer=document.querySelector('.composer');
    root.style.setProperty('--composer-height',(composer?.getBoundingClientRect().height||0)+'px');
    const active=document.activeElement,dialog=active?.closest?.('.modal');
    if(dialog&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)){
      const rect=active.getBoundingClientRect(),box=dialog.getBoundingClientRect();
      const bottom=Math.min(box.bottom-72,g.top+g.height-80),top=Math.max(box.top+12,g.top+12);
      if(rect.top<top)dialog.scrollTop+=rect.top-top;
      else if(rect.top>bottom-40)dialog.scrollTop+=rect.top-(bottom-40);
    }
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
  function resizeInput(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,mobileGeometry(window.innerHeight,window.visualViewport).inputMax)+'px';schedule();}
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
  let observedComposer=null;
  function refresh(){const composer=document.querySelector('.composer');if(composer!==observedComposer){observer?.disconnect();if(composer)observer?.observe(composer);observedComposer=composer;}const quick=document.querySelector('#quick');if(quick)resizeInput(quick);schedule();}
  document.addEventListener('input',e=>{if(e.target.id==='quick')resizeInput(e.target);});
  document.addEventListener('focusin',schedule);
  window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  document.addEventListener('DOMContentLoaded',()=>{refresh();new MutationObserver(refresh).observe(document.querySelector('#app'),{childList:true,subtree:true});});
}

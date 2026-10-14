// v3 only: report rendered size so phones scroll one page rather than two nested panes.
(()=>{
 if(window.parent===window)return;
 const totals=document.getElementById('monthTotals'),narrow=matchMedia('(max-width:700px)');if(totals){totals.open=!narrow.matches;narrow.addEventListener('change',()=>totals.open=!narrow.matches);}
 const kind=location.pathname.includes('/life/')?'life':'book';let queued=false,last='';
 function measure(){queued=false;if(window.innerWidth<200)return;const modal=!!document.querySelector('dialog[open]'),height=Math.ceil(document.body.getBoundingClientRect().bottom+window.scrollY)+4,signature=height+':'+modal;if(signature===last)return;last=signature;window.parent.postMessage({type:'v3-height',kind,height,modal},location.origin);}
 function schedule(){if(!queued){queued=true;requestAnimationFrame(measure);}}
 new ResizeObserver(schedule).observe(document.body);
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','class','hidden']});
 window.addEventListener('resize',schedule);window.addEventListener('load',schedule);schedule();
})();

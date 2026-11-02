/* 図の中だけで1本指の移動・2本指の拡大縮小を扱う．ページ全体の拡大率は変えない． */
'use strict';
let graphGesture=null;
function graphAreaTouches(touches,area){return Array.from(touches).filter(t=>!t.target||t.target.closest('#graph-scroller')===area||(t.identifier!==undefined&&graphGesture?.area===area&&graphGesture.ids.includes(t.identifier)));}
function graphTouchCenter(touches){return {x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2};}
function graphTouchDistance(touches){return Math.hypot(touches[1].clientX-touches[0].clientX,touches[1].clientY-touches[0].clientY);}
function startGraphGesture(area,touches,target){
  if(!touches.length){graphGesture=null;return;}
  if(touches.length>=2){
    if(graphDrag)void finishGraphDrag({pointerId:graphDrag.pointerId},true);
    const center=graphTouchCenter(touches),rect=area.getBoundingClientRect(),x=center.x-rect.left-area.clientLeft,y=center.y-rect.top-area.clientTop;
    graphGesture={mode:'pinch',area,ids:touches.map(t=>t.identifier),distance:Math.max(1,graphTouchDistance(touches)),zoom:graphZoom,anchor:{x:(area.scrollLeft+x)/graphZoom,y:(area.scrollTop+y)/graphZoom}};
    graphIgnoreClickUntil=Date.now()+700;
  }else graphGesture={mode:'pan',area,ids:touches.map(t=>t.identifier),x:touches[0].clientX,y:touches[0].clientY,left:area.scrollLeft,top:area.scrollTop,dragPerson:graphEditing&&!!target?.closest('.graph-person'),moved:false};
}
document.addEventListener('touchstart',e=>{const area=e.target.closest('#graph-scroller');if(!area)return;const touches=graphAreaTouches(e.touches,area);startGraphGesture(area,touches,e.target);if(touches.length>=2)e.preventDefault();},{passive:false});
document.addEventListener('touchmove',e=>{
  const gesture=graphGesture;if(!gesture)return;const area=gesture.area;if(area!==document.querySelector('#graph-scroller')){graphGesture=null;return;}
  const touches=graphAreaTouches(e.touches,area);if(touches.length>=2){
    if(gesture.mode!=='pinch'){startGraphGesture(area,touches,e.target);return;}
    e.preventDefault();const center=graphTouchCenter(touches),rect=area.getBoundingClientRect();
    setGraphZoom(gesture.zoom*graphTouchDistance(touches)/gesture.distance);
    area.scrollLeft=gesture.anchor.x*graphZoom-(center.x-rect.left-area.clientLeft);area.scrollTop=gesture.anchor.y*graphZoom-(center.y-rect.top-area.clientTop);
    graphIgnoreClickUntil=Date.now()+700;
  }else if(touches.length===1&&!gesture.dragPerson){
    e.preventDefault();const dx=touches[0].clientX-gesture.x,dy=touches[0].clientY-gesture.y;
    if(gesture.moved||Math.hypot(dx,dy)>6){gesture.moved=true;area.scrollLeft=gesture.left-dx;area.scrollTop=gesture.top-dy;graphIgnoreClickUntil=Date.now()+700;}
  }
},{passive:false});
document.addEventListener('touchend',e=>{if(!graphGesture)return;const old=graphGesture;if(old.mode==='pinch'||old.moved)graphIgnoreClickUntil=Date.now()+700;startGraphGesture(old.area,graphAreaTouches(e.touches,old.area),old.mode==='pinch'?null:e.target);});
document.addEventListener('touchcancel',()=>{graphGesture=null;graphIgnoreClickUntil=Date.now()+700;});

/* 画面上では約16pxを保ち，近い人物どうしが重なる場合だけ控えめにする． */
'use strict';
function graphNameBox(person){const length=[...person.name].length;return {width:Math.max(68,Math.min(132,Math.min(8,length)*14+24)),height:Math.max(48,Math.ceil(length/8)*18+14)};}
function graphNameScale(model,zoom){
  const nodes=model.nodes||[];let scale=16/(14*Math.max(.001,zoom));
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j],ab=graphNameBox(a.person),bb=graphNameBox(b.person),limit=Math.max(Math.abs(a.x-b.x)/((ab.width+bb.width)/2+12),Math.abs(a.y-b.y)/((ab.height+bb.height)/2+12));
    scale=Math.min(scale,Math.max(.05,limit));
  }
  for(const n of nodes){const box=graphNameBox(n.person);if(Number.isFinite(model.width)&&Number.isFinite(model.height))scale=Math.min(scale,Math.max(.05,2*Math.min(n.x-12,model.width-n.x-12)/box.width),Math.max(.05,2*Math.min(n.y-12,model.height-n.y-12)/box.height));}
  return scale;
}
function syncGraphNameLabels(){
  const svg=$('#relation-svg');if(!svg?.querySelectorAll)return;const model=graphDrag?.model||currentGraphModel(),scale=graphNameScale(model,graphZoom);
  for(const el of svg.querySelectorAll('.graph-node-label'))el.setAttribute('transform',`translate(${el.dataset.x} ${el.dataset.y}) scale(${scale})`);
}
function fitWholeGraph(){
  const area=$('#graph-scroller');if(!area)return;const model=currentGraphModel();let zoom=graphZoom,bounds;
  for(let i=0;i<8;i++){bounds=graphBounds(model,zoom);zoom=Math.max(.001,Math.min(1.25,(area.clientWidth-16)/bounds.width,(area.clientHeight-16)/bounds.height));}
  bounds=graphBounds(model,zoom);fitGraph(bounds);
}
if(typeof module!=='undefined')module.exports={graphNameBox,graphNameScale};

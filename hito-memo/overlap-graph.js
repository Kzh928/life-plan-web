/* 1人1ノード．複数所属の囲みは同じノードを共有し，配置に合わせて形を変える． */
'use strict';
function graphHull(points){
  const sorted=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y),cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const lower=[],upper=[];for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}for(const p of sorted.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function roundedGraphHull(points){
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2}),start=mid(points.at(-1),points[0]);
  return `M ${start.x} ${start.y} `+points.map((p,i)=>{const end=mid(p,points[(i+1)%points.length]);return `Q ${p.x} ${p.y} ${end.x} ${end.y}`;}).join(' ')+' Z';
}
function graphMemberships(p,groups){const found=new Set(communityIds(p,groups));for(const gid of found){const parent=groups.find(g=>g.id===gid)?.parentId;if(parent&&groups.some(g=>g.id===parent))found.add(parent);}return [...found];}
function graphCommunityDepth(g,groups){return communityPath(groups,g.id).split(' › ').length-1;}
function refreshOverlapRegions(model){
  for(const g of model.groups.slice().sort((a,b)=>b.depth-a.depth)){
    const members=model.nodes.filter(n=>n.memberships.includes(g.id)),pad=g.radius;
    const points=members.flatMap(n=>{const h=Math.max(24,Math.ceil([...n.person.name].length/8)*9+7);return [{x:n.x-72-pad,y:n.y-h-pad},{x:n.x+72+pad,y:n.y-h-pad},{x:n.x+72+pad,y:n.y+h+pad},{x:n.x-72-pad,y:n.y+h+pad}];});
    for(const child of model.groups.filter(c=>c.parentId===g.id&&c.hull)){for(const p of child.hull){const margin=pad+24;points.push({x:p.x-margin,y:p.y-margin},{x:p.x+margin,y:p.y-margin},{x:p.x+margin,y:p.y+margin},{x:p.x-margin,y:p.y+margin});}}
    g.hull=graphHull(points);g.path=roundedGraphHull(g.hull);g.bounds={left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};g.x=(g.bounds.left+g.bounds.right)/2;g.y=(g.bounds.top+g.bounds.bottom)/2;
  }
  model.width=Math.max(1000,...model.nodes.map(n=>n.x+160),...model.groups.map(g=>g.bounds.right+60));model.height=Math.max(800,...model.nodes.map(n=>n.y+160),...model.groups.map(g=>g.bounds.bottom+60));model.freeArea.width=model.width;model.freeArea.height=model.height;
  return model;
}
function overlapGraphModel(data,filter='all'){
  const groups=data.communities||[],matched=data.people.filter(p=>communityMatches(p,groups,filter)),ids=new Set(matched.map(p=>p.id));
  const people=data.people.filter(p=>ids.has(p.id)||(filter!=='unassigned'&&!communityIds(p,groups).length&&data.relations.some(r=>(r.a===p.id&&ids.has(r.b))||(r.b===p.id&&ids.has(r.a)))));
  const rank=p=>data.relations.filter(r=>r.a===p.id||r.b===p.id).length+communityIds(p,groups).length;
  const center=people.find(p=>p.id===data.graphCenterId)||people.find(p=>p.id==='oshi-kuzuha')||people.slice().sort((a,b)=>rank(b)-rank(a)||a.name.localeCompare(b.name,'ja'))[0];
  const cx=640,cy=540,nodes=[],buckets=new Map(),outside=[];
  for(const p of people){if(p===center)continue;const memberships=communityIds(p,groups);if(!memberships.length){outside.push(p);continue;}const key=memberships.slice().sort().join('|');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);}
  const add=(p,x,y)=>{const saved=data.graphSharedPositions?.[p.id];if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){x=Math.max(260,Math.min(20000,saved.x));y=Math.max(260,Math.min(20000,saved.y));}nodes.push({person:p,groupId:'shared',memberships:graphMemberships(p,groups),x,y});};
  if(center)add(center,cx,cy);
  const sets=[...buckets.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  sets.forEach(([key,rows],sector)=>{rows.sort((a,b)=>a.name.localeCompare(b.name,'ja'));const direction=sets.length===1?-Math.PI/2:Math.PI+sector*2*Math.PI/sets.length;let done=0,ring=0;
    while(done<rows.length){const radius=260+ring*200,span=sets.length===1?2*Math.PI:Math.min(1.6,2*Math.PI/sets.length*.75),capacity=Math.max(1,Math.floor(radius*span/190)),count=Math.min(capacity,rows.length-done);for(let i=0;i<count;i++){const angle=direction+(sets.length===1?i*2*Math.PI/count:(count===1?0:(i/(count-1)-.5)*span));add(rows[done+i],cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius);}done+=count;ring++;}
  });
  // Shift generated coordinates into the canvas together, so large layouts never clip.
  const unsaved=nodes.filter(n=>!data.graphSharedPositions?.[n.person.id]),shiftX=Math.max(0,260-Math.min(cx,...unsaved.map(n=>n.x))),shiftY=Math.max(0,260-Math.min(cy,...unsaved.map(n=>n.y)));for(const n of unsaved){n.x+=shiftX;n.y+=shiftY;}
  const baseY=Math.max(cy,...nodes.map(n=>n.y))+230;outside.forEach((p,i)=>add(p,260+(i%5)*190,baseY+Math.floor(i/5)*100));
  const shownGroups=groups.filter(g=>nodes.some(n=>n.memberships.includes(g.id))).map(g=>{const stored=data.graphOverlapPadding?.[g.id],radius=Number.isFinite(stored)?Math.max(24,Math.min(140,stored)):60;return {id:g.id,parentId:g.parentId,label:g.name,depth:graphCommunityDepth(g,groups),name:communityPath(groups,g.id),people:people.filter(p=>graphMemberships(p,groups).includes(g.id)),radius,minimumRadius:24,maximumRadius:140,defaultRadius:60};}).sort((a,b)=>a.depth-b.depth);
  const byId=new Map(nodes.map(n=>[n.person.id,n])),couples=new Set(),edges=[];
  for(const r of data.relations){const a=byId.get(r.a),b=byId.get(r.b);if(!a||!b||a===b)continue;if(graphRelationStyle(r.type).couple){const key=[r.a,r.b].sort().join('|');if(couples.has(key))continue;couples.add(key);}edges.push({a,b,relation:r});}
  const model=refreshOverlapRegions({layout:'overlap',centerId:center?.id,nodes,groups:shownGroups,edges,width:1000,height:800,freeArea:{id:'shared',x:0,y:0,width:1000,height:800,groups:[]}});const dx=Math.max(0,35-Math.min(35,...model.groups.map(g=>g.bounds.left))),dy=Math.max(0,35-Math.min(35,...model.groups.map(g=>g.bounds.top)));if(dx||dy){for(const n of model.nodes){n.x+=dx;n.y+=dy;}refreshOverlapRegions(model);}return model;
}
function overlapRegionsSvg(model,colors){
  return model.groups.map((g,i)=>{
    const mask='membership-mask-'+i,color=colors[i%colors.length],outsiders=model.nodes.filter(n=>!n.memberships.includes(g.id));
    // Cut nonmembers out of the enclosing region: spatial proximity never implies membership.
    const holes=outsiders.map(n=>`<rect x="${n.x-82}" y="${n.y-38}" width="164" height="76" rx="20" fill="black"/>`).join('');
    return `<defs><mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="${model.width}" height="${model.height}"><rect width="${model.width}" height="${model.height}" fill="white"/>${holes}</mask></defs><g class="graph-group ${graphSelectedGroup===g.id?'selected':''}" data-action="graph-select-group" data-group="${escapeHtml(g.id)}" tabindex="0" role="button" aria-label="${escapeHtml(g.name)}の囲みを調整"><path d="${g.path}" fill="${color}" fill-opacity=".38" stroke="${['#476aa8','#238166','#9a6724','#79559e','#a75468'][i%5]}" stroke-width="${graphSelectedGroup===g.id?3:2}" stroke-dasharray="8 5" mask="url(#${mask})"/><text x="${g.x}" y="${g.bounds.top+26}" text-anchor="middle" class="graph-community">${escapeHtml(g.label||g.name)}</text></g>`;
  }).join('');
}
if(typeof module!=='undefined')module.exports={overlapGraphModel,refreshOverlapRegions,graphHull};

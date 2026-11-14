/* ## 家系図の検証，親族経路，配置，写真を保持したデータ結合を処理する．外部サービスには接続しない． */
(function(root){
'use strict';
const TYPES={parent:'実親子',adopt:'養親子',spouse:'配偶者',fiance:'婚約者',partner:'パートナー',ex:'元配偶者',sibling:'きょうだい',friend:'友人',other:'その他'};
const uid=()=>globalThis.crypto.randomUUID?.()||'id-'+Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)),v=>v.toString(16).padStart(8,'0')).join('');
const clone=x=>JSON.parse(JSON.stringify(x));
const ancestry=e=>e.type==='parent'||e.type==='adopt';
function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number(value.slice(0,4))<1)return false;
 const d=new Date(value+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function validBirth(value){return typeof value==='string'&&(value===''||(/^\d{4}$/.test(value)&&Number(value)>0)||(/^--\d{2}-\d{2}$/.test(value)&&validDate('2000'+value.slice(1)))||validDate(value));}
function birthParts(value=''){const m=/^(\d{4})?-(\d{2})-(\d{2})$/.exec(value.startsWith('--')?value.slice(1):value);return m?{year:m[1]||'',month:String(Number(m[2])),day:String(Number(m[3]))}:{year:value,month:'',day:''};}
function birthValue(year,month,day){
 if((month&&!day)||(!month&&day))throw Error('誕生日の月と日は両方入力してください．');
 const value=month&&day?(year||'-')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'):year;
 if(!validBirth(value))throw Error('誕生日を確認してください．年は空欄でも登録できます．');return value;
}
function birthLabel(value){if(!value)return '';const b=birthParts(value);return b.month?(b.year?b.year+'年':'')+b.month+'月'+b.day+'日'+(b.year?'生まれ':'生まれ（年不明）'):b.year+'年生まれ';}
function fresh(){let id=uid();return {format:'family-tree',version:1,self:id,partner:null,people:[{id,name:'自分',gender:'unknown',birth:'',death:'',memo:'',photo:'',x:0,y:0}],edges:[]};}
function validate(raw){
 if(!raw||raw.format!=='family-tree'||raw.version!==1||!Array.isArray(raw.people)||!Array.isArray(raw.edges))throw Error('対応する家系図JSON（バージョン1）ではありません．');
 if(raw.people.length<1||raw.people.length>5000||raw.edges.length>20000)throw Error('人物数または関係数が範囲外です．');
 const str=(s,n=2000)=>typeof s==='string'&&s.length<=n;
 const ids=new Set();
 const people=raw.people.map(p=>{
  if(!p||!str(p.id,100)||!p.id||ids.has(p.id)||!str(p.name,120)||!p.name.trim())throw Error('人物IDまたは名前が不正・重複しています．');ids.add(p.id);
  if(p.photo&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo))throw Error('写真形式が不正です．');
  if((p.photo||'').length>4000000)throw Error('写真が大きすぎます．');
  if(!validBirth(p.birth||'')||(p.death&&!validDate(p.death)))throw Error('日付が不正です．');
  if(!str(p.memo||'',10000))throw Error('メモが長すぎます．');
  return {id:p.id,name:p.name.trim(),gender:['male','female','other','unknown'].includes(p.gender)?p.gender:'unknown',birth:p.birth||'',death:p.death||'',memo:p.memo||'',photo:p.photo||'',x:Number.isFinite(p.x)?Math.max(-100000,Math.min(100000,p.x)):0,y:Number.isFinite(p.y)?Math.max(-100000,Math.min(100000,p.y)):0};
 });
 if(!ids.has(raw.self)||(raw.partner!=null&&(!ids.has(raw.partner)||raw.partner===raw.self)))throw Error('中心人物の設定が不正です．');
 const seen=new Set(),edgeIds=new Set();const edges=raw.edges.map(e=>{
 if(!e||!ids.has(e.a)||!ids.has(e.b)||e.a===e.b||!Object.hasOwn(TYPES,e.type))throw Error('関係の参照が不正です．');
 if(e.id&&edgeIds.has(e.id))throw Error('関係IDが重複しています．');if(e.id)edgeIds.add(e.id);
 const key=ancestry(e)?`${e.type}:${e.a}:${e.b}`:`${e.type}:${[e.a,e.b].sort().join(':')}`;
 if(seen.has(key))throw Error('同じ関係が重複しています．');seen.add(key);
 if(e.score!=null&&(!Number.isFinite(e.score)||e.score<0||e.score>100))throw Error('親密度は0～100です．');
 if(!str(e.note||'',4000))throw Error('関係メモが長すぎます．');
 return {id:str(e.id,100)&&e.id?e.id:uid(),a:e.a,b:e.b,type:e.type,score:e.score??null,note:e.note||''};
 });
 const graph=new Map(people.map(p=>[p.id,[]]));edges.filter(ancestry).forEach(e=>graph.get(e.a).push(e.b));
 const visiting=new Set(),done=new Set();function visit(id){if(visiting.has(id))throw Error('親子関係が循環しています．');if(done.has(id))return;visiting.add(id);graph.get(id).forEach(visit);visiting.delete(id);done.add(id);}people.forEach(p=>visit(p.id));
 return {format:'family-tree',version:1,self:raw.self,partner:raw.partner||null,people,edges};
}
function step(e,from){if(ancestry(e))return from===e.a?(e.type==='adopt'?'養子':'子'):(e.type==='adopt'?'養親':'親');return TYPES[e.type];}
function path(d,a,b){let queue=[a],prev=new Map([[a,null]]);for(let i=0;i<queue.length;i++){const v=queue[i];if(v===b)break;for(const e of d.edges){const to=e.a===v?e.b:e.b===v?e.a:null;if(to&&!prev.has(to)){prev.set(to,{from:v,edge:e});queue.push(to);}}}if(!prev.has(b))return null;const out=[];for(let v=b;v!==a;){const s=prev.get(v);out.unshift({from:s.from,to:v,edge:s.edge,label:step(s.edge,s.from)});v=s.from;}return out;}
function kinship(d,a,b){
 if(a===b)return '本人';
 const direct=d.edges.find(e=>(e.a===a&&e.b===b)||(e.b===a&&e.a===b));
 if(direct)return step(direct,a);
 function ancestors(id){const m=new Map([[id,0]]),q=[id];for(let i=0;i<q.length;i++)for(const e of d.edges.filter(ancestry)){if(e.b===q[i]&&!m.has(e.a)){m.set(e.a,m.get(q[i])+1);q.push(e.a);}}return m;}
 const aa=ancestors(a),bb=ancestors(b);let best=null;
 for(const [id,da] of aa)if(bb.has(id)){const db=bb.get(id);if(!best||da+db<best.da+best.db)best={da,db};}
 if(!best)return 'つながりの経路';
 const {da,db}=best;const degree=da+db;let label='親族';
 if(da===0)label=db===1?'子':db===2?'孫':db===3?'ひ孫':`${db}世代下の子孫`;
 else if(db===0)label=da===1?'親':da===2?'祖父母':da===3?'曾祖父母':`${da}世代上の祖先`;
 else if(da===1&&db===1)label='きょうだい';else if(da===2&&db===1)label='おじ・おば';else if(da===1&&db===2)label='おい・めい';else if(da===2&&db===2)label='いとこ';
 return `${label}（親子経路で${degree}親等相当）`;
}
function layout(d){
 // Reserve a separate horizontal span for each ancestral branch.
 const gap=144,rowGap=172,parents=new Map(d.people.map(p=>[p.id,[]])),adj=new Map(d.people.map(p=>[p.id,[]]));
 for(const e of d.edges){adj.get(e.a).push(e);adj.get(e.b).push(e);if(ancestry(e)&&!parents.get(e.b).includes(e.a))parents.get(e.b).push(e.a);}
 const pos=new Map(),claimed=new Set();
 function branch(id,depth=0){if(claimed.has(id)||depth>100)return null;claimed.add(id);const children=parents.get(id).map(x=>branch(x,depth+1)).filter(Boolean);return {id,children,width:Math.max(1,children.reduce((n,c)=>n+c.width,0))};}
 function place(tree,left,level){pos.set(tree.id,{x:(left+tree.width/2)*gap,y:level*rowGap});for(const c of tree.children){place(c,left,level-1);left+=c.width;}}
 const left=branch(d.self),right=d.partner?branch(d.partner):null;
 if(right){place(left,-left.width,0);place(right,0,0);}else place(left,-left.width/2,0);
 // Position descendants, siblings and other registered people near their family.
 const levels=new Map([...pos].map(([id,p])=>[id,p.y/rowGap])),queue=[...pos.keys()];
 for(let i=0;i<queue.length;i++){const id=queue[i];for(const e of adj.get(id)){const to=e.a===id?e.b:e.a;if(levels.has(to))continue;const level=levels.get(id)+(ancestry(e)?(e.a===id?1:-1):0);levels.set(to,level);queue.push(to);}}
 const others=d.people.filter(p=>!pos.has(p.id)).sort((a,b)=>(levels.get(a.id)??1000)-(levels.get(b.id)??1000));
 let unrelated=0;
 for(const p of others){if(!levels.has(p.id)){levels.set(p.id,2+Math.floor(unrelated++/6));}
 const level=levels.get(p.id),near=parents.get(p.id).filter(id=>pos.has(id)).map(id=>pos.get(id).x);
 if(!near.length)for(const e of adj.get(p.id)){const to=e.a===p.id?e.b:e.a;if(pos.has(to))near.push(pos.get(to).x);}
 let x=near.length?near.reduce((a,b)=>a+b,0)/near.length:unrelated*gap;
 const occupied=[...pos.values()].filter(q=>q.y===level*rowGap);let offset=0;while(occupied.some(q=>Math.abs(q.x-(x+offset))<gap-1)){offset=offset<=0?-offset+gap:-offset;}x+=offset;pos.set(p.id,{x,y:level*rowGap});}
 return {...d,people:d.people.map(p=>({...p,...pos.get(p.id)}))};
}
function dock(current,incoming,{left=current.self,right=incoming.self,existingRight='',incomingLeft='',type='fiance'}={}){
 const a=validate(current),b=validate(incoming);if(!a.people.some(p=>p.id===left)||!b.people.some(p=>p.id===right))throw Error('結合する中心人物を選んでください．');
 if(existingRight===left||incomingLeft===right)throw Error('左右に同じ人物は選べません．');
 if(existingRight&&!a.people.some(p=>p.id===existingRight))throw Error('既存の右側人物が見つかりません．');
 if(incomingLeft&&!b.people.some(p=>p.id===incomingLeft))throw Error('相手側の左側人物が見つかりません．');
 if(!['fiance','spouse','partner'].includes(type))throw Error('結合する関係が不正です．');
 const map=new Map(b.people.map(p=>[p.id,p.id]));if(existingRight)map.set(right,existingRight);if(incomingLeft)map.set(incomingLeft,left);
 if(map.get(right)===left)throw Error('同じデータの中心人物同士は結合できません．右側の人物を選び直してください．');
 // 同一人物は現在の記録を優先し，空欄の写真・メモなどだけを補完する．
 const people=clone(a.people);for(const p of b.people){const id=map.get(p.id);const existing=people.find(x=>x.id===id);if(!existing)people.push({...p,id});else{for(const k of ['photo','memo','birth','death'])if(!existing[k])existing[k]=p[k];if(existing.gender==='unknown')existing.gender=p.gender;}}
 const edges=clone(a.edges);for(const e of b.edges){const n={...e,id:uid(),a:map.get(e.a),b:map.get(e.b)};if(n.a===n.b)continue;if(!edges.some(x=>x.type===n.type&&((x.a===n.a&&x.b===n.b)||(!ancestry(x)&&x.a===n.b&&x.b===n.a))))edges.push(n);}
 const r=map.get(right),prior=edges.find(e=>['spouse','fiance','partner'].includes(e.type)&&[e.a,e.b].includes(left)&&[e.a,e.b].includes(r));for(let i=edges.length-1;i>=0;i--)if(['spouse','fiance','partner'].includes(edges[i].type)&&[edges[i].a,edges[i].b].includes(left)&&[edges[i].a,edges[i].b].includes(r))edges.splice(i,1);
 edges.push({id:prior?.id||uid(),a:left,b:r,type,score:prior?.score??null,note:prior?.note||''});return layout(validate({...a,self:left,partner:r,people,edges}));
}
const api={validBirth,birthParts,birthValue,birthLabel,TYPES,uid,clone,ancestry,fresh,validate,path,kinship,layout,dock,step};if(typeof module!=='undefined')module.exports=api;else root.Family=api;
})(globalThis);

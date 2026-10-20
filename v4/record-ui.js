(function(root){
'use strict';
const U=root.MoneyV4||(typeof require==='function'?require('./core.js'):null);
const expenses=['生活費','固定費','NISA','別枠貯金','住居費','特別支出','定期支出'],living=['食費','交通費','日用品','医療','被服','趣味','ビジネス','交際費','未分類'];
// A display taxonomy only: never rewrite accounting kinds, item IDs or stored history.
function path(i,a){
 const v={...i,...a},kind=v.kind,g=v.group||'',sub=v.subgroup||'',name=v.leafName||v.name||'';
 if(kind==='income')return ['収入',g==='賞与'||i.group==='賞与'||/賞与|ボーナス/.test(name)?'賞与':g==='特別収入'||v.source==='event'||v.id?.startsWith('payout:')?'特別収入':'給料'];
 if(kind==='invest')return ['支出','NISA'];if(kind==='reserve')return ['支出','別枠貯金'];
 const aliases={'固定費':'固定費','定期支出':'定期支出','住居':'住居費','住居費':'住居費','住宅費':'住居費','特別支出':'特別支出'};
 if(aliases[g])return ['支出',aliases[g]];
 if(aliases[sub])return ['支出',aliases[sub]];
 if(g==='子ども'||v.source==='child')return ['支出','特別支出','子ども・教育'];
 const category=living.includes(sub)?sub:living.includes(g)?g:living.includes(name)?name:'未分類';
 return ['支出','生活費',category];
}
function tree(rows,r){
 const roots=new Map(),add=parts=>{let map=roots,node;for(let k=0;k<parts.length;k++){const name=parts[k];if(!map.has(name))map.set(name,{name,path:parts.slice(0,k+1),planned:0,actual:0,items:[],children:new Map()});node=map.get(name);map=node.children;}return node;};
 for(const name of ['給料','賞与','特別収入'])add(['収入',name]);for(const name of expenses)add(['支出',name]);for(const name of living)add(['支出','生活費',name]);
 for(const i of rows){const a=r.row.values?.[i.id],parts=path(i,a),actual=a&&a.entered!==false?U.N(a.amount):0;add(parts).items.push(i);for(let k=1;k<=parts.length;k++){const n=add(parts.slice(0,k));n.planned+=U.N(i.amount);n.actual+=actual;}}
 return roots;
}
function manualContext(parts){
 if(parts[0]==='収入'&&['給料','賞与','特別収入'].includes(parts[1]))return {kind:'income',group:parts[1]};
 if(parts[0]!=='支出'||!expenses.includes(parts[1]))throw Error('記録する分類を選んでください．');
 if(parts[1]==='NISA')return {kind:'invest',group:'NISA'};if(parts[1]==='別枠貯金')return {kind:'reserve',group:'用途別積立'};
 if(parts[1]==='生活費'){if(!living.includes(parts[2]))throw Error('生活費の分類を選んでください．');return {kind:'expense',group:'生活費',subgroup:parts[2]};}
 return {kind:'expense',group:parts[1]==='住居費'?'住居':parts[1]};
}
function render(rows,r,{esc,money,entry,button}){
 const nodes=tree(rows,r),show=n=>{const key=JSON.stringify(n.path),depth=n.path.length,leaf=!n.children.size;return `<details class="record-tree depth-${depth}" data-keep="record-tree:${esc(key)}" data-record-node="${esc(key)}"><summary><b>${esc(n.name)}</b><small>予定 ${money(n.planned)} ／ <span data-record-path="${esc(key)}">入力済み ${money(n.actual)}</span></small></summary><div class="record-tree-body" role="group" aria-label="${esc(n.name)}の内訳">${n.path[1]==='NISA'?'<p class="hint">投資へ移すお金です．消費支出とは分けて計算します．</p>':n.path[1]==='別枠貯金'?'<p class="hint">用途別の資産へ移すお金です．購入時の支出と二重に引きません．</p>':''}${[...n.children.values()].map(show).join('')}${n.items.map(entry).join('')}${leaf?(!n.items.length?'<p class="hint">この月の項目はまだありません．</p>':'')+button('この分類の実績を追加','record-add',key,'source'):''}</div></details>`;};
 return '<p class="hint record-hierarchy-hint">大きな枠が分類，その枠の中の小さな枠が内訳です．分類をタップすると中の費目が開きます．支出の合計にはNISA・別枠貯金への資産移動も含みます．消費支出とは分けて計算します．</p>'+[...nodes.values()].map(show).join('');
}
function updateTotals(el,r,money){const rows=new Map(r.plan.map(i=>[i.id,i]));for(const[id,a]of Object.entries(r.row.values||{}))if(!rows.has(id))rows.set(id,{...a,id,amount:0});const totals=new Map(),walk=nodes=>{for(const n of nodes.values()){totals.set(JSON.stringify(n.path),n.actual);walk(n.children);}};walk(tree([...rows.values()],r));for(const span of el.querySelectorAll('[data-record-path]'))span.textContent='入力済み '+money(totals.get(span.dataset.recordPath)||0);}
const api={expenses,living,path,tree,manualContext,render,updateTotals};U.recordUI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);


(function(root){
'use strict';
const U=root.MoneyV4||(typeof require==='function'?require('./core.js'):null),X=U.patterns,old=X.categories,
 types=['selfIncome','partnerIncome','housing','living','events','children','funds','investment','budget'],
 titles={selfIncome:'本人の収入',partnerIncome:'パートナーの収入',housing:'住居費',living:'生活費',events:'イベント',children:'子ども・教育',funds:'用途別積立',investment:'NISA・投資',budget:'当初予算'};
function category(r){return r.kind==='income'?(r.owner==='partner'?'partnerIncome':'selfIncome'):r.kind==='invest'?'investment':r.kind==='reserve'?'funds':old.category(r);}
const eventType=e=>e.sinking?'funds':'events';
function keys(v){const out=old.itemKeys(v.rules||[]);for(const e of v.events||[]){out.add('event:'+e.id);if(e.sinking)out.add('saving:'+e.id);}for(const c of v.children||[])out.add('child:'+c.id);return out;}
function overrides(values,ids){return Object.fromEntries(Object.entries(values||{}).map(([m,row])=>[m,Object.fromEntries(Object.entries(row).filter(([id])=>ids.has(id)))]).filter(([,row])=>Object.keys(row).length));}
function extract(p,type){const v={rules:p.rules.filter(r=>category(r)===type),events:p.events.filter(e=>eventType(e)===type),children:type==='children'?p.children:[]};v.overrides=overrides(p.overrides,keys(v));
 if(type==='children')v.masterOverrides=p.masterOverrides||{};
 if(type==='investment'){v.investment=p.investment||null;v.returnRate=p.returnRate??null;}
 if(type==='budget'){v.budgets=p.budgets;v.annualBudgets=p.annualBudgets||{};}
 return U.C(v);
}
const source=(n,p,type)=>n.categoryCatalog[type].find(q=>q.id===p.categorySelections[type]);
function register(n,type,value,name=titles[type]+'の基本案'){const list=n.categoryCatalog[type],sig=v=>JSON.stringify(Object.fromEntries(Object.entries(v).filter(([k])=>!['id','name','parentId'].includes(k)))),same=list.find(q=>q.name===name&&sig(q)===sig(value));if(same)return same;const q={...U.C(value),id:U.uid(),name};if(list.some(q=>q.name===name))q.name+='（'+(list.length+1)+'）';list.push(q);return q;}
function apply(n,p){if(n.catalogVersion!==2)return old.apply(n,p);const selected=types.map(type=>{const q=source(n,p,type);if(!q)throw Error(titles[type]+'の採用先が見つかりません．');return q;}),ids=keys({rules:p.rules,events:p.events,children:p.children}),queues={};
 for(let i=0;i<types.length;i++){queues[types[i]]=U.C(selected[i].rules);for(const id of keys(selected[i]))ids.add(id);}
 p.rules=p.rules.flatMap(r=>{const type=category(r);return type?(queues[type].length?[queues[type].shift()]:[]):[r];});for(const type of types)p.rules.push(...queues[type]);
 const eventQueues={events:U.C(source(n,p,'events').events),funds:U.C(source(n,p,'funds').events)};p.events=p.events.flatMap(e=>{const q=eventQueues[eventType(e)];return q.length?[q.shift()]:[];});p.events.push(...eventQueues.events,...eventQueues.funds);
 const ch=source(n,p,'children'),inv=source(n,p,'investment'),budget=source(n,p,'budget');p.children=U.C(ch.children);p.masterOverrides=U.C(ch.masterOverrides||{});if(inv.investment)p.investment=U.C(inv.investment);else delete p.investment;p.returnRate=inv.returnRate??null;p.budgets=U.C(budget.budgets);p.annualBudgets=U.C(budget.annualBudgets||{});
 p.overrides=Object.fromEntries(Object.entries(p.overrides).map(([m,row])=>[m,Object.fromEntries(Object.entries(row).filter(([id])=>!ids.has(id)))]).filter(([,row])=>Object.keys(row).length));for(const q of selected)for(const[m,row]of Object.entries(q.overrides||{}))Object.assign(p.overrides[m]||={},U.C(row));return p;
}
function applyAll(n){for(const p of Object.values(n.plans))apply(n,p);}
function normalize(s){for(const n of Object.values(s.notebooks||{})){if(n.catalogVersion===2)continue;oldNormalize({notebooks:{[n.id]:n}});
 const previous=n.categoryCatalog,plans=Object.values(n.plans),incomeMap=new Map();n.categoryCatalog=Object.fromEntries(types.map(t=>[t,[]]));
 for(const q of previous.income){const pair={};for(const type of ['selfIncome','partnerIncome']){const rules=q.rules.filter(r=>category(r)===type),v={rules,events:[],children:[],overrides:overrides(q.overrides,keys({rules}))};pair[type]=register(n,type,v,q.name).id;}incomeMap.set(q.id,pair);}
 for(const type of ['housing','living'])for(const q of previous[type])n.categoryCatalog[type].push({...U.C(q),events:[],children:[]});
 for(const p of plans){const previousSelections=p.categorySelections;p.categorySelections={...incomeMap.get(previousSelections.income),housing:previousSelections.housing,living:previousSelections.living};for(const type of ['events','children','funds','investment','budget'])p.categorySelections[type]=register(n,type,extract(p,type)).id;}
 n.catalogVersion=2;applyAll(n);
 }return s;}
const oldNormalize=X.normalize;
function captureSource(n,type,id,p){const q=n.categoryCatalog[type].find(q=>q.id===id);if(!q)throw Error('編集中の元データが見つかりません．');Object.assign(q,extract(p,type));applyAll(n);return q;}
function capturePlan(n,p){for(const type of types)Object.assign(source(n,p,type),extract(p,type));applyAll(n);}
function adopt(n,p,type,id){if(!types.includes(type)||!n.categoryCatalog[type].some(q=>q.id===id))throw Error('採用する案が見つかりません．');p.categorySelections[type]=id;apply(n,p);}
// Only income catalogs can be deleted here. Actual records never belong to a source.
function removeSource(n,type,id,replacementId){
 if(!['selfIncome','partnerIncome'].includes(type))throw Error('削除する収入の種類を確認してください．');
 const list=n.categoryCatalog[type],q=list.find(q=>q.id===id);
 if(!q)throw Error('削除する収入案が見つかりません．');
 if(list.length===1)throw Error('最後の収入案は削除できません．先に別案を作成してください．');
 const users=Object.values(n.plans).filter(p=>p.categorySelections[type]===id),replacement=list.find(q=>q.id===replacementId&&q.id!==id);
 if(users.length&&!replacement)throw Error('影響する全体プランに適用する置換先の収入案を選んでください．');
 for(const p of users){p.categorySelections[type]=replacement.id;apply(n,p);}
 n.categoryCatalog[type]=list.filter(q=>q.id!==id);
 for(const remaining of n.categoryCatalog[type])if(remaining.parentId===id)delete remaining.parentId;
 return replacement?.id||n.categoryCatalog[type][0].id;
}
function draft(n,p,type,id){const copy=U.C(p);copy.categorySelections[type]=id;return apply(n,copy);}
function validate(s){
 const clean=U.C(s);for(const n of Object.values(clean.notebooks))delete n.categoryCatalog;old.baseValidate(clean);
 for(const n of Object.values(s.notebooks)){if(n.catalogVersion!==2){oldValidate({...s,notebooks:{[n.id]:n},active:n.id});continue;}
 const pool=n.categoryCatalog;if(!pool||typeof pool!=='object'||Array.isArray(pool))throw Error('元データの形式を確認してください．');
 for(const type of types){const seen=new Set();if(!Array.isArray(pool[type])||!pool[type].length)throw Error(titles[type]+'の元データがありません．');for(const q of pool[type]){
  if(!q||typeof q.id!=='string'||!/^[-A-Za-z0-9_]+$/.test(q.id)||['__proto__','constructor','prototype'].includes(q.id)||seen.has(q.id)||typeof q.name!=='string'||!q.name.trim()||!Array.isArray(q.rules)||!Array.isArray(q.events)||!Array.isArray(q.children)||q.rules.some(r=>category(r)!==type)||q.events.some(e=>eventType(e)!==type)||type!=='children'&&q.children.length)throw Error('元データの案を確認してください．');seen.add(q.id);
  const ids=keys(q);if(Object.values(q.overrides||{}).some(row=>Object.keys(row).some(id=>!ids.has(id))))throw Error('別種類の月予定が混在しています．');
  const p=U.newPlan();Object.assign(p,{rules:q.rules,events:q.events,children:q.children,overrides:q.overrides||{}});if(type==='children')p.masterOverrides=q.masterOverrides||{};if(type==='investment'){p.returnRate=q.returnRate;if(q.investment)p.investment=q.investment;}if(type==='budget'){p.budgets=q.budgets;p.annualBudgets=q.annualBudgets;}
  const nn={...n,plans:{[p.id]:p},activePlan:p.id,actuals:{}};delete nn.categoryCatalog;delete nn.catalogVersion;U.valid({...s,notebooks:{[n.id]:nn},active:n.id});
 }for(const p of Object.values(n.plans))if(!seen.has(p.categorySelections?.[type]))throw Error(titles[type]+'の採用先を確認してください．');}
 for(const p of Object.values(n.plans)){const ids=new Set();for(const q of types.map(t=>source(n,p,t)))for(const i of [...q.rules,...q.events,...q.children]){if(ids.has(i.id))throw Error('採用する項目IDが重複しています．');ids.add(i.id);}}
 }return s;
}
const oldValidate=X.validateExtensions,api={types,titles,category,source,apply,applyAll,captureSource,capturePlan,adopt,removeSource,draft,extract,keys,copySource:old.copySource};Object.assign(X,{normalize,validateExtensions:validate,categories:api});if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);


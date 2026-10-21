(function(root){
'use strict';
const U=root.MoneyV4||(typeof require==='function'?require('./core.js'):null),X=U.patterns,
 types=['income','housing','living'],titles={income:'収入',housing:'住居費',living:'生活費'},
 legacyNormalize=X.normalize,legacyValidate=X.validateExtensions;
function category(r){return r.kind==='income'?'income':r.kind==='expense'?(r.patternType==='housing'||r.group==='住居'?'housing':'living'):null;}
function itemKeys(rules){return new Set(rules.flatMap(r=>['rule:'+r.id,...(r.patterns||[]).flatMap(q=>[...(q.renewals||[]).map(c=>'renewal:'+r.id+':'+q.id+':'+c.id),...(q.payouts||[]).map(v=>'payout:'+r.id+':'+v.id),...(q.bonuses||[]).map(v=>v.recordId||'bonus:'+r.id+':'+v.id),...(q.items||[]).map(i=>i.id==='base'?'rule:'+r.id:'rule:'+r.id+':'+i.id)])]));}
function subset(overrides,rules){const keys=itemKeys(rules);return Object.fromEntries(Object.entries(overrides||{}).map(([m,row])=>[m,Object.fromEntries(Object.entries(row).filter(([id])=>keys.has(id)))]).filter(([,row])=>Object.keys(row).length));}
function source(n,p,type){return n.categoryCatalog?.[type]?.find(q=>q.id===p.categorySelections?.[type]);}
function register(n,type,value){const list=n.categoryCatalog[type],signature=q=>JSON.stringify([q.name,q.rules,q.overrides||{}]),hit=list.find(q=>signature(q)===signature(value));if(hit)return hit;const q=U.C(value);if(!q.id||list.some(x=>x.id===q.id))q.id=U.uid();if(list.some(x=>x.name===q.name))q.name+='（'+(list.length+1)+'）';list.push(q);return q;}
function apply(n,p){
 if(!n.categoryCatalog)return p;
 const queues={},keys=itemKeys(p.rules.filter(r=>category(r)));
 for(const type of types){const q=source(n,p,type);if(!q)throw Error(titles[type]+'の採用する案を確認してください．');queues[type]=U.C(q.rules);for(const id of itemKeys(q.rules))keys.add(id);}
 p.rules=p.rules.flatMap(r=>{const type=category(r);return type?(queues[type].length?[queues[type].shift()]:[]):[r];});
 for(const type of types)p.rules.push(...queues[type]);
 for(const[m,row]of Object.entries(p.overrides)){for(const id of Object.keys(row))if(keys.has(id))delete row[id];if(!Object.keys(row).length)delete p.overrides[m];}
 for(const type of types)for(const[m,row]of Object.entries(source(n,p,type).overrides||{}))Object.assign(p.overrides[m]||={},U.C(row));
 return p;
}
function applyAll(n){for(const p of Object.values(n.plans))apply(n,p);}
function migrate(s){
 // Preserve v4=1..3 data first, including the live selected income snapshot.
 for(const n of Object.values(s.notebooks||{}))if(!n.categoryCatalog){
  legacyNormalize({notebooks:{[n.id]:n}});n.categoryCatalog={income:[],housing:[],living:[]};
  for(const p of Object.values(n.plans)){
   p.categorySelections={};
   for(const q of p.incomeScenarios){const saved=register(n,'income',{id:q.id,name:q.name,rules:q.rules,overrides:q.overrides||{}});if(q.id===p.activeIncomeScenario)p.categorySelections.income=saved.id;}
   for(const type of ['housing','living']){const rules=p.rules.filter(r=>category(r)===type),q=register(n,type,{id:U.uid(),name:titles[type]+'の基本案',rules,overrides:subset(p.overrides,rules)});p.categorySelections[type]=q.id;}
   delete p.incomeScenarios;delete p.activeIncomeScenario;
  }
  applyAll(n);
 }
 for(const n of Object.values(s.notebooks||{})){n.purposes||=[];for(const p of Object.values(n.plans))p.masterOverrides||={};}
 return s;
}
function captureSource(n,type,id,draft){const q=n.categoryCatalog[type].find(q=>q.id===id);if(!q)throw Error('編集中の元データが見つかりません．');if(draft.rules.some(r=>category(r)!==type))throw Error('別の種類の項目が混在しています．');q.rules=U.C(draft.rules);q.overrides=subset(draft.overrides,q.rules);applyAll(n);return q;}
function capturePlan(n,p){if(!n.categoryCatalog)return;for(const type of types){const q=source(n,p,type),rules=p.rules.filter(r=>category(r)===type);q.rules=U.C(rules);q.overrides=subset(p.overrides,rules);}applyAll(n);}
function adopt(n,p,type,id){if(!types.includes(type)||!n.categoryCatalog[type].some(q=>q.id===id))throw Error('採用する案が見つかりません．');p.categorySelections[type]=id;apply(n,p);}
function copySource(n,type,id,name){const original=n.categoryCatalog[type]?.find(q=>q.id===id);if(!original)throw Error('元の案が見つかりません．');name=name.trim();if(!name)throw Error('名前を入力してください．');const q={...U.C(original),id:U.uid(),name,parentId:original.id};n.categoryCatalog[type].push(q);return q;}
function draft(n,p,type,id){const q=n.categoryCatalog[type].find(q=>q.id===id);if(!q)throw Error('元データが見つかりません．');return {...U.C(p),rules:U.C(q.rules),overrides:U.C(q.overrides||{})};}
function validate(s){legacyValidate(s);for(const n of Object.values(s.notebooks)){
 if(n.categoryCatalog===undefined)continue;const pool=n.categoryCatalog;
 if(!pool||typeof pool!=='object'||Array.isArray(pool))throw Error('案の元データを確認してください．');
 for(const type of types){const seen=new Set();if(!Array.isArray(pool[type])||!pool[type].length)throw Error('案の元データがありません．');
  for(const q of pool[type]){if(!q||typeof q.id!=='string'||!/^[-A-Za-z0-9_]+$/.test(q.id)||['__proto__','constructor','prototype'].includes(q.id)||seen.has(q.id)||typeof q.name!=='string'||!q.name.trim()||!Array.isArray(q.rules)||q.rules.some(r=>category(r)!==type))throw Error('案の元データが不正です．');seen.add(q.id);
   const keys=itemKeys(q.rules);if(Object.values(q.overrides||{}).some(row=>Object.keys(row).some(id=>!keys.has(id))))throw Error('別の案の月予定が混在しています．');
   const p=U.newPlan();p.rules=q.rules;p.overrides=q.overrides||{};
   const nn={...n,plans:{[p.id]:p},activePlan:p.id,actuals:{}};delete nn.categoryCatalog;
   U.valid({...s,notebooks:{[n.id]:nn},active:n.id});
  }
  for(const p of Object.values(n.plans))if(!seen.has(p.categorySelections?.[type]))throw Error(titles[type]+'の採用する案が見つかりません．');
 }
 // Selected categories must not introduce duplicate IDs into the same whole plan.
 for(const p of Object.values(n.plans)){const ids=new Set();for(const r of [...p.rules.filter(r=>!category(r)),...types.flatMap(t=>source(n,p,t).rules),...p.events,...p.children]){if(ids.has(r.id))throw Error('採用する案の項目IDが重複しています．');ids.add(r.id);}}
}return s;}
Object.assign(X,{normalize:migrate,validateExtensions:validate,categories:{types,titles,category,itemKeys,subset,source,apply,applyAll,captureSource,capturePlan,adopt,copySource,draft,baseNormalize:legacyNormalize,baseValidate:legacyValidate}});
if(typeof module!=='undefined')module.exports=X.categories;
})(typeof window==='undefined'?globalThis:window);


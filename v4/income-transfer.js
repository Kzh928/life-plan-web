(function(root){
'use strict';
const U=root.MoneyV4||(typeof require==='function'?require('./core.js'):null),X=U.patterns;
// Import as new independent sources in a disposable state; never replace recorded actuals.
function prepare(state,payload){
 if(!payload||payload.format!=='jp.finance.income.sources'||![1,2].includes(payload.version)||!Array.isArray(payload.sources)||payload.sources.length<1||payload.sources.length>2)throw Error('本人・パートナーの年度別収入をまとめたJSONを選んでください．');
 const checked=U.C(state);X.normalize(checked);const n=checked.notebooks[checked.active],seen=new Set(),added=[];
 for(const source of payload.sources){
  if(!source||!['self','partner'].includes(source.owner)||seen.has(source.owner)||typeof source.name!=='string'||!source.name.trim()||source.name.length>60||!Array.isArray(source.patterns)||!source.patterns.length||!Array.isArray(source.stages)||!source.stages.length||!U.validMonth(source.start)||source.end&&!U.validMonth(source.end)||source.end&&source.end<source.start)throw Error('収入案の本人・パートナー，働き方，期間を確認してください．');
  seen.add(source.owner);const type=source.owner==='partner'?'partnerIncome':'selfIncome',map=new Map();
  const patterns=source.patterns.map(p=>{
   if(!p||typeof p.id!=='string'||!/^[-A-Za-z0-9_]+$/.test(p.id)||map.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>60||!p.years||typeof p.years!=='object'||Array.isArray(p.years)||(!Object.keys(p.years).length&&!p.salaryChanges?.length))throw Error('働き方と年度別の手取りを確認してください．');
   const id=U.uid();map.set(p.id,id);const years={};
   for(const[y,row]of Object.entries(p.years)){
    if(!/^\d{4}$/.test(y)||Number(y)<1900||Number(y)>2100||!row||typeof row.netAnnual!=='number'||!Number.isFinite(row.netAnnual)||row.netAnnual<0)throw Error('年度別手取りは0円以上の数値で指定してください．');
    years[y]={netAnnual:row.netAnnual};
   }
   const out={id,name:p.name,monthly:0,netAnnual:0,years,payouts:[]};
   if(p.salaryChanges!==undefined){
    if(!Array.isArray(p.salaryChanges))throw Error('月給の変更一覧を確認してください．');
    const seen=new Set();out.salaryChanges=p.salaryChanges.map(v=>{
     if(!v||!U.validMonth(v.from)||seen.has(v.from)||typeof v.netMonthly!=='number'||!Number.isFinite(v.netMonthly)||v.netMonthly<0)throw Error('月給の変更月と手取りを確認してください．');
     seen.add(v.from);return {from:v.from,netMonthly:v.netMonthly};
    }).sort((a,b)=>a.from.localeCompare(b.from));
   }
   if(p.bonuses!==undefined){
    if(!Array.isArray(p.bonuses)||!out.salaryChanges?.length)throw Error('賞与は月給と分けて指定してください．');
    const seen=new Set();out.bonuses=p.bonuses.map(v=>{
     if(!v||!U.validMonth(v.month)||seen.has(v.month)||typeof v.net!=='number'||!Number.isFinite(v.net)||v.net<0)throw Error('賞与の支給月と手取りを確認してください．');
     seen.add(v.month);return {id:'month-'+v.month,month:v.month,amount:v.net};
    });
   }
   return out;
  });
  const months=new Set(),patternStages=source.stages.map(s=>{
   if(!s||!U.validMonth(s.month)||months.has(s.month)||!map.has(s.patternId))throw Error('働き方の切替月・参照先を確認してください．');
   months.add(s.month);return {id:U.uid(),month:s.month,patternId:map.get(s.patternId)};
  }).sort((a,b)=>a.month.localeCompare(b.month));
  if(patternStages[0].month>source.start)throw Error('収入開始月に使う働き方を指定してください．');
  const existing=X.categories.source(n,n.plans[n.activePlan],type).rules.filter(r=>r.kind==='income'),linked=existing[0];
  const r={id:linked?.id||U.uid(),name:linked?.name||X.categories.titles[type],kind:'income',owner:source.owner,group:'給与',amount:0,start:source.start,end:source.end||'',changes:[],annualYears:{},patternType:'income',patterns,patternStages};
  const base=source.name.trim(),names=new Set(n.categoryCatalog[type].map(q=>q.name));let name=base,copy=2;while(names.has(name))name=base+'（'+copy+++'）';
  const q={id:U.uid(),name,rules:[r],events:[],children:[],overrides:{}};n.categoryCatalog[type].push(q);added.push({type,id:q.id,name,rule:r,linkedRule:linked?.name||''});
 }
 U.valid(checked);return {state:checked,added};
}
function bonusCandidates(state,payload){
 const n=state.notebooks[state.active],p=n.plans[n.activePlan];
 return p.events.filter(e=>e.kind==='income'&&!e.sinking&&e.enabled!==false).map(e=>({id:e.id,name:e.name,amount:e.amount,owners:payload.sources.filter(s=>s.patterns.some(q=>(q.bonuses||[]).some(b=>U.occurs(e,b.month)))).map(s=>s.owner)})).filter(e=>e.owners.length);
}
function commit(state,payload,adopt=false,bonusLinks={}){
 const result=prepare(state,payload),n=result.state.notebooks[result.state.active],allowed=bonusCandidates(result.state,payload);
 const p=n.plans[n.activePlan],assigned=new Set();
 for(const [eventId,owner] of Object.entries(bonusLinks)){
  if(owner==='keep')continue;
  const candidate=allowed.find(e=>e.id===eventId),event=p.events.find(e=>e.id===eventId),q=result.added.find(q=>q.rule.owner===owner);
  if(!candidate?.owners.includes(owner)||!q)throw Error('賞与の対応先を確認してください．');
  for(const profile of q.rule.patterns)for(const b of profile.bonuses||[])if(U.occurs(event,b.month)){
   const key=profile.id+':'+b.month;if(assigned.has(key))throw Error('同じ賞与に複数の特別収入が対応しています．');
   assigned.add(key);b.recordId='event:'+eventId;
  }
 }
 if(adopt)for(const q of result.added)X.categories.adopt(n,n.plans[n.activePlan],q.type,q.id);
 U.valid(result.state);return result;
}
U.incomeTransfer={prepare,commit,bonusCandidates};if(typeof module!=='undefined')module.exports=U.incomeTransfer;
})(typeof window==='undefined'?globalThis:window);

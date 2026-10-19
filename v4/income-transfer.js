(function(root){
'use strict';
const U=root.MoneyV4||(typeof require==='function'?require('./core.js'):null),X=U.patterns;
// Import as new independent sources in a disposable state; never replace recorded actuals.
function prepare(state,payload){
 if(!payload||payload.format!=='jp.finance.income.sources'||payload.version!==1||!Array.isArray(payload.sources)||payload.sources.length<1||payload.sources.length>2)throw Error('本人・パートナーの年度別収入をまとめたJSONを選んでください．');
 const checked=U.C(state);X.normalize(checked);const n=checked.notebooks[checked.active],seen=new Set(),added=[];
 for(const source of payload.sources){
  if(!source||!['self','partner'].includes(source.owner)||seen.has(source.owner)||typeof source.name!=='string'||!source.name.trim()||source.name.length>60||!Array.isArray(source.patterns)||!source.patterns.length||!Array.isArray(source.stages)||!source.stages.length||!U.validMonth(source.start)||source.end&&!U.validMonth(source.end)||source.end&&source.end<source.start)throw Error('収入案の本人・パートナー，働き方，期間を確認してください．');
  seen.add(source.owner);const type=source.owner==='partner'?'partnerIncome':'selfIncome',map=new Map();
  const patterns=source.patterns.map(p=>{
   if(!p||typeof p.id!=='string'||!/^[-A-Za-z0-9_]+$/.test(p.id)||map.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>60||!p.years||typeof p.years!=='object'||Array.isArray(p.years)||!Object.keys(p.years).length)throw Error('働き方と年度別の手取りを確認してください．');
   const id=U.uid();map.set(p.id,id);const years={};
   for(const[y,row]of Object.entries(p.years)){
    if(!/^\d{4}$/.test(y)||Number(y)<1900||Number(y)>2100||!row||typeof row.netAnnual!=='number'||!Number.isFinite(row.netAnnual)||row.netAnnual<0)throw Error('年度別手取りは0円以上の数値で指定してください．');
    years[y]={netAnnual:row.netAnnual};
   }
   return {id,name:p.name,monthly:0,netAnnual:0,years,payouts:[]};
  });
  const months=new Set(),patternStages=source.stages.map(s=>{
   if(!s||!U.validMonth(s.month)||months.has(s.month)||!map.has(s.patternId))throw Error('働き方の切替月・参照先を確認してください．');
   months.add(s.month);return {id:U.uid(),month:s.month,patternId:map.get(s.patternId)};
  }).sort((a,b)=>a.month.localeCompare(b.month));
  if(patternStages[0].month>source.start)throw Error('収入開始月に使う働き方を指定してください．');
  const r={id:U.uid(),name:X.categories.titles[type],kind:'income',owner:source.owner,group:'給与',amount:0,start:source.start,end:source.end||'',changes:[],annualYears:{},patternType:'income',patterns,patternStages};
  const base=source.name.trim(),names=new Set(n.categoryCatalog[type].map(q=>q.name));let name=base,copy=2;while(names.has(name))name=base+'（'+copy+++'）';
  const q={id:U.uid(),name,rules:[r],events:[],children:[],overrides:{}};n.categoryCatalog[type].push(q);added.push({type,id:q.id,name,rule:r});
 }
 U.valid(checked);return {state:checked,added};
}
function commit(state,payload,adopt=false){
 const result=prepare(state,payload),n=result.state.notebooks[result.state.active];
 if(adopt)for(const q of result.added)X.categories.adopt(n,n.plans[n.activePlan],q.type,q.id);
 U.valid(result.state);return result;
}
U.incomeTransfer={prepare,commit};if(typeof module!=='undefined')module.exports=U.incomeTransfer;
})(typeof window==='undefined'?globalThis:window);

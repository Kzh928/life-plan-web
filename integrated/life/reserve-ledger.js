// 用途別積立は現金の内訳。「必要額÷周期」を毎年移し、周期到来時の買替で総資産を減らす。
window.PlanReserve=(()=>{
 const n=x=>Number(String(x??0).replaceAll(',',''))||0;
 const year=x=>Math.floor(n(x));
 const inRange=(e,y)=>{const from=year(e.startYear),to=year(e.endYear)||year(e.startYear);return y>=from&&y<=to};
 const occurs=(e,y)=>{const from=year(e.startYear),to=year(e.endYear)||from,period=Math.max(0,year(e.interval));return (!period||!e.endYear)?y===from:y>=from&&y<=to&&(y-from)%period===0};
 const annualAmount=e=>Math.max(0,n(e.expense))/Math.max(1,year(e.interval)||1);
 const sinkingPurchaseDue=(e,y)=>{const from=year(e.startYear),to=year(e.endYear)||from,cycle=Math.max(1,year(e.interval)||1);return !!e.autoPurchase&&y>=from&&y<=to&&(y-from+1)%cycle===0};
 const purposeId=(plan,value)=>{const text=String(value||'').trim();const found=(plan.savingPurposes||[]).find(p=>p.id===text||p.name===text);return found?.id||''};
 function ensure(plan){
  plan.savingPurposes=Array.isArray(plan.savingPurposes)?plan.savingPurposes:[];
  const valid=new Set(plan.savingPurposes.flatMap(p=>[p.id,p.name]).filter(Boolean));
  for(const e of plan.events||[]){for(const field of ['savingGroup','fundingPurpose']){const value=String(e[field]||'').trim();if(value&&!valid.has(value))e[field]=''}}
  for(const [index,e] of (plan.events||[]).entries()){
   if(e.eventType!=='sinking')continue;
   let purpose=plan.savingPurposes.find(p=>p.id===e.savingGroup||p.name===e.savingGroup);
   if(!purpose&&plan.savingPurposes.length)purpose=plan.savingPurposes[0];
   if(!purpose){
    const id=e.reserveLinkId||`reserve-${Date.now()}-${index}`;e.reserveLinkId=id;
    purpose={id:`purpose-${id}`,name:'家電',initialBalance:0,color:'#9b6bc3',note:'積立イベントから自動作成',autoLinked:true,linkedEventId:id};
    plan.savingPurposes.push(purpose);
   }
   e.savingGroup=purpose.id;e.autoPurchase=true;e.savingRole='annual';
  }
  return plan.savingPurposes;
 }
 function migrateLegacy(plan){
  let changed=false;plan.savingPurposes=Array.isArray(plan.savingPurposes)?plan.savingPurposes:[];
  const byId=new Map(plan.savingPurposes.map(p=>[p.id,p]));
  const bad=plan.savingPurposes.filter(p=>/^purpose-\d/.test(String(p.name||'')));
  for(const p of bad){const target=byId.get(p.name);for(const e of plan.events||[]){if(e.savingGroup===p.id)e.savingGroup=target?.id||'';if(e.fundingPurpose===p.id)e.fundingPurpose=target?.id||''}plan.savingPurposes=plan.savingPurposes.filter(x=>x!==p);changed=true}
  ensure(plan);
  for(const e of plan.events||[]){
   if(e.savingRole==='annual'&&!e.eventType){e.eventType='sinking';changed=true}
   if(e.eventType==='sinking'){e.flow='expense';e.savingRole='annual';e.sinkingMode='auto';e.autoPurchase=true;if(!e.interval||e.interval<1)e.interval=1;e.startYear||=n(plan.startYear);e.endYear||=n(plan.startYear)+n(plan.horizon)-1}
  }
  if(n(plan.reserveSchemaVersion)<4){plan.reserveSchemaVersion=4;changed=true}
  return changed;
 }
 function build(plan){
  const purposes=ensure(plan),start=year(plan.startYear),h=Math.max(1,Math.min(80,year(plan.horizon)||40));
  const groups=purposes.map(p=>({id:p.id,name:p.name||'名称未設定',color:p.color||'#9b6bc3',note:p.note||'',events:[],rows:[],monthlyGuide:0,initialBalance:Math.max(0,n(p.initialBalance))}));
  for(const g of groups){let balance=g.initialBalance;for(let i=0;i<h;i++){const y=start+i;let setAside=0,purchase=0;for(const [index,e] of (plan.events||[]).entries()){
    if(!e.enabled)continue;
    if(e.eventType==='sinking'&&purposeId(plan,e.savingGroup)===g.id&&inRange(e,y)){const annual=annualAmount(e);setAside+=annual;if(sinkingPurchaseDue(e,y))purchase+=Math.max(0,n(e.expense));if(!g.events.some(x=>x.index===index))g.events.push({index,name:e.name||'積立',role:'annual',cost:annual,target:n(e.expense),cycle:Math.max(1,year(e.interval)||1),firstYear:year(e.startYear),autoPurchase:!!e.autoPurchase,enabled:true})}
    if(e.eventType!=='sinking'&&e.flow!=='income'&&purposeId(plan,e.fundingPurpose)===g.id&&occurs(e,y)){purchase+=Math.max(0,n(e.expense));if(!g.events.some(x=>x.index===index))g.events.push({index,name:e.name||'購入',role:'purchase',cost:n(e.expense),firstYear:year(e.startYear),interval:year(e.interval),enabled:true})}
   }balance+=setAside-purchase;g.rows.push({year:y,setAside,purchase,balance});}
   g.monthlyGuide=g.rows.reduce((s,r)=>s+r.setAside,0)/Math.max(1,h)/12;
  }
  return groups;
 }
 function balancesForYears(plan){const groups=build(plan);return Array.from({length:Math.max(1,Math.min(80,year(plan.horizon)||40))},(_,i)=>{const balances={};let total=0;for(const g of groups){const value=n(g.rows[i]?.balance);balances[g.id]=value;total+=value}return {year:year(plan.startYear)+i,total,balances}})}
 return {build,ensure,migrateLegacy,balancesForYears,purposeId,annualAmount,sinkingPurchaseDue};
})();

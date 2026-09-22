// 用途別積立は現金の内訳として管理する。積立時は総資産を減らさず、購入時だけ減る。
window.PlanReserve=(()=>{
 const n=x=>Number(String(x??0).replaceAll(',',''))||0;
 const year=x=>Math.floor(n(x));
 const active=(e,y)=>{const from=year(e.startYear),to=year(e.endYear)||from,period=year(e.interval)||0;return (!period||!e.endYear)?y===from:y>=from&&y<=to&&(y-from)%period===0};
 const purposeId=(plan,value)=>{const text=String(value||'').trim();const found=(plan.savingPurposes||[]).find(p=>p.id===text||p.name===text);return found?.id||text};
 function ensure(plan){
  plan.savingPurposes=Array.isArray(plan.savingPurposes)?plan.savingPurposes:[];
  const names=new Set(plan.savingPurposes.map(p=>p.name));
  for(const e of plan.events||[]){const name=String(e.savingGroup||e.fundingPurpose||'').trim();if(name&&!names.has(name)){plan.savingPurposes.push({id:'purpose-'+Date.now()+'-'+plan.savingPurposes.length,name,initialBalance:0,color:'#9b6bc3',note:''});names.add(name)}}
  return plan.savingPurposes;
 }
 function migrateLegacy(plan){
  ensure(plan);let changed=false;
  for(const e of plan.events||[]){
   if(e.savingRole==='annual'&&!e.eventType){e.eventType='sinking';changed=true}
   if(e.eventType==='sinking'){
    e.flow='expense';e.savingRole='annual';
    if(e.savingPurchaseAmount&&e.savingPurchaseYears&&n(e.expense)!==n(e.savingPurchaseAmount)/Math.max(1,n(e.savingPurchaseYears)))e.expense=n(e.savingPurchaseAmount)/Math.max(1,n(e.savingPurchaseYears));
    e.interval=1;e.endYear||=n(plan.startYear)+n(plan.horizon)-1;
   }
  }
  if(n(plan.reserveSchemaVersion)<3){plan.reserveSchemaVersion=3;changed=true}
  return changed;
 }
 function build(plan){
  const purposes=ensure(plan),start=year(plan.startYear),h=Math.max(1,Math.min(80,year(plan.horizon)||40));
  const groups=purposes.map(p=>({id:p.id,name:p.name,color:p.color||'#9b6bc3',note:p.note||'',events:[],rows:[],monthlyGuide:0,initialBalance:Math.max(0,n(p.initialBalance))}));
  for(const g of groups){let balance=g.initialBalance;for(let i=0;i<h;i++){const y=start+i;let setAside=0,purchase=0;for(const [index,e] of (plan.events||[]).entries()){
    if(!e.enabled)continue;
    if(e.eventType==='sinking'&&purposeId(plan,e.savingGroup)===g.id&&active(e,y)){setAside+=Math.max(0,n(e.expense));if(!g.events.some(x=>x.index===index))g.events.push({index,name:e.name||'積立',role:'annual',cost:n(e.expense),firstYear:year(e.startYear),enabled:true})}
    if(e.eventType!=='sinking'&&e.flow!=='income'&&purposeId(plan,e.fundingPurpose)===g.id&&active(e,y)){purchase+=Math.max(0,n(e.expense));if(!g.events.some(x=>x.index===index))g.events.push({index,name:e.name||'購入',role:'purchase',cost:n(e.expense),firstYear:year(e.startYear),interval:year(e.interval),enabled:true})}
   }balance+=setAside-purchase;g.rows.push({year:y,setAside,purchase,balance});}
   g.monthlyGuide=g.rows.reduce((s,r)=>s+r.setAside,0)/Math.max(1,h)/12;
  }
  return groups;
 }
 function balancesForYears(plan){const groups=build(plan);return Array.from({length:Math.max(1,Math.min(80,year(plan.horizon)||40))},(_,i)=>{const balances={};let total=0;for(const g of groups){const value=n(g.rows[i]?.balance);balances[g.id]=value;total+=value}return {year:year(plan.startYear)+i,total,balances}})}
 return {build,ensure,migrateLegacy,balancesForYears,purposeId};
})();

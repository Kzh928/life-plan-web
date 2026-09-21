// 用途別の取り分け記録。実際の現金・投資残高には加減算しない。
window.PlanReserve=(()=>{
 const n=x=>Number(String(x??0).replaceAll(',',''))||0;
 const positive=x=>Math.max(0,n(x));
 const year=x=>Math.floor(n(x));
 function schedule(plan){
  const start=year(plan.startYear),h=Math.max(1,Math.min(80,year(plan.horizon)||40));
  const fiscal=4;
  const firstMonth=fiscal;
  const months=[];
  for(let k=0;k<h;k++){
   const sequence=Array.from({length:12},(_,i)=>(fiscal-1+i)%12+1);
   const selected=k===0&&fiscal!==1?sequence.slice(Math.max(0,sequence.indexOf(firstMonth))):sequence;
   for(const month of selected)months.push({year:start+k,month});
  }
  return months;
 }
 function occurs(cell,from,to,period,oneOff){
  return oneOff?cell.year===from:cell.year>=from&&cell.year<=to&&(cell.year-from)%period===0;
 }
 function selectedMonth(value,fiscal){return n(value)>=1&&n(value)<=12?n(value):(fiscal===1?12:3)}
 function migrateLegacy(plan){
  if(n(plan.reserveSchemaVersion)>=2)return false;
  let changed=false;
  for(const e of plan.events||[]){
   const label=String(e.name||'').replace(/[０-９]/g,c=>String(c.charCodeAt(0)-65296));
   const years=Number(label.match(/(\d{1,2})\s*年/)?.[1]);
   const statedCost=Number(label.match(/(\d+(?:\.\d+)?)\s*万/)?.[1])*10000;
   const matchesTotal=Number.isFinite(statedCost)&&Math.abs(statedCost-positive(e.expense)*years)<1;
   if(e.savingRole||!String(e.savingGroup||'').trim()||year(e.interval)!==1||!positive(e.expense)||!years||years>40||!(label.includes('積立')||matchesTotal))continue;
   e.savingRole='annual';e.savingPurchaseYears=years;
   e.savingPurchaseAmount=positive(e.expense)*years;
   e.savingFirstPurchaseYear=year(e.startYear)+years;
   e.savingPurchaseMonth=0;
   changed=true;
  }
  plan.reserveSchemaVersion=2;
  return changed;
 }
 function build(plan){
  const months=schedule(plan),groups=new Map(),events=plan.events||[];
  const fiscal=4;
  for(const [index,e] of events.entries()){
   const name=String(e.savingGroup||'').trim(),cost=positive(e.expense);
   if(!name||!cost)continue;
   if(!groups.has(name))groups.set(name,{name,events:[],rows:[],monthlyGuide:0});
   const group=groups.get(name),role=e.savingRole==='annual'?'annual':'purchase';
   const from=year(e.startYear),to=year(e.endYear),interval=year(e.interval);
   const oneOff=!interval||!to,eventMonth=fiscal;
   let contributionCount=0,purchaseCount=0;
   if(role==='annual'){
    for(let i=0;i<months.length;i++){
     const cell=months[i];
     if(occurs(cell,from,to,interval,oneOff)&&cell.month===eventMonth){
      (group.rows[i]||={setAside:0,purchase:0}).setAside+=cost;
      contributionCount++;
     }
    }
    const cycle=Math.max(1,year(e.savingPurchaseYears)||10);
    const first=year(e.savingFirstPurchaseYear)||from+cycle;
    const purchaseCost=positive(e.savingPurchaseAmount)||cost*cycle;
    const purchaseMonth=fiscal;
    for(let i=0;i<months.length;i++){
     const cell=months[i];
     if(cell.year<first||to&&cell.year>to+1||(cell.year-first)%cycle!==0||cell.month!==purchaseMonth)continue;
     (group.rows[i]||={setAside:0,purchase:0}).purchase+=purchaseCost;
     purchaseCount++;
    }
    group.monthlyGuide+=cost/Math.max(1,interval||1)/12;
    group.events.push({index,name:e.name||'名前のないイベント',role,cost,interval,firstYear:from,enabled:!!e.enabled,
     dueCount:purchaseCount,contributionCount,purchaseCost,cycle,firstPurchaseYear:first});
   }else{
    const due=[];
    for(let i=0;i<months.length;i++){
     const cell=months[i];
     if(occurs(cell,from,to,interval,oneOff)&&cell.month===eventMonth)due.push(i);
    }
    let previous=-1;
    for(const at of due){
     const monthly=cost/(at-previous);
     for(let i=previous+1;i<=at;i++)(group.rows[i]||={setAside:0,purchase:0}).setAside+=monthly;
     group.rows[at].purchase+=cost;
     previous=at;
    }
    if(due.length)group.monthlyGuide+=cost/(due[0]+1);
    group.events.push({index,name:e.name||'名前のないイベント',role,cost,interval,firstYear:from,enabled:!!e.enabled,dueCount:due.length});
   }
  }
  return [...groups.values()].map(group=>{
   let balance=0;
   const byYear=[];
   for(let i=0;i<months.length;i++){
    const row=group.rows[i]||{setAside:0,purchase:0};
    balance+=row.setAside-row.purchase;
    if(!byYear.length||byYear.at(-1).year!==months[i].year)byYear.push({year:months[i].year,setAside:0,purchase:0,balance:0});
    const annual=byYear.at(-1);annual.setAside+=row.setAside;annual.purchase+=row.purchase;annual.balance=balance;
   }
   group.rows=byYear;return group;
  });
 }
 return {build,migrateLegacy};
})();

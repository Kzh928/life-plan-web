// 用途別の「積立メモ」。現金・投資残高には加減算しない。
window.PlanReserve=(()=>{
 const n=x=>Number(String(x??0).replaceAll(',',''))||0;
 function schedule(plan){
  const start=Math.floor(n(plan.startYear)),h=Math.max(1,Math.min(80,Math.floor(n(plan.horizon)||40))),fiscal=n(plan.fiscalStartMonth)===1?1:4;
  const firstMonth=Math.max(1,Math.min(12,n(plan.firstYearStartMonth)||fiscal));
  const months=[];
  for(let k=0;k<h;k++){
   const year=start+k,sequence=Array.from({length:12},(_,i)=>(fiscal-1+i)%12+1);
   const selected=k===0&&fiscal!==1?sequence.slice(Math.max(0,sequence.indexOf(firstMonth))):sequence;
   for(const month of selected)months.push({year,month});
  }
  return months;
 }
 function build(plan){
  const months=schedule(plan),groups=new Map(),allEvents=plan.events||[];
  for(const [index,e] of allEvents.entries()){
   const group=String(e.savingGroup||'').trim(),cost=Math.max(0,n(e.expense));
   if(!group||!cost)continue;
   if(!groups.has(group))groups.set(group,{name:group,events:[],rows:[],monthlyGuide:0});
   const g=groups.get(group),period=Math.floor(n(e.interval)),from=Math.floor(n(e.startYear)),to=Math.floor(n(e.endYear));
   const oneOff=!period||!to;
   const due=[];
   for(let i=0;i<months.length;i++){
    const cell=months[i];
    if(!(oneOff?cell.year===from:cell.year>=from&&cell.year<=to&&(cell.year-from)%period===0))continue;
    const eventMonth=n(e.month)>=1&&n(e.month)<=12?n(e.month):(n(plan.fiscalStartMonth)===1?12:3);
    if(cell.month===eventMonth)due.push(i);
   }
   g.events.push({index,name:e.name||'名前のないイベント',cost,interval:period,firstYear:from,enabled:!!e.enabled,dueCount:due.length});
   if(!due.length)continue;
   let previous=-1;
   for(const at of due){
    const monthly=cost/(at-previous);
    for(let i=previous+1;i<=at;i++){
     const row=g.rows[i]||={setAside:0,purchase:0,balance:0};
     row.setAside+=monthly;
     if(i===at)row.purchase+=cost;
    }
    previous=at;
   }
   g.monthlyGuide+=cost/(due[0]+1);
  }
  const result=[];
  for(const g of groups.values()){
   let balance=0;
   const byYear=[];
   for(let i=0;i<months.length;i++){
    const row=g.rows[i]||{setAside:0,purchase:0};
    balance=Math.max(0,balance+row.setAside-row.purchase);
    if(!byYear.length||byYear.at(-1).year!==months[i].year)byYear.push({year:months[i].year,setAside:0,purchase:0,balance:0});
    const annual=byYear.at(-1);annual.setAside+=row.setAside;annual.purchase+=row.purchase;annual.balance=balance;
   }
   g.rows=byYear;result.push(g);
  }
  return result;
 }
 return {build};
})();

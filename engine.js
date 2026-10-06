/* 年まとめ・教育費マスタの計算を、編集可能な入力データから再現する計算層。 */
window.PlanEngine=(()=>{
 const n=x=>Number.isFinite(Number(x))?Number(x):0;const fiscalStart=()=>4;const calendarYear=(label,month)=>label+(month<4?1:0);
 const sorted=a=>[...(a||[])].sort((x,y)=>n(x.startYear)-n(y.startYear));
 const stage=(list,year,fallback)=>{let v=fallback;for(const x of sorted(list))if(n(x.startYear)<=year)v=x;return v};
 function parentIncome(p,year,plan){if(!p)return {amount:0,gross:null,retirementNet:0,mode:'未設定',entered:false};const first=Object.keys(p.patterns||{})[0]||'働き方1',selected=stage(p.stages,year,{mode:first}),mode=selected.mode||first,r=p.patterns?.[mode]?.years?.[String(year)];const noIncome=['専業主婦','無収入'].includes(mode);return {amount:noIncome?0:n(r?.net),gross:r?.gross??null,retirementNet:n(r?.retirementNet),mode,entered:noIncome||r?.net!==null&&r?.net!==undefined&&r?.net!==''}}
 function childCost(child,year,master,masterOverrides={}){const age=year-n(child.birthYear);if(age<0||age>24)return {age,amount:0,base:0,school:0,tuition:0,scholarship:0,parts:[]};const row=master.ages[String(age)]||{},choices=child.choices||{},parts=[],over=masterOverrides[String(age)]||{};let base=n(over['基本生活費']??row['基本生活費']);for(const label of Object.values(choices)){if(label&&label!=='なし'&&label!=='院/なし'){let cost=n(over[label]??row[label]);if(child.overrides&&child.overrides[label]!==undefined&&child.overrides[label]!=='')cost=n(child.overrides[label]);if(cost){parts.push({name:label,amount:cost});}}}let school=parts.reduce((a,b)=>a+b.amount,0);let tuition=base+school+n(child.extraAnnual);const sch=child.scholarship||{},eligible=age>=n(sch.startAge)&&age<n(sch.startAge)+n(sch.years);const scholarship=eligible?n(sch.annual):0;return {age,amount:Math.max(0,tuition-scholarship),base,school,tuition,scholarship,parts}}
 function annual(plan,master){
 const res=[],start=n(plan.startYear),h=Math.max(1,Math.min(80,n(plan.horizon)||40)),nisaCap=Math.max(0,n(plan.nisaLifetimeCap??36000000)),annualCap=Math.max(0,n(plan.investAnnualCap??7200000));
 let cash=n(plan.initialCash),invest=n(plan.initialInvest),nisaPrincipal=Math.max(0,n(plan.initialNisaPrincipal));
 let nisaValue=plan.initialNisaValue==null||plan.initialNisaValue===''?Math.max(0,invest):Math.min(Math.max(0,invest),Math.max(0,n(plan.initialNisaValue)));
 let pendingRestore=0,unrestoredPrincipal=0;
 const purposes=window.PlanReserve?.ensure(plan)||[],purposeBalances=Object.fromEntries(purposes.map(p=>[p.id,Math.max(0,n(p.initialBalance))]));
 const purposeId=value=>window.PlanReserve?.purposeId(plan,value)||String(value||'');
 const occurs=(e,year)=>{const from=n(e.startYear),to=n(e.endYear)||from,period=n(e.interval)||0;return (!period||!n(e.endYear))?year===from:year>=from&&year<=to&&(year-from)%period===0};
 for(let i=0;i<h;i++){
  const year=start+i,periodFactor=1,nisaRestored=pendingRestore;
  pendingRestore=0;
  const previousNisaValue=nisaValue,previousNisaPrincipal=nisaPrincipal;
  const raw1=parentIncome(plan.parents?.[0],year,plan),raw2=parentIncome(plan.parents?.[1],year,plan),p1={...raw1,amount:raw1.amount},p2={...raw2,amount:raw2.amount},baseIncome=p1.amount+p2.amount;
  let eventIncome=0,eventExpense=0,reserveSetAside=0,reservePurchase=0,reserveShortfall=0,events=[];
  const purposeActivity={};
  for(const e of plan.events||[]){
   const isSinking=e.eventType==='sinking'||e.savingRole==='annual',from=n(e.startYear),to=n(e.endYear)||from;
   if(!e.enabled||!isSinking||year<from||year>to)continue;
   const id=purposeId(e.savingGroup),amount=window.PlanReserve?.annualAmount(e)??Math.max(0,n(e.expense))/Math.max(1,n(e.interval)||1);
   if(id){purposeBalances[id]=n(purposeBalances[id])+amount;reserveSetAside+=amount;(purposeActivity[id]||={setAside:0,purchase:0,shortfall:0}).setAside+=amount}
   let automaticPurchase=0;
   if(id&&window.PlanReserve?.sinkingPurchaseDue(e,year)){
    automaticPurchase=Math.max(0,n(e.expense));const available=Math.max(0,n(purposeBalances[id])),used=Math.min(available,automaticPurchase),short=Math.max(0,automaticPurchase-used);purposeBalances[id]=available-used;reservePurchase+=used;reserveShortfall+=short;eventExpense+=automaticPurchase;const row=purposeActivity[id]||={setAside:0,purchase:0,shortfall:0};row.purchase+=used;row.shortfall+=short;
   }
   events.push({...e,income:0,expense:automaticPurchase,reserveSetAside:amount,automaticPurchase});
  }
  for(const e of plan.events||[]){
   if(!e.enabled||!occurs(e,year)||e.eventType==='sinking'||e.savingRole==='annual')continue;
   eventIncome+=n(e.income);eventExpense+=n(e.expense);events.push(e);
   const id=purposeId(e.fundingPurpose);
   if(id&&n(e.expense)>0){const available=Math.max(0,n(purposeBalances[id])),used=Math.min(available,n(e.expense)),short=Math.max(0,n(e.expense)-used);purposeBalances[id]=available-used;reservePurchase+=used;reserveShortfall+=short;const row=purposeActivity[id]||={setAside:0,purchase:0,shortfall:0};row.purchase+=used;row.shortfall+=short}
  }
  eventIncome+=raw1.retirementNet+raw2.retirementNet;
  const exp=stage(plan.expenseStages,year,{profileId:'A'}),profile=(plan.expenseProfiles||{})[exp.profileId]||[];let living=0;for(const item of profile)living+=(n(item.monthly)*12+n(item.annual))*(item.inflation?Math.pow(1+n(plan.inflation)/100,i):1);
  const home=stage(plan.housingStages,year,{profileId:'A'}),housingProfile=(plan.housingProfiles||{})[home.profileId]||{},housing=n(housingProfile.monthly)*12+n(housingProfile.annual);
  const children=(plan.children||[]).map(c=>{const cost=childCost(c,year,master,plan.masterOverrides);return {name:c.name,...cost,parts:cost.parts.map(part=>({...part}))}}),education=children.reduce((a,c)=>a+c.amount,0);
  const totalIncome=baseIncome+eventIncome,totalExpense=living+housing+eventExpense+education,actualNet=totalIncome-totalExpense,budgetNet=actualNet-reserveSetAside;
  const trigger=plan.drawdownType==='0円'?0:plan.drawdownType==='手入力金額'?n(plan.drawdownAmount):n(plan.reserve),previousCash=cash,previousInvest=invest,preCash=cash+actualNet,withdraw=Math.min(Math.max(0,trigger-preCash),Math.max(0,invest));
  const purposeReserveTotal=Object.values(purposeBalances).reduce((a,b)=>a+Math.max(0,n(b)),0),accounts=Array.isArray(plan.investmentAccounts)&&plan.investmentAccounts.length?plan.investmentAccounts:null,annualBase=n(plan.annualContribution),requestedNisa=accounts?accounts.filter(a=>a.nisa).reduce((sum,a)=>sum+n(a.monthlyContribution)*12,0):annualBase,requestedOther=accounts?accounts.filter(a=>!a.nisa).reduce((sum,a)=>sum+n(a.monthlyContribution)*12,0):0,remainingNisa=Math.max(0,nisaCap-nisaPrincipal-unrestoredPrincipal),allowedNisa=Math.min(requestedNisa,annualCap,remainingNisa),desiredBase=requestedOther+allowedNisa,possible=Math.max(0,preCash-n(plan.reserve)-purposeReserveTotal),normal=Math.min(desiredBase,possible),normalNisa=desiredBase?normal*allowedNisa/desiredBase:0,extraCapacity=Math.max(0,preCash-normal-n(plan.investTrigger)-purposeReserveTotal),extraNisa=accounts?0:Math.min(extraCapacity,Math.max(0,annualCap-normalNisa),Math.max(0,remainingNisa-normalNisa)),contribution=normal+extraNisa,nisaContribution=normalNisa+extraNisa;
  // 年初残高の割合で売却．損失時には売却元本が受取額より大きくなる．
  const nisaWithdraw=previousInvest>0?withdraw*previousNisaValue/previousInvest:0;
  const nisaWithdrawPrincipal=previousNisaValue>0?previousNisaPrincipal*Math.min(1,nisaWithdraw/previousNisaValue):0;
  const nisaWithdrawProfit=nisaWithdraw-nisaWithdrawPrincipal;
  cash=preCash-contribution+withdraw;
  nisaPrincipal=Math.max(0,previousNisaPrincipal-nisaWithdrawPrincipal+nisaContribution);
  if(plan.nisaRestoreTiming==='none')unrestoredPrincipal+=nisaWithdrawPrincipal;
  else pendingRestore=nisaWithdrawPrincipal;
  const gain=(previousInvest+(contribution-withdraw)/2)*n(plan.returnRate)/100;
  const nisaGain=(previousNisaValue+(nisaContribution-nisaWithdraw)/2)*n(plan.returnRate)/100;
  invest=Math.max(0,previousInvest+contribution-withdraw+gain);
  nisaValue=Math.max(0,previousNisaValue+nisaContribution-nisaWithdraw+nisaGain);
  const nisaProfit=nisaValue-nisaPrincipal,nisaUsedPrincipal=nisaPrincipal+unrestoredPrincipal+pendingRestore;
  const freeCash=cash-purposeReserveTotal;
  res.push({year,age:n(plan.baseAge)+i,parent1:p1,parent2:p2,baseIncome,eventIncome,totalIncome,living,housing,eventExpense,education,totalExpense,actualNet,net:budgetNet,reserveSetAside,reservePurchase,reserveShortfall,purposeActivity,purposeBalances:{...purposeBalances},purposeReserveTotal,freeCash,contribution,nisaContribution,withdraw,gain,nisaPrincipal,nisaValue,nisaProfit,nisaWithdraw,nisaWithdrawPrincipal,nisaWithdrawProfit,nisaRestored,nisaRestoreNextYear:pendingRestore,nisaUsedPrincipal,nisaCap,nisaAnnualCap:annualCap,nisaRemaining:Math.max(0,nisaCap-nisaUsedPrincipal),nisaRemainingNextYear:Math.max(0,nisaCap-nisaPrincipal-unrestoredPrincipal),cash,invest,assets:cash+invest,events,children,previousCash,previousInvest,expenseProfile:exp.profileId,housingProfile:home.profileId});
 }
 return res}
 function monthlyShortfall(plan,years){let cash=n(plan.initialCash),invest=n(plan.initialInvest),first=null,byMonth=[];for(const y of years){const fs=4,sequence=Array.from({length:12},(_,i)=>(fs-1+i)%12+1),divisor=12;for(const m of sequence){const key=`${calendarYear(y.year,m,fs)}-${String(m).padStart(2,'0')}`;let income=y.baseIncome/divisor+(y.eventIncome-y.events.reduce((s,e)=>s+n(e.income),0))/divisor,expense=(y.living+y.housing+y.education)/divisor;for(const e of y.events){income+=n(e.income)/divisor;expense+=n(e.expense)/divisor}expense+=n(y.applianceExpense)/divisor;
 cash+=income-expense-y.contribution/divisor;
 if(cash<n(plan.reserve)&&invest>0){const w=Math.min(invest,Math.max(0,n(plan.reserve)-cash));cash+=w;invest-=w}
 invest+=y.contribution/divisor;invest*=Math.pow(Math.max(0,1+n(plan.returnRate)/100),1/12);
 if(cash<0&&!first)first=key;byMonth.push({key,cash,invest});}}
 return {first,months:byMonth}}
 return {annual,monthlyShortfall,parentIncome,childCost};
})();


const a=require('node:assert/strict'),U=require('../core.js'),X=require('../patterns.js');require('../scenarios.js');
const n=U.notebook({start:'2026-04',cash:1000000,invest:200000,reserve:50000}),p=n.plans[n.activePlan];p.years=3;p.returnRate=5;
const rule=(id,kind,amount,owner)=>({id,name:id,kind,owner,amount,start:n.start,end:'',changes:[],annualYears:{}});
p.rules=[rule('self','income',300000,'self'),rule('partner','income',200000,'partner'),{...rule('home','expense',100000),group:'住居'},rule('food','expense',50000),rule('nisa','invest',20000),{...rule('saving','reserve',1000),fundId:'appliance'}];
n.purposes=[{id:'appliance',name:'家電',initial:50000}];
p.events=[{id:'trip',name:'旅行',kind:'expense',month:'2026-06',amount:50000,every:12},{id:'fridge',name:'家電',kind:'expense',month:'2026-04',amount:120000,every:120,sinking:true,deposit:1000,enabled:true,fundId:'appliance'}];
p.children=[{id:'child',name:'子ども',birthYear:2026,annual:120000,useMaster:false,years:{}}];p.masterOverrides={'6':{'小学校/公立':200000}};
p.investment={annualCap:300000,lifetimeCap:10000000,restore:'nextYear',drawdown:false,cashFloor:10000};p.budgets={2026:{at:'baseline',months:{'2026-04':{income:450000,expense:200000}}}};
p.overrides={'2026-05':{'rule:self':301000,'rule:partner':201000,'event:fridge':50000,'child:child':11000,'rule:nisa':21000}};
n.actuals['2026-04']={status:'closed',values:{'rule:self':{name:'本人',kind:'income',amount:290000,entered:true},'rule:partner':{name:'パートナー',kind:'income',amount:190000,entered:true}}};
const state=U.fresh(n);X.normalize(state);const oldIncome=p.categorySelections.income,oldCouple=X.categories.copySource(n,'income',oldIncome,'共働き以外');oldCouple.rules.find(r=>r.owner==='partner').amount=0;
const b=U.branch(n,'B');X.categories.adopt(n,b,'income',oldCouple.id);const aRows=U.forecast(n,p),bRows=U.forecast(n,b),actuals=U.C(n.actuals);
const C=require('../all-sources.js');X.normalize(state);a.equal(n.catalogVersion,2);a.equal(C.types.length,9);a.deepEqual(U.forecast(n,p),aRows,'A migration is lossless');a.deepEqual(U.forecast(n,b),bRows,'B migration is lossless');
a.equal(U.record(n,p,'2026-06').planned.income,500000);a.equal(U.record(n,b,'2026-06').planned.income,300000);
// Each owner can independently choose their future income.
const selfAlt=C.copySource(n,'selfIncome',p.categorySelections.selfIncome,'本人の転職');let d=C.draft(n,p,'selfIncome',selfAlt.id);d.rules.find(r=>r.id==='self').amount=400000;C.captureSource(n,'selfIncome',selfAlt.id,d);
a.equal(U.record(n,p,'2026-06').planned.income,500000,'copy/edit is not adoption');C.adopt(n,p,'selfIncome',selfAlt.id);a.equal(U.record(n,p,'2026-06').planned.income,600000);a.equal(U.record(n,b,'2026-06').planned.income,300000);
const partnerAlt=n.categoryCatalog.partnerIncome.find(q=>q.name==='共働き以外');C.adopt(n,p,'partnerIncome',partnerAlt.id);a.equal(U.record(n,p,'2026-06').planned.income,400000);a.equal(p.rules.find(r=>r.id==='self').amount,400000,'partner selection leaves self selection unchanged');
const mutants={
 events:d=>{d.events.find(e=>e.id==='trip').month='2026-07';},
 children:d=>{d.children[0].annual=240000;d.masterOverrides={'6':{'小学校/公立':300000}};},
 funds:d=>{d.rules.find(r=>r.id==='saving').amount=2000;d.events.find(e=>e.id==='fridge').deposit=2000;},
 investment:d=>{d.rules.find(r=>r.id==='nisa').amount=30000;d.returnRate=8;d.investment.annualCap=400000;},
 budget:d=>{d.budgets[2026].months['2026-04'].income=550000;}
};
for(const[type,mutate]of Object.entries(mutants)){const original=p.categorySelections[type],q=C.copySource(n,type,original,type+'の別案'),before=JSON.stringify(C.extract(p,type));d=C.draft(n,p,type,q.id);mutate(d);C.captureSource(n,type,q.id,d);a.equal(JSON.stringify(C.extract(p,type)),before,type+' edit does not adopt');C.adopt(n,p,type,q.id);a.notEqual(p.categorySelections[type],b.categorySelections[type],type+' selections independent');}
a.equal(p.events.find(e=>e.id==='trip').month,'2026-07');a.equal(b.events.find(e=>e.id==='trip').month,'2026-06');a.equal(p.events.find(e=>e.id==='fridge').deposit,2000);a.equal(b.events.find(e=>e.id==='fridge').deposit,1000);
a.equal(p.children[0].annual,240000);a.equal(b.children[0].annual,120000);a.equal(p.returnRate,8);a.equal(b.returnRate,5);a.equal(p.budgets[2026].months['2026-04'].income,550000);a.equal(b.budgets[2026].months['2026-04'].income,450000);a.deepEqual(n.actuals,actuals);
const output=U.valid(JSON.parse(JSON.stringify(U.exportData(state))));X.normalize(output);C.applyAll(output.notebooks[n.id]);a.deepEqual(U.forecast(output.notebooks[n.id],output.notebooks[n.id].plans[p.id]),U.forecast(n,p));
for(const change of [s=>s.notebooks[n.id].plans[p.id].categorySelections.children='missing',s=>s.notebooks[n.id].categoryCatalog.partnerIncome[0].rules[0].owner='self',s=>s.notebooks[n.id].categoryCatalog.investment[0].returnRate=200,s=>s.notebooks[n.id].categoryCatalog.budget[0].budgets={oops:null}]){const bad=U.C(state);change(bad);a.throws(()=>U.valid(bad));}
console.log('PASS nine independent source types: lossless v4=4 migration with differing couple scenarios, separate owner incomes, events/months, children/master, earmarked saving/purchases, investment rate/caps/contributions, original budgets, no accidental adoption, common actuals and complete JSON roundtrip/validation');

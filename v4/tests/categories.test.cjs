const a=require('node:assert/strict'),U=require('../core.js'),X=require('../patterns.js');
// Simulate a saved v4=3 file before loading the new category module.
const n=U.notebook({start:'2026-04',cash:100000,invest:200000,reserve:30000}),p=n.plans[n.activePlan];p.name='プランA';p.years=3;
const rule=(id,kind,amount,patternType)=>({id,name:id,kind,amount,start:n.start,end:'',changes:[],annualYears:{},...(patternType?{patternType,patterns:[{id:id+'one',name:'基本',monthly:amount,annual:0}],patternStages:[{id:id+'stage',month:n.start,patternId:id+'one'}]}:{})});
p.rules=[rule('salary','income',300000),rule('home','expense',80000,'housing'),rule('other','expense',5000)];
p.events=[{id:'trip',name:'旅行',kind:'expense',month:'2027-05',amount:60000,every:12}];
p.overrides={'2027-04':{'rule:salary':301000,'rule:home':81000,'rule:other':6000}};
n.actuals['2026-04']={status:'closed',values:{'rule:salary':{kind:'income',amount:290000,name:'収入',entered:true}}};
const state=U.fresh(n);X.normalize(state);const originalIncome=p.activeIncomeScenario;
const oldAlternative=X.copyIncome(p,'時短');p.rules.find(r=>r.id==='salary').amount=150000;X.normalize(state);X.switchIncome(p,originalIncome);X.normalize(state);
const b=U.branch(n,'プランB');X.normalize(state);const beforeA=U.forecast(n,p),beforeB=U.forecast(n,b);
const C=require('../scenarios.js');X.normalize(state);a.deepEqual(U.forecast(n,p),beforeA,'migration preserves all A values');a.deepEqual(U.forecast(n,b),beforeB,'migration preserves all B values');a.equal(n.categoryCatalog.income.length,2,'identical copied libraries deduplicated');a.equal(n.categoryCatalog.housing.length,1);a(!p.incomeScenarios);a.equal(p.categorySelections.income,b.categorySelections.income);
const incomeA=p.categorySelections.income,housingA=p.categorySelections.housing,alternative=n.categoryCatalog.income.find(q=>q.name==='時短');
const incomeClone=C.copySource(n,'income',incomeA,'専業案'),housingClone=C.copySource(n,'housing',housingA,'住居b');
a.equal(p.categorySelections.income,incomeA,'creating a source does not adopt it');a.equal(b.categorySelections.housing,housingA);
const draft=C.draft(n,p,'housing',housingClone.id);draft.rules[0].patterns[0].monthly=120000;draft.overrides['2027-04']['rule:home']=121000;C.captureSource(n,'housing',housingClone.id,draft);
a.equal(U.record(n,p,'2026-05').planned.expense,85000,'editing an unadopted source does not change A');
C.adopt(n,p,'housing',housingClone.id);C.adopt(n,p,'income',alternative.id);
a.equal(U.record(n,p,'2026-05').planned.income,150000);a.equal(U.record(n,p,'2026-05').planned.expense,125000);
a.equal(U.record(n,b,'2026-05').planned.income,300000);a.equal(U.record(n,b,'2026-05').planned.expense,85000,'B choices remain independent');
a.equal(U.record(n,p,'2026-04').used.income,290000);a.equal(U.record(n,b,'2026-04').used.income,290000,'actuals remain shared');
// Same source can be adopted by any whole plan; shared edits propagate to its users only.
C.adopt(n,b,'housing',housingClone.id);draft.rules[0].patterns[0].monthly=130000;C.captureSource(n,'housing',housingClone.id,draft);
a.equal(U.record(n,p,'2026-05').planned.expense,135000);a.equal(U.record(n,b,'2026-05').planned.expense,135000);
C.adopt(n,b,'housing',housingA);a.equal(U.record(n,b,'2027-04').planned.expense,87000);a.equal(U.record(n,p,'2027-04').planned.expense,127000,'overrides scoped to category source');
const c=U.branch(n,'プランC');a.deepEqual(c.categorySelections,b.categorySelections);a.equal(n.categoryCatalog.housing.length,2,'whole-plan copies do not copy the source library');C.adopt(n,c,'income',incomeClone.id);a.equal(b.categorySelections.income,incomeA);
const restored=U.valid(JSON.parse(JSON.stringify(U.exportData(state))));X.normalize(restored);a.deepEqual(restored.notebooks[n.id].plans[p.id].categorySelections,p.categorySelections);
for(const mutate of [s=>s.notebooks[n.id].plans[p.id].categorySelections.housing='missing',s=>s.notebooks[n.id].categoryCatalog.income[0].rules[0].kind='expense',s=>s.notebooks[n.id].categoryCatalog.housing[0].rules[0].patterns[0].monthly=-1]){const bad=U.C(state);mutate(bad);a.throws(()=>U.valid(bad));}
// Different old whole-plan data must stay separate during migration.
const old=U.notebook({start:n.start}),oldP=old.plans[old.activePlan];oldP.rules=[rule('home','expense',100,'housing')];const oldB=U.branch(old,'別条件');oldB.rules[0].patterns[0].monthly=200;const oldState=U.fresh(old);X.normalize(oldState);a.notEqual(oldP.categorySelections.housing,oldB.categorySelections.housing);a.equal(U.record(old,oldP,'2026-05').planned.expense,100);a.equal(U.record(old,oldB,'2026-05').planned.expense,200);
console.log('PASS independent source catalogs: lossless multi-plan v4=3 migration, deduplication without losing differences, source creation/editing does not adopt, income/housing combinations per whole plan, shared edits, shared actuals, scoped overrides, branch references and complete validated JSON');

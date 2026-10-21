const assert=require('node:assert/strict'),U=require('../core.js');require('../patterns.js');require('../scenarios.js');require('../all-sources.js');require('../planning-helpers.js');
const n=U.notebook({start:'2026-10'}),p=n.plans[n.activePlan];p.endYear=2032;
const rule={id:'living',kind:'expense',group:'生活費',name:'生活費の枠',patternType:'living',start:'2026-04',end:'',endedFrom:'2030-05',amount:0,changes:[],annualYears:{},patterns:[{id:'single',name:'一人暮らし',items:[]},{id:'couple',name:'同棲',items:[]},{id:'unused',name:'未使用セット',items:[]}],patternStages:[{id:'before',month:'2026-06',patternId:'single'},{id:'move',month:'2029-02',patternId:'couple'},{id:'same',month:'2029-03',patternId:'couple'}]};
p.rules=[rule,{id:'self',kind:'income',name:'本人給与',owner:'self',start:'2026-04',end:'2028-12',amount:100,changes:[],annualYears:{}},{id:'partner',kind:'income',owner:'partner',name:'パートナー給与',start:'2027-04',amount:50,end:'',changes:[],annualYears:{},patterns:[{id:'part',name:'パート',monthly:50},{id:'full',name:'正社員',monthly:100}],patternType:'income',patternStages:[{id:'fulltime',month:'2031-04',patternId:'full'}]}];
const state=U.fresh(n);U.patterns.normalize(state);let before=JSON.stringify(state),groups=U.planning.adoptedSchedules(n,p),living=groups.find(g=>g.type==='living');assert.equal(groups.length,9);assert.deepEqual(living.rules[0].rows.map(v=>[v.from,v.to,v.name]),[['2026-10','2029-01','一人暮らし'],['2029-02','2030-04','同棲']]);assert(!JSON.stringify(living).includes('未使用セット'));assert.equal(groups.find(g=>g.type==='selfIncome').rules[0].rows[0].to,'2028-12');assert.deepEqual(groups.find(g=>g.type==='partnerIncome').rules[0].rows.map(v=>v.from),['2027-04','2031-04']);assert.equal(groups.find(g=>g.type==='housing').rules.length,0);assert.equal(JSON.stringify(state),before);
// Every visible set must agree with the set actually selected by the calculator.
for(const v of living.rules[0].rows)for(const m of U.months(v.from,v.to))assert.equal(U.patterns.selected(p.rules.find(r=>r.id==='living'),m).id,v.patternId);
// Swapping the adopted source updates the overview without touching the other source.
const base=U.patterns.categories.source(n,p,'living'),alt=U.C(base);alt.id='alternate';alt.name='生活費の別案';alt.rules[0].patterns[0].name='別案の一人暮らし';n.categoryCatalog.living.push(alt);U.patterns.categories.adopt(n,p,'living',alt.id);before=JSON.stringify(state);living=U.planning.adoptedSchedules(n,p).find(g=>g.type==='living');assert.equal(living.sourceName,'生活費の別案');assert.equal(living.rules[0].rows[0].name,'別案の一人暮らし');assert.equal(base.rules[0].patterns[0].name,'一人暮らし');assert.equal(JSON.stringify(state),before);
// Excluded and ended-before-start rules have no effective periods.
p.rules.find(r=>r.id==='living').active=false;assert.equal(U.planning.adoptedSchedules(n,p).find(g=>g.type==='living').rules[0].rows.length,0);const self=p.rules.find(r=>r.id==='self');self.end='2026-09';assert.equal(U.planning.adoptedSchedules(n,p).find(g=>g.type==='selfIncome').rules[0].rows.length,0);
console.log('PASS adopted schedule overview: exact switch periods, clipping, repeated sets, unused sets, owner separation, adopted alternatives and immutable reads');

// All adopted categories appear in the same order as composition, including dated amounts.
p.events=[{id:'trip',name:'旅行',kind:'expense',month:'2027-06',every:12,amount:30000,enabled:true},{id:'fridge',name:'冷蔵庫',month:'2026-10',every:120,amount:120000,deposit:0,sinking:true,autoPurchase:false,enabled:true}];
p.children=[{id:'child',name:'子ども',birthYear:2027,useMaster:false,annual:10000,years:{2028:25000}}];
p.rules.push({id:'invest',name:'投資積立',kind:'invest',start:'2026-10',amount:10000,changes:[{month:'2028-04',amount:20000}]});
p.budgets={2027:{months:{'2027-04':{income:300000,expense:200000}}}};
groups=U.planning.adoptedSchedules(n,p);
assert.deepEqual(groups.map(g=>g.type),U.patterns.categories.types);
assert.equal(groups.find(g=>g.type==='events').rules[0].rows[0].detail,' ／ 1年ごと');
const saving=groups.find(g=>g.type==='funds').rules.find(r=>r.id==='fridge').rows[0];assert(saving.name.includes('購入なし'));assert(saving.detail.includes('月の積立 0円'));
assert.equal(groups.find(g=>g.type==='children').rules[0].rows.find(v=>v.from==='2028-04').amount,25000);
assert.deepEqual(groups.find(g=>g.type==='investment').rules[0].rows.map(v=>[v.from,v.amount]),[['2026-10',10000],['2028-04',20000]]);
assert(groups.find(g=>g.type==='budget').rules[0].rows[0].name.includes('支出 200,000円'));
console.log('PASS all nine categories: events, zero-deposit savings, child yearly overrides, investment changes and saved monthly budgets');

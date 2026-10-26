const assert=require('node:assert/strict'),U=require('../core.js');require('../patterns.js');require('../record-ui.js');const I=require('../item-inspector.js');
const n=U.notebook({start:'2026-04'}),p=n.plans[n.activePlan];p.rules=[{id:'food',name:'食費',kind:'expense',group:'生活費',subgroup:'食費',start:n.start,end:'',amount:100,changes:[],annualYears:{}}];
n.actuals['2026-04']={status:'draft',values:{'rule:food':{kind:'expense',amount:50,entered:true}}};n.actuals['2026-06']={status:'closed',values:{}};
const before=JSON.stringify(n),d=I.collect(n,p,'2026-04','2026-06'),r=I.series(d,['item:rule:food'],'actual')[0];assert.deepEqual(r.points.map(p=>p.value),[50,null,null]);assert.equal(r.average,50);assert.equal(r.count,1);assert.equal(r.sum,50);assert.equal(I.series(d,['item:rule:food'],'planned')[0].average,100);
assert.equal(I.series(d,['group:'+JSON.stringify(['支出','生活費','食費'])],'actual')[0].average,50);assert.equal(JSON.stringify(n),before);
p.rules.push({...p.rules[0],id:'other',name:'もう一つ'});const incomplete=I.collect(n,p,'2026-04','2026-04');assert.equal(I.series(incomplete,['group:'+JSON.stringify(['支出'])],'actual')[0].count,1);assert.equal(I.series(incomplete,['item:rule:food'],'actual')[0].sum,50);
console.log('PASS item comparison: exact IDs, group/leaf separation, missing vs zero, partial-group inclusion, planned mode and no mutation');

const partial=I.series(incomplete,['group:'+JSON.stringify(['支出'])],'actual')[0];assert.equal(partial.sum,50);assert.equal(partial.points[0].partial,true);assert.equal(partial.points[0].known,1);assert.equal(partial.points[0].total,2);
n.actuals['2026-05']={status:'draft',values:{'rule:food':{kind:'expense',amount:0,entered:true}}};assert.equal(I.series(I.collect(n,p,'2026-04','2026-06'),['item:rule:food'],'actual')[0].average,25);

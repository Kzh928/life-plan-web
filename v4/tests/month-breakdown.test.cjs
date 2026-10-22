const assert=require('node:assert/strict'),U=require('../core.js');require('../patterns.js');require('../planning-helpers.js');
const p={rules:[{id:'partner',kind:'income',owner:'partner'},{id:'self',kind:'income',owner:'self'},{id:'home',kind:'expense',patternType:'housing'},{id:'daily',kind:'expense',patternType:'living'}],events:[{id:'anniversary',every:12},{id:'trip',every:0},{id:'fridge',sinking:true,every:120}]};
const rows=[
 {id:'invest',kind:'invest',amount:-50},
 {id:'recurring',sourceId:'anniversary',source:'event',kind:'expense',amount:10},
 {id:'allowance',sourceId:'daily',name:'おこづかい / 本人',kind:'expense',amount:20},
 {id:'partner-pay',sourceId:'partner',source:'rule',kind:'income',amount:200},
 {id:'home',sourceId:'home',source:'rule',kind:'expense',amount:100},
 {id:'child',source:'child',kind:'expense',amount:30},
 {id:'self-pay',sourceId:'self',source:'rule',kind:'income',amount:300},
 {id:'saving',kind:'reserve',amount:40},
 {id:'purchase',sourceId:'fridge',source:'event',kind:'expense',useReserve:true,amount:60},
 {id:'trip',sourceId:'trip',source:'event',kind:'expense',amount:70},
 {id:'bonus',sourceId:'self',group:'賞与',source:'rule',kind:'income',amount:80},
 {id:'transport',sourceId:'daily',name:'交通費 / 電車',kind:'expense',amount:5},
 {id:'food',sourceId:'daily',name:'食費 / 家',kind:'expense',amount:15},
 {id:'manual',source:'manual',group:'住居',kind:'expense',amount:0}
];
const before=JSON.stringify({p,rows}),groups=U.planning.monthBreakdown(rows,p),flat=groups.flatMap(g=>g.items);
assert.deepEqual(groups.map(g=>g.key),['self','partner','special','housing','living','children','once','repeat','purchase','reserve','invest']);
assert.deepEqual(groups.find(g=>g.key==='living').items.map(i=>i.id),['food','transport','allowance']);
assert.equal(groups.find(g=>g.key==='living').total,40);assert.equal(groups.find(g=>g.key==='invest').total,-50);
assert.deepEqual(U.vector(flat),U.vector(rows));assert.equal(flat.length,rows.length);assert.equal(new Set(flat.map(i=>i.id)).size,rows.length);assert.equal(JSON.stringify({p,rows}),before);
assert.deepEqual(U.planning.monthBreakdown([],p),[]);
console.log('PASS monthly display: income owners/bonus, housing, living order, children, event genres, savings purchases, transfers; exact totals, no dropped/duplicated items or mutations');

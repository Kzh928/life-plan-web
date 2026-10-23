const assert=require('node:assert/strict'),U=require('../core.js');require('../patterns.js');const {series}=require('../fund-timeline.js');
function fixture(expense,drawdown=false,floor=0){const n=U.notebook({start:'2026-04',cash:0,reserve:100,invest:100}),p=n.plans[n.activePlan];p.endYear=2026;n.purposes=[{id:'a',name:'家電',initial:60},{id:'b',name:'旅行',initial:40}];p.events=[{id:'cost',name:'生活費',kind:'expense',month:n.start,amount:expense,every:0}];p.investment={drawdown,cashFloor:floor};return {n,p};}
{
 const {n,p}=fixture(50,true),before=JSON.stringify(n),r=U.forecast(n,p,{},n.start)[0];
 assert.equal(r.cash,0);assert.equal(r.reserve,50);assert.equal(r.invest,100);assert.equal(r.withdrawal,0);assert.equal(r.reserveWithdraw,50);assert.equal(r.funds.a,30);assert.equal(r.funds.b,20);assert.equal(r.net,-50);assert.equal(r.total,150);assert.equal(r.used.reserve,-50);assert.equal(JSON.stringify(n),before);
 const v=series(n,[r],'all','month')[0];assert.equal(v.withdrawal,50);assert.equal(v.opening+v.deposit-v.paid-v.withdrawal,v.balance);
}
{
 const {n,p}=fixture(150,true),r=U.forecast(n,p,{},n.start)[0];assert.equal(r.reserve,0);assert.equal(r.reserveWithdraw,100);assert.equal(r.withdrawal,50);assert.equal(r.invest,50);assert.equal(r.total,50);assert.equal(r.cash,0);
}
{
 const {n,p}=fixture(250,false),r=U.forecast(n,p,{},n.start)[0];assert.equal(r.reserve,0);assert.equal(r.cash,-150);assert.equal(r.invest,100);assert.equal(r.total,-50);
}
{
 const {n,p}=fixture(0,true,80),r=U.forecast(n,p,{},n.start)[0];assert.equal(r.cash,80);assert.equal(r.reserve,20);assert.equal(r.withdrawal,0);assert.equal(r.total,200);
}
{
 const {n,p}=fixture(30,true);n.actuals[n.start]={status:'closed',values:{cost:{id:'cost',name:'実績',kind:'expense',amount:30,entered:true}}};const before=JSON.stringify(n.actuals),r=U.forecast(n,p,{},n.start)[0];assert.equal(r.cash,0);assert.equal(r.reserve,70);assert.equal(r.withdrawal,0);assert.equal(JSON.stringify(n.actuals),before);
}
console.log('PASS reserve cash: proportional purpose use before investment, cash floor, exhausted reserves, exact totals/net/timeline and untouched actual records');

// このテストは，NISAの元本・損益の比例売却と世帯の投資枠を検証します．
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const ctx={window:{}};vm.createContext(ctx);
for(const file of ['engine.js','model.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);
const {PlanEngine:E,PlanModel:M}=ctx.window;
function plan(overrides={}){return Object.assign(M.empty(),{horizon:2,returnRate:0,initialCash:0,initialInvest:1500000,initialNisaPrincipal:1000000,nisaLifetimeCap:1000000,investAnnualCap:7200000,reserve:600000,annualContribution:600000,investTrigger:1e12,events:[{name:'test income',enabled:true,startYear:2027,income:1000000,expense:0}]},overrides)}
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
let rows=E.annual(plan(),{}),first=rows[0],second=rows[1];
near(first.nisaWithdraw,600000);near(first.nisaWithdrawPrincipal,400000);near(first.nisaWithdrawProfit,200000);
near(first.nisaPrincipal,600000);near(first.nisaProfit,300000);near(first.nisaValue,900000);
near(first.nisaRemaining,0);near(first.nisaRestoreNextYear,400000);near(first.nisaRemainingNextYear,400000);
near(second.nisaRestored,400000);near(second.nisaContribution,400000);near(second.nisaPrincipal,1000000);
rows=E.annual(plan({nisaRestoreTiming:'none'}),{});near(rows[1].nisaContribution,0);near(rows[1].nisaRestored,0);
rows=E.annual(plan({initialInvest:500000,initialNisaPrincipal:1000000,reserve:300000}),{});
near(rows[0].nisaWithdrawPrincipal,600000);near(rows[0].nisaWithdrawProfit,-300000);near(rows[0].nisaPrincipal,400000);near(rows[0].nisaProfit,-200000);
rows=E.annual(plan({initialInvest:3000000,initialNisaValue:1500000,reserve:1200000}),{});
near(rows[0].nisaWithdraw,600000);near(rows[0].nisaWithdrawPrincipal,400000);near(rows[0].invest,1800000);near(rows[0].nisaValue,900000);
rows=E.annual(plan({initialCash:10000000,reserve:0,nisaLifetimeCap:5000000,investAnnualCap:100000,annualContribution:1000000}),{});
near(rows[0].nisaContribution,100000);near(rows[1].nisaContribution,100000);
rows=E.annual(plan({initialCash:10000000,reserve:0,nisaLifetimeCap:0}),{});near(rows[0].nisaPrincipal,1000000);near(rows[0].nisaContribution,0);
rows=E.annual(plan({initialNisaPrincipal:2000000}),{});near(rows[0].nisaWithdrawPrincipal,800000);near(rows[0].nisaPrincipal,1200000);
rows=E.annual(plan({reserve:2000000,events:[]}),{});near(rows[0].nisaPrincipal,0);near(rows[0].nisaValue,0);near(rows[0].nisaWithdrawPrincipal,1000000);
for(const row of rows){near(row.invest,row.nisaValue);near(row.nisaValue,row.nisaPrincipal+row.nisaProfit);near(row.assets,row.cash+row.invest)}
rows=E.annual(plan({returnRate:5,reserve:0,initialCash:10000000,nisaLifetimeCap:5000000}),{});
assert(rows[0].nisaProfit>500000);near(rows[0].nisaValue,rows[0].nisaPrincipal+rows[0].nisaProfit);
const legacy=plan();delete legacy.nisaLifetimeCap;delete legacy.investAnnualCap;delete legacy.nisaRestoreTiming;delete legacy.initialNisaValue;
rows=E.annual(legacy,{});near(rows[0].nisaCap,36000000);near(rows[0].nisaAnnualCap,7200000);
console.log('PASS: proportional gain/loss sales, next-year/no restoration, mixed investments, annual/total/zero limits, full liquidation, legacy defaults, balance identities');

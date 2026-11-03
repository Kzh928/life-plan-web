// Check collapsed kind/year navigation without changing salary, bonus or overtime data.
const assert=require('node:assert/strict'),U=require('../core.js');require('../patterns.js');require('../overtime.js');const UI=require('../income-ui.js');
const esc=s=>String(s),money=n=>n+'円',button=(t,a,id)=>`<button data-action="${a}" data-id="${id}">${t}</button>`;
const r={id:'r'},p={id:'p',salaryChanges:[{from:'2026-04',netMonthly:100},{from:'2027-01',netMonthly:110},{from:'2027-04',netMonthly:120}],bonuses:[{id:'b',month:'2027-03',amount:10},{id:'c',month:'2027-07',amount:20}],overtime:{rates:{2026:100},hours:{2026:{mode:'monthly',hours:10}}}};
const before=JSON.stringify(p),h=UI.payroll(r,p,{esc,money,button,year:2026});assert.equal(JSON.stringify(p),before);
for(const title of ['月給','賞与','残業代'])assert(h.includes('<summary>'+title+'</summary>'));
for(const key of ['payroll-salary:r:p','payroll-bonus:r:p','overtime:r:p','salary-year:r:p:2026','salary-year:r:p:2027','bonus-year:r:p:2026','bonus-year:r:p:2027']){assert(h.includes('data-keep="'+key+'"'));assert(!new RegExp('data-keep="'+key+'"[^>]*\\bopen\\b').test(h));}
const salary26=h.split('data-keep="salary-year:r:p:2026"')[1].split('data-keep="salary-year:r:p:2027"')[0];assert(salary26.includes('2027-01から'));assert(!salary26.includes('2027-04から'));
const bonus26=h.split('data-keep="bonus-year:r:p:2026"')[1].split('data-keep="bonus-year:r:p:2027"')[0];assert(bonus26.includes('2027-03'));assert(!bonus26.includes('2027-07'));
for(const a of ['salary-edit','salary-delete','bonus-edit','bonus-delete','bonus-bulk','overtime-import','overtime-hours'])assert(h.includes('data-action="'+a+'"'));
assert(h.includes('前回比 ＋10円'));assert(h.includes('変更のない年度も同額'));
console.log('PASS collapsed income kinds and fiscal years: January/March grouping, cross-year difference, stable edit actions and zero mutation');

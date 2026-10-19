// Exercise UI actions, form submissions and import/export with a minimal DOM, no browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),U=require('../core.js');
require('../patterns.js');
require('../scenarios.js');
require('../all-sources.js');
require('../living-costs.js');
require('../living-ui.js');
require('../income-ui.js');
const elements=new Map(),listeners={},stored=new Map(),status=[];const element=id=>{if(id==='conditionsForm')return null;if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',dataset:{},hidden:false,querySelectorAll:()=>[],querySelector:()=>null,showModal(){this.open=true},close(){this.open=false},addEventListener(type,fn){this[type]=fn;},click(){}});return elements.get(id);};
const document={getElementById:element,querySelectorAll:()=>[],activeElement:{blur(){}},addEventListener:(type,fn)=>listeners[type]=fn,createElement:()=>({click(){}})};
const ctx={window:{MoneyV4:U,EDUCATION_MASTER:{ages:{}},FinanceV4Store:{ready:Promise.resolve(),storage:{getItem:k=>{assert(k.startsWith('finance-v4-'));return stored.get(k)||null},setItem:(k,v)=>stored.set(k,v)},flush:async()=>{},verify:async()=>{},describe:e=>e.message}},document,console,Date,Intl,Map,Set,FormData:class extends Map{constructor(map){super(map)}},Blob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},setTimeout:()=>0,confirm:()=>true};ctx.window.scrollTo=()=>{};vm.createContext(ctx);
function click(action,id){listeners.click({target:{closest:()=>({dataset:{action,id}})}});}
function nav(route){listeners.click({target:{closest:()=>({dataset:{route}})}});}
function change(target){listeners.change({target:{dataset:{},...target}});}
function submit(values){element('editorForm').onsubmit({preventDefault(){},target:Object.entries(values)});assert.equal(element('formError').textContent,'');}
function data(){return JSON.parse(stored.get('finance-v4-state'));}
function current(){const s=data(),n=s.notebooks[s.active];return {s,n,p:n.plans[n.activePlan]};}
(async()=>{await vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8'),ctx);assert(element('app').innerHTML.includes('数字は，まだ何も入っていません'));
click('begin');assert(element('editorFields').innerHTML.includes('name="cash" type="text" data-money inputmode="decimal" value=""'));submit({name:'test',start:'2026-10',cash:'100000',invest:'',reserve:''});assert.equal(current().p.rules.length,0);assert(element('app').innerHTML.includes('この月には，何が入る'));
click('rule-new');submit({name:'給料',kind:'income',group:'給与',amount:'300000',start:'2026-10',end:''});let c=current();assert.equal(c.p.rules[0].amount,300000);
click('event-new');submit({name:'旅行',month:'2026-11',kind:'expense',amount:'50000',every:'0',end:'',enabled:'on'});const eid=current().p.events[0].id;
click('event-edit',eid);submit({name:'旅行',month:'2026-12',kind:'expense',amount:'60000',every:'0',end:'',enabled:'on'});assert.equal(current().p.events[0].month,'2026-12');
nav('record');assert(element('app').innerHTML.includes('給料の実績'));const rid=current().p.rules[0].id;change({dataset:{actual:'rule:'+rid},value:'280000'});c=current();assert.equal(c.n.actuals['2026-10'].values['rule:'+rid].amount,280000);
click('branch');submit({name:'別案'});c=current();assert.equal(Object.keys(c.n.plans).length,2);assert.equal(c.n.actuals['2026-10'].values['rule:'+rid].amount,280000);
nav('outlook');assert(element('app').innerHTML.includes('年度末資産'));click('export');assert(element('saveStatus').textContent.includes('JSON'));
click('begin');submit({name:'empty',start:'2026-10',cash:'',invest:'',reserve:''});c=current();assert.equal(Object.keys(c.s.notebooks).length,2);assert.equal(c.p.rules.length,0);assert.equal(Object.keys(c.n.actuals).length,0);assert.equal(c.n.openingEntered,false);
// Failed import leaves the existing data unchanged.
const before=stored.get('finance-v4-state');await element('importFile').onchange({target:{files:[{text:async()=>'{"format":"jp.finance.v3"}'}],value:'x'}});assert.equal(stored.get('finance-v4-state'),before);
// Reintroduced feature screens and forms must also survive the full portable export.
click('income-self');let cc=current(),self=cc.p.rules.find(r=>r.owner==='self'),profile=self.patterns[0];
click('pattern-edit',self.id+':'+profile.id);submit({name:'正社員',netAnnual:'',monthly:'',grossMin:'4,000,000',grossMax:'6,000,000',rate:'80',pick:'mid'});cc=current();self=cc.p.rules.find(r=>r.owner==='self');assert.equal(U.planned(cc.n,cc.p,'2026-10').find(i=>i.id==='rule:'+self.id).amount,4000000/12);
click('section','income');click('income-partner');cc=current();assert(cc.p.rules.some(r=>r.owner==='partner'));click('section','living');click('pattern-create','living');cc=current();const living=cc.p.rules.find(r=>r.patternType==='living');click('living-item',living.id+':'+living.patterns[0].id);submit({name:'食費',monthly:'60,000',annual:'120,000'});cc=current();assert.equal(U.record(cc.n,cc.p,'2026-10').planned.expense,70000);
click('section','housing');click('pattern-create','housing');cc=current();const housing=cc.p.rules.find(r=>r.patternType==='housing');click('pattern-edit',housing.id+':'+housing.patterns[0].id);submit({name:'今の家',monthly:'130,000',annual:'24,000'});cc=current();assert.equal(U.record(cc.n,cc.p,'2026-10').planned.expense,202000);
click('section','funds');click('fund-new');submit({name:'家電',initial:''});cc=current();const fund=cc.n.purposes[0];click('sinking-new');submit({name:'冷蔵庫',fundId:fund.id,amount:'120,000',every:'120',month:'2026-10',purchaseMonth:'',end:'',deposit:'',autoPurchase:'on',enabled:'on'});cc=current();assert.equal(U.record(cc.n,cc.p,'2026-10').planned.reserve,1000);
click('section','investment');click('investment-edit');submit({annualCap:'1,000,000',lifetimeCap:'10,000,000',restore:'nextYear',cashFloor:'100,000',drawdown:'on'});cc=current();assert.equal(cc.p.investment.annualCap,1000000);assert(U.valid(cc.s));
click('section','master');assert(element('app').innerHTML.includes('教育費マスタの確認'));click('section','income');assert(element('app').innerHTML.includes('誰の収入を編集しますか？'));click('section','funds');assert(element('app').innerHTML.includes('冷蔵庫'));click('export');assert(element('saveStatus').textContent.includes('JSON'));
// Return one screen from self to the income list, retaining the previous scroll.
click('section','income');ctx.window.scrollY=321;click('patterns',current().p.rules.find(r=>r.owner==='self').id);let restoredScroll=null;ctx.window.scrollTo=(x,y)=>restoredScroll=y;click('back');assert(element('app').innerHTML.includes('誰の収入を編集しますか？'));assert.equal(restoredScroll,321);
// Library editing and creation do not change whole-plan adoption.
click('section','selfIncome');const baseIncome=current().p.categorySelections.selfIncome;click('source-copy','selfIncome');submit({name:'専業主婦の案'});assert.equal(current().n.categoryCatalog.selfIncome.length,2);assert(element('app').innerHTML.includes('専業主婦の案'));assert.equal(current().p.categorySelections.selfIncome,baseIncome);
const altIncome=current().n.categoryCatalog.selfIncome.at(-1).id;change({dataset:{sourceSelect:'selfIncome'},value:baseIncome});assert.equal(current().p.categorySelections.selfIncome,baseIncome);
nav('outlook');change({dataset:{adopt:'selfIncome'},value:altIncome});assert.equal(current().p.categorySelections.selfIncome,altIncome);change({dataset:{adopt:'selfIncome'},value:baseIncome});assert.equal(current().p.categorySelections.selfIncome,baseIncome);assert(element('app').innerHTML.includes('採用する住居費の案'));
click('sinking-new');assert(element('editorFields').innerHTML.includes('everyUnit'));submit({name:'10年で買替',fundId:fund.id,amount:'120000',everyValue:'10',everyUnit:'12',month:'2026-10',purchaseMonth:'',end:'',deposit:'',autoPurchase:'on',enabled:'on'});assert.equal(current().p.events.at(-1).every,120);
click('section','events');click('event-new');submit({name:'2年ごと',month:'2026-10',kind:'expense',amount:'1000',repeatMode:'1',everyValue:'2',everyUnit:'12',end:'',enabled:'on'});assert.equal(current().p.events.at(-1).every,24);
nav('outlook');assert(element('app').innerHTML.includes('年度末資産の内訳と年間収支'));assert(element('app').innerHTML.includes('案ごとの年度末の総資産'));
// Exact requested workflow: independent housing sources, then mix them per whole plan.
const planA=current().p.id,baseHousing=current().p.categorySelections.housing,baseExpense=U.record(current().n,current().p,'2026-10').planned.expense;
click('branch');submit({name:'プランB'});const planB=current().p.id;assert.equal(current().n.categoryCatalog.housing.length,1);
click('edit-source','housing');click('source-copy','housing');submit({name:'広い家の案'});const housingB=current().n.categoryCatalog.housing.at(-1);
assert.equal(current().p.categorySelections.housing,baseHousing);click('patterns',housingB.rules[0].id);click('pattern-edit',housingB.rules[0].id+':'+housingB.rules[0].patterns[0].id);submit({name:'広い家',monthly:'230000',annual:'24000'});
assert.equal(U.record(current().n,current().p,'2026-10').planned.expense,baseExpense,'editing unadopted housing source must not change the current whole plan');
nav('outlook');change({dataset:{adopt:'housing'},value:housingB.id});assert.equal(U.record(current().n,current().p,'2026-10').planned.expense,baseExpense+100000);
assert.equal(current().n.plans[planA].categorySelections.housing,baseHousing);assert.equal(current().n.plans[planB].categorySelections.housing,housingB.id);
change({id:'planSelect',value:planA});assert.equal(U.record(current().n,current().p,'2026-10').planned.expense,baseExpense);assert(U.valid(current().s));
console.log('PASS UI composition: source editing/copying does not adopt; two whole plans select independent income/housing combinations; switching plans restores their selections');
// Chart range changes only the graph. Both zero labels share the vertical midpoint.
assert.equal(current().p.endYear,2100);nav('outlook');let html=element('app').innerHTML;
const asset=()=>{const h=element('app').innerHTML;return h.slice(h.indexOf('<svg class="chart asset-chart"'),h.indexOf('</svg>',h.indexOf('<svg class="chart asset-chart"')));};
assert(asset().includes('2065年度'));assert(!asset().includes('2100年度'));assert(html.includes('<th>2100</th>'));
assert.equal((asset().match(/y="169"[^>]*>0円/g)||[]).length,2);change({id:'chartRange',value:'life'});assert(asset().includes('2100年度'));assert(element('app').innerHTML.includes('<th>2100</th>'));
change({id:'chartRange',value:'work'});assert(!asset().includes('2100年度'));
// Grouped living-cost plan inputs and the actual record use the same item identity.
click('section','living');const lr=current().p.rules.find(r=>r.patternType==='living'),lp=lr.patterns[0];click('patterns',lr.id);click('living-defaults',lr.id+':'+lp.id);
let live=current().p.rules.find(r=>r.id===lr.id).patterns[0],home=live.items.find(i=>i.category==='食費'&&i.name==='家');assert(home);const oldExpense=U.record(current().n,current().p,'2026-10').planned.expense;
const unchangedHTML=element('app').innerHTML;change({dataset:{livingItem:lr.id+':'+lp.id+':'+home.id,livingKey:'monthly'},value:'10000'});assert.equal(element('app').innerHTML,unchangedHTML,'inline living input preserves the page and expanded groups');
assert.equal(U.record(current().n,current().p,'2026-10').planned.expense,oldExpense,'old food aggregate not duplicated');change({dataset:{livingMode:lr.id+':'+lp.id,livingGroup:'食費'},value:'details'});
const homeItem=U.planned(current().n,current().p,'2026-10').find(i=>i.id==='rule:'+lr.id+':'+home.id);assert.equal(homeItem.amount,10000);nav('record');assert(element('app').innerHTML.includes('生活費 / 食費'));assert(element('app').innerHTML.includes('食費 / 家の実績'));
const recordHTML=element('app').innerHTML;change({dataset:{actual:homeItem.id},value:'12345'});assert.equal(element('app').innerHTML,recordHTML);assert.equal(current().n.actuals['2026-10'].values[homeItem.id].amount,12345);assert.equal(current().n.actuals['2026-10'].values[homeItem.id].subgroup,'食費');assert(U.valid(current().s));
console.log('PASS chart/living UI: default 2065 vs 2100 graph switch, both midpoint zeros, 2100 tables, inline detailed plans, no duplicate aggregate and matching actual inputs without page rebuild');
// Income source opens its flow directly. New working styles are alternatives, not new income rules.
click('edit-source','selfIncome');assert(element('app').innerHTML.includes('いつ，どの働き方を使う？'));assert(!element('app').innerHTML.includes('本人の収入を作る'));
const incomeRule=current().p.rules.find(r=>r.owner==='self'),incomeCount=current().p.rules.filter(r=>r.owner==='self').length,actualsBefore=JSON.stringify(current().n.actuals),partnerBefore=JSON.stringify(current().n.categoryCatalog.partnerIncome),plannedBefore=U.planned(current().n,current().p,'2027-04').find(i=>i.id==='rule:'+incomeRule.id).amount;
click('pattern-new',incomeRule.id);assert(element('editorTitle').textContent.includes('働き方'));submit({name:'パートの働き方',monthly:'100000',netAnnual:'',grossMin:'',grossMax:'',rate:'',pick:'mid'});
let working=current().p.rules.find(r=>r.id===incomeRule.id).patterns.at(-1);assert.equal(current().p.rules.filter(r=>r.owner==='self').length,incomeCount);assert.equal(U.planned(current().n,current().p,'2027-04').find(i=>i.id==='rule:'+incomeRule.id).amount,plannedBefore);assert(element('app').innerHTML.includes('未使用・使う時期を決めてください'));
click('income-use',incomeRule.id+':'+working.id);assert(element('editorFields').innerHTML.includes('value="'+working.id+'" selected'));assert(element('editorFields').innerHTML.includes('本人 ›'));submit({month:'2027-04',patternId:working.id});assert.equal(U.planned(current().n,current().p,'2027-04').find(i=>i.id==='rule:'+incomeRule.id).amount,100000);assert.equal(U.planned(current().n,current().p,'2026-10').find(i=>i.id==='rule:'+incomeRule.id).amount,plannedBefore);assert.equal(JSON.stringify(current().n.actuals),actualsBefore);assert.equal(JSON.stringify(current().n.categoryCatalog.partnerIncome),partnerBefore);
nav('outlook');change({id:'yearSelect',value:'2027'});const yearCard=element('app').innerHTML.split('<section class="card year-outlook">')[1].split('</section>')[0];assert(yearCard.includes('2027年度の月別内訳を見る'));assert(yearCard.includes('2027-04'));assert(yearCard.includes('2028-03'));assert(!yearCard.includes('2027-03'));assert(yearCard.includes('data-keep="year-months:2027"'));assert(U.valid(current().s));
console.log('PASS income UI workflow: direct flow, style-specific scheduling, no accidental extra income, independent partner/actuals, selected-year monthly breakdown nested in its year card');
console.log('PASS restored UI flow: self/partner income estimates, living items, housing patterns, earmarked sinking purchase, investment conditions, master screens and complete JSON export');
console.log('PASS UI flow: blank onboarding; independent state key; create income; move event; actual entry; branch; outlook; JSON export; new empty notebook preserves old; invalid import unchanged');
})();

// Exercise UI actions, form submissions and import/export with a minimal DOM, no browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),U=require('../core.js');require('../fund-timeline.js');
require('../patterns.js');require('../planning-helpers.js');require('../cost-ui.js');
require('../scenarios.js');
require('../all-sources.js');require('../income-transfer.js');
require('../living-costs.js');
require('../living-ui.js');
require('../income-ui.js');
require('../record-ui.js');
require('../cost-ui.js');
require('../legacy-import.js');
const elements=new Map(),listeners={},stored=new Map(),status=[];const element=id=>{if(id==='conditionsForm')return null;if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',dataset:{},hidden:false,querySelectorAll:()=>[],querySelector:()=>null,showModal(){this.open=true},close(){this.open=false},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},addEventListener(type,fn){this[type]=fn;},click(){}});return elements.get(id);};
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
click('pattern-edit',self.id+':'+profile.id);submit({name:'正社員',netAnnual:'4,000,000',monthly:''});cc=current();self=cc.p.rules.find(r=>r.owner==='self');assert.equal(U.planned(cc.n,cc.p,'2026-10').find(i=>i.id==='rule:'+self.id).amount,4000000/12);
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
const zeros=[...asset().matchAll(/y="([0-9.]+)"[^>]*>0円/g)].map(m=>Number(m[1]));assert.equal(zeros.length,2);assert(Math.abs(zeros[0]-zeros[1])<1e-8);change({id:'chartRange',value:'life'});assert(asset().includes('2100年度'));assert(element('app').innerHTML.includes('<th>2100</th>'));
change({id:'chartRange',value:'work'});assert(!asset().includes('2100年度'));
// Inspecting the plot and slider must update exact figures without saving or rerendering.
const chartState=stored.get('finance-v4-state'),chartHTML=element('app').innerHTML;
const svg=element('assetChart');svg.dataset={left:'54',step:String((760-108)/40)};
svg.viewBox={baseVal:{width:760}};svg.getBoundingClientRect=()=>({left:10,width:380});
const point=(index,type='pointerdown',pointerType='touch',buttons=1)=>listeners[type]({type,pointerType,buttons,clientX:10+(54+(index+.5)*(760-108)/40)/2,target:{closest:()=>svg}});
point(0);assert(element('assetDetails').innerHTML.includes('2026年度'));
point(19,'pointermove');assert(element('assetDetails').innerHTML.includes('2045年度'));assert(element('outlookYearDetails').innerHTML.includes('2045年度の見通し'));assert(element('outlookYearDetails').innerHTML.includes('2045年度の月別内訳を見る'));assert(element('outlookYearDetails').innerHTML.includes('2045-04'));assert(element('outlookYearDetails').innerHTML.includes('2046-03'));assert(!element('outlookYearDetails').innerHTML.includes('2026-04'));assert(element('outlookYearDetails').innerHTML.includes('<th>年間収支</th>'));
const selectedYear=U.annual(U.forecast(current().n,current().p,{})).find(v=>v.year===2045);
const yen=n=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:0}).format(n)+'円';
assert(element('assetDetails').innerHTML.includes(yen(selectedYear.total)));
assert(element('assetDetails').innerHTML.includes(yen(selectedYear.income-selectedYear.expense)));
click('asset-year','2046');assert(element('assetDetails').innerHTML.includes('2046年度'));assert(element('outlookYearDetails').innerHTML.includes('2046年度の見通し'));
point(39);assert(element('assetDetails').innerHTML.includes('2065年度'));
click('asset-year','2066');assert(element('assetDetails').innerHTML.includes('2065年度'));
listeners.input({target:{id:'assetYearSlider',value:'1'}});assert(element('assetDetails').innerHTML.includes('2027年度'));assert(element('outlookYearDetails').innerHTML.includes('2027年度の月別内訳を見る'));
assert.equal(element('app').innerHTML,chartHTML);assert.equal(stored.get('finance-v4-state'),chartState);
change({id:'yearSelect',value:'2070'});assert(element('app').innerHTML.includes('2070年度の見通し'));assert(element('app').innerHTML.includes('aria-valuetext="2070年度"'));change({id:'chartRange',value:'work'});change({id:'yearSelect',value:'2026'});assert(element('app').innerHTML.includes('2026年度の見通し'));assert(element('app').innerHTML.includes('aria-valuetext="2026年度"'));assert.equal(stored.get('finance-v4-state'),chartState);
console.log('PASS chart touch, drag, slider and adjacent years: exact annual figures, scaled coordinates, endpoints, no page rerender or saved data changes');
click('nisa-open');let nisaHTML=element('app').innerHTML;
assert(nisaHTML.includes('NISA・投資の年度ごとの変遷'));assert(nisaHTML.includes('翌年度初めの空き総枠'));assert(nisaHTML.includes('売却元本'));assert(nisaHTML.includes('保有元本'));
const nisaSVG=element('nisaChart');nisaSVG.dataset={left:'54',step:String((760-70)/40)};nisaSVG.viewBox={baseVal:{width:760}};nisaSVG.getBoundingClientRect=()=>({left:10,width:380});
listeners.pointerdown({type:'pointerdown',pointerType:'touch',buttons:1,clientX:10+(54+19.5*(760-70)/40)/2,target:{closest:selector=>selector==='#nisaChart'?nisaSVG:null}});
assert(element('nisaDetails').innerHTML.includes('2045年度'));assert(element('nisaDetails').innerHTML.includes(yen(selectedYear.investBalance)));
click('nisa-year','2046');assert(element('nisaDetails').innerHTML.includes('2046年度'));
listeners.input({target:{id:'nisaYearSlider',value:'0'}});assert(element('nisaDetails').innerHTML.includes('2026年度'));
assert.equal(element('app').innerHTML,nisaHTML);assert.equal(stored.get('finance-v4-state'),chartState);
change({id:'chartRange',value:'life'});assert(element('app').innerHTML.includes('2100年度'));
change({id:'chartRange',value:'work'});nav('outlook');
console.log('PASS NISA annual chart/table and touch, slider and year buttons without saving or replacing the page');


// Grouped living-cost plan inputs and the actual record use the same item identity.
click('section','living');const lr=current().p.rules.find(r=>r.patternType==='living'),lp=lr.patterns[0];click('patterns',lr.id);click('living-defaults',lr.id+':'+lp.id);
let live=current().p.rules.find(r=>r.id===lr.id).patterns[0],home=live.items.find(i=>i.category==='食費'&&i.name==='家');assert(home);const oldExpense=U.record(current().n,current().p,'2026-10').planned.expense;
const unchangedHTML=element('app').innerHTML;change({dataset:{livingItem:lr.id+':'+lp.id+':'+home.id,livingKey:'monthly'},value:'10000'});assert.equal(element('app').innerHTML,unchangedHTML,'inline living input preserves the page and expanded groups');
assert.equal(U.record(current().n,current().p,'2026-10').planned.expense,oldExpense,'old food aggregate not duplicated');change({dataset:{livingMode:lr.id+':'+lp.id,livingGroup:'食費'},value:'details'});
const homeItem=U.planned(current().n,current().p,'2026-10').find(i=>i.id==='rule:'+lr.id+':'+home.id);assert.equal(homeItem.amount,10000);nav('record');assert(element('app').innerHTML.includes('data-record-node="[&quot;支出&quot;,&quot;生活費&quot;,&quot;食費&quot;]"'));assert(element('app').innerHTML.includes('食費 / 家の実績'));
const recordHTML=element('app').innerHTML;change({dataset:{actual:homeItem.id},value:'12345'});assert.equal(element('app').innerHTML,recordHTML);assert.equal(current().n.actuals['2026-10'].values[homeItem.id].amount,12345);assert.equal(current().n.actuals['2026-10'].values[homeItem.id].subgroup,'食費');assert(U.valid(current().s));
console.log('PASS chart/living UI: default 2065 vs 2100 graph switch, both midpoint zeros, 2100 tables, inline detailed plans, no duplicate aggregate and matching actual inputs without page rebuild');
// Income source opens its flow directly. New working styles are alternatives, not new income rules.
click('edit-source','selfIncome');assert(element('app').innerHTML.includes('年度別の収入一覧'));assert(!element('app').innerHTML.includes('本人の収入を作る'));
const incomeRule=current().p.rules.find(r=>r.owner==='self'),incomeCount=current().p.rules.filter(r=>r.owner==='self').length,actualsBefore=JSON.stringify(current().n.actuals),partnerBefore=JSON.stringify(current().n.categoryCatalog.partnerIncome),plannedBefore=U.planned(current().n,current().p,'2027-04').find(i=>i.id==='rule:'+incomeRule.id).amount;
click('pattern-new',incomeRule.id);assert(element('editorTitle').textContent.includes('働き方'));submit({name:'パートの働き方',monthly:'100000',netAnnual:'',grossMin:'',grossMax:'',rate:'',pick:'mid'});
let working=current().p.rules.find(r=>r.id===incomeRule.id).patterns.at(-1);assert.equal(current().p.rules.filter(r=>r.owner==='self').length,incomeCount);assert.equal(U.planned(current().n,current().p,'2027-04').find(i=>i.id==='rule:'+incomeRule.id).amount,plannedBefore);assert(element('app').innerHTML.includes('未使用・使う時期を決めてください'));
click('income-use',incomeRule.id+':'+working.id);assert(element('editorFields').innerHTML.includes('value="'+working.id+'" selected'));assert(element('editorFields').innerHTML.includes('本人 ›'));submit({month:'2027-04',patternId:working.id});assert.equal(U.planned(current().n,current().p,'2027-04').find(i=>i.id==='rule:'+incomeRule.id).amount,100000);assert.equal(U.planned(current().n,current().p,'2026-10').find(i=>i.id==='rule:'+incomeRule.id).amount,plannedBefore);assert.equal(JSON.stringify(current().n.actuals),actualsBefore);assert.equal(JSON.stringify(current().n.categoryCatalog.partnerIncome),partnerBefore);
nav('outlook');change({id:'yearSelect',value:'2027'});const yearCard=element('app').innerHTML.split('<section id="outlookYearDetails" class="card year-outlook">')[1].split('</section>')[0];assert(yearCard.includes('2027年度の月別内訳を見る'));assert(yearCard.includes('2027-04'));assert(yearCard.includes('2028-03'));assert(!yearCard.includes('2027-03'));assert(yearCard.includes('data-keep="year-months:2027"'));assert(U.valid(current().s));
console.log('PASS income UI workflow: direct flow, style-specific scheduling, no accidental extra income, independent partner/actuals, selected-year monthly breakdown nested in its year card');
click('edit-source','selfIncome');click('income-rule',incomeRule.id);assert(!element('editorFields').innerHTML.includes('name="amount"'));submit({name:'本業の収入',start:incomeRule.start,end:''});assert.equal(current().p.rules.find(r=>r.id===incomeRule.id).name,'本業の収入');assert.equal(current().p.rules.find(r=>r.id===incomeRule.id).patterns.at(-1).id,working.id);
click('begin');submit({name:'first income only',start:'2026-10',cash:'',invest:'',reserve:''});click('section','partnerIncome');assert(element('app').innerHTML.includes('最初の働き方を登録'));click('income-first');assert(element('editor').open);submit({name:'初めてのパート',monthly:'90000',netAnnual:'',grossMin:'',grossMax:'',rate:'',pick:'mid'});assert.equal(current().p.rules.length,1);assert.equal(current().p.rules[0].owner,'partner');assert.equal(U.record(current().n,current().p,'2026-10').planned.income,90000);assert(element('app').innerHTML.includes('初めてのパート'));assert(U.valid(current().s));
nav('record');const ruleCount=current().p.rules.length;click('record-add',JSON.stringify(['支出','生活費','食費']));assert(element('editorFields').innerHTML.includes('支出 › 生活費 › 食費'));submit({name:'家',amount:'1500'});let newActual=Object.values(current().n.actuals['2026-10'].values).at(-1);assert.equal(newActual.group,'生活費');assert.equal(newActual.subgroup,'食費');assert.equal(newActual.kind,'expense');assert.equal(current().p.rules.length,ruleCount);assert(!current().n.actuals['2026-11']);
click('record-add',JSON.stringify(['支出','NISA']));submit({name:'積立投資',amount:'5000'});newActual=Object.values(current().n.actuals['2026-10'].values).at(-1);assert.equal(newActual.kind,'invest');const monthAfter=U.forecast(current().n,current().p,{},'2026-10').at(-1);assert.equal(monthAfter.used.expense,1500);assert.equal(monthAfter.invest,5000);assert.equal(monthAfter.total,88500,'displaying NISA in expenditure must not consume assets');assert(U.valid(current().s));
console.log('PASS scoped record UI: living/food manual actual stays in its category for this month only; NISA retains transfer accounting and no extra planned rules');
// Screenshot-style editing is inline and never replaces the open page during an input change.
click('edit-source','partnerIncome');const pr=current().p.rules.find(r=>r.owner==='partner'),pp=pr.patterns[0],selfCatalog=JSON.stringify(current().n.categoryCatalog.selfIncome),incomeHTML=element('app').innerHTML;
assert(incomeHTML.includes('金額と切り替わる時期')); 
change({dataset:{patternYear:'2026',rule:pr.id,profile:pp.id,key:'netAnnual'},value:'1200000'});assert.equal(element('app').innerHTML,incomeHTML);assert.equal(U.planned(current().n,current().p,'2026-10').find(i=>i.id==='rule:'+pr.id).amount,100000);
change({dataset:{incomeName:pr.id+':'+pp.id},value:'本人とは別のパートナーの働き方'});assert.equal(element('app').innerHTML,incomeHTML);assert.equal(JSON.stringify(current().n.categoryCatalog.selfIncome),selfCatalog);
click('payout-add',pr.id+':'+pp.id);submit({year:'2027',month:'4',amount:'600000'});const pv=current().p.rules.find(r=>r.id===pr.id).patterns[0].payouts[0],payoutHTML=element('app').innerHTML;
change({dataset:{incomePayout:pr.id+':'+pp.id+':'+pv.id,payoutKey:'amount'},value:'650000'});change({dataset:{incomePayout:pr.id+':'+pp.id+':'+pv.id,payoutKey:'month'},value:'5'});assert.equal(element('app').innerHTML,payoutHTML);assert.equal(U.record(current().n,current().p,'2027-04').planned.income,90000);assert.equal(U.record(current().n,current().p,'2027-05').planned.income,740000);
click('section','housing');click('pattern-create','housing');const houseR=current().p.rules.find(r=>r.patternType==='housing'),houseP=houseR.patterns[0],houseHTML=element('app').innerHTML;change({dataset:{costProfile:houseR.id+':'+houseP.id,costKey:'monthly'},value:'100000'});change({dataset:{costProfile:houseR.id+':'+houseP.id,costKey:'annual'},value:'24000'});assert.equal(element('app').innerHTML,houseHTML);assert.equal(U.record(current().n,current().p,'2026-10').planned.expense,102000);
click('section','living');click('pattern-create','living');const newLiving=current().p.rules.find(r=>r.patternType==='living'),newLP=newLiving.patterns[0];assert.equal(newLP.items.length,25);assert(element('app').innerHTML.includes('plan-cost:'+newLP.id+':生活費'));click('cost-item-add',JSON.stringify([newLiving.id,newLP.id,'生活費','医療']));assert(element('editorFields').innerHTML.includes('value="医療"'));submit({category:'医療',name:'通院',monthly:'2000',annual:''});assert(U.planned(current().n,current().p,'2026-10').some(i=>i.leafName==='通院'&&i.subgroup==='医療'&&i.amount===2000));assert(U.valid(current().s));
console.log('PASS inline planning: yearly salary and retirement date/amount edits without DOM replacement, owner isolation, housing monthly/annual inputs, blank old templates and category-prefilled expense addition');
// Editing a copied source is a preview until the explicit Apply button is used.
const beforeApply=current(),oldLiving=beforeApply.p.categorySelections.living,oldHousing=beforeApply.p.categorySelections.housing,actualsSnapshot=JSON.stringify(beforeApply.n.actuals),expenseBefore=U.record(beforeApply.n,beforeApply.p,'2026-10').planned.expense;
click('source-copy','living');submit({name:'食費を変える案'});const copiedLiving=current().n.categoryCatalog.living.at(-1),copiedRule=copiedLiving.rules[0],copiedProfile=copiedRule.patterns[0],foodHome=copiedProfile.items.find(i=>i.category==='食費'&&i.name==='家');assert(element('app').innerHTML.includes('data-action="source-apply"'));change({dataset:{livingItem:copiedRule.id+':'+copiedProfile.id+':'+foodHome.id,livingKey:'monthly'},value:'10000'});assert.equal(current().p.categorySelections.living,oldLiving);assert.equal(U.record(current().n,current().p,'2026-10').planned.expense,expenseBefore);click('source-apply','living');assert.equal(current().p.categorySelections.living,copiedLiving.id);assert.equal(current().p.categorySelections.housing,oldHousing);assert.equal(U.record(current().n,current().p,'2026-10').planned.expense,expenseBefore+10000);assert.equal(JSON.stringify(current().n.actuals),actualsSnapshot);assert(element('app').innerHTML.includes('この案を適用中'));
click('edit-source','partnerIncome');const growthR=current().p.rules.find(r=>r.owner==='partner'),growthP=growthR.patterns[0],prior2026=growthP.years[2026].netAnnual,payoutSnapshot=JSON.stringify(growthP.payouts),stageSnapshot=JSON.stringify(growthR.patternStages);click('income-growth',growthR.id+':'+growthP.id);submit({from:'2027',to:'2029',base:'2000000',growthMode:'amount',increment:'100000'});const grown=current().p.rules.find(r=>r.id===growthR.id).patterns[0];assert.equal(grown.years[2026].netAnnual,prior2026);assert.equal(grown.years[2027].netAnnual,2000000);assert.equal(grown.years[2029].netAnnual,2200000);assert.equal(JSON.stringify(grown.payouts),payoutSnapshot);assert.equal(JSON.stringify(current().p.rules.find(r=>r.id===growthR.id).patternStages),stageSnapshot);assert.equal(JSON.stringify(current().n.actuals),actualsSnapshot);assert(U.valid(current().s));
console.log('PASS Apply and salary ranges: selected source preview differs from adoption, explicit application updates the correct month plans, shared actuals and other components intact, bulk raises retain payouts and switches');
// Choose a new working style for the current month: replace that month's switch only.
click('pattern-new',growthR.id);submit({name:'切替テスト',monthly:'50000',netAnnual:'',grossMin:'',grossMax:'',rate:'',pick:'mid'});const switchP=current().p.rules.find(r=>r.id===growthR.id).patterns.at(-1),stagesBefore=current().p.rules.find(r=>r.id===growthR.id).patternStages.length;click('income-use',growthR.id+':'+switchP.id);assert.equal(current().p.rules.find(r=>r.id===growthR.id).patternStages.length,stagesBefore,'opening a timing dialog does not change the data');submit({month:'2026-10',patternId:switchP.id});assert.equal(current().p.rules.find(r=>r.id===growthR.id).patternStages.length,stagesBefore);assert.equal(U.record(current().n,current().p,'2026-10').planned.income,50000);assert(U.valid(current().s));

// v4=11: old estimates remain identical on load/view and can be edited as net amounts.
click('edit-source','partnerIncome');
const legacy=U.C(current().p.rules.find(r=>r.id===pr.id).patterns[0]);
Object.assign(legacy,{netAnnual:null,monthly:90000,grossMin:4000000,grossMax:6000000,rate:80,pick:'mid',years:{2027:{grossMin:6000000,grossMax:8000000},2028:{netAnnual:0}}});
await element('incomeFile').onchange({target:{dataset:{target:pr.id+':'+legacy.id},files:[{text:async()=>JSON.stringify({format:'jp.finance.income.pattern',version:1,pattern:legacy})}],value:'x'}});
const incomeBeforeEdit=current(),forecastBefore=U.forecast(incomeBeforeEdit.n,incomeBeforeEdit.p),sourceBefore=JSON.stringify(incomeBeforeEdit.n.categoryCatalog.partnerIncome);
click('pattern-edit',pr.id+':'+legacy.id);
assert(!element('editorFields').innerHTML.includes('name="grossMin"'));assert(!element('editorFields').innerHTML.includes('name="rate"'));assert(element('editorFields').innerHTML.includes('value="4,000,000"'));
assert.equal(JSON.stringify(current().n.categoryCatalog.partnerIncome),sourceBefore,'opening editor does not rewrite old estimates');
element('editor').close();click('pattern-years',pr.id+':'+legacy.id);assert(!element('app').innerHTML.includes('data-key="grossMin"'));assert(element('app').innerHTML.includes('value="5600000"'));assert.deepEqual(U.forecast(current().n,current().p),forecastBefore);
click('pattern-edit',pr.id+':'+legacy.id);submit({name:legacy.name,netAnnual:'4000000',monthly:'90000'});assert.deepEqual(U.forecast(current().n,current().p),forecastBefore,'saving unchanged effective net preserves entire forecast');
click('pattern-edit',pr.id+':'+legacy.id);submit({name:legacy.name,netAnnual:'',monthly:'100000'});let converted=current().p.rules.find(r=>r.id===pr.id).patterns[0];assert.equal(U.patterns.net(converted,2026).amount,1200000);assert.equal(U.patterns.net(converted,2027).amount,5600000);assert.equal(U.patterns.net(converted,2028).amount,0);
click('pattern-fill',pr.id+':'+legacy.id);assert(!element('editorFields').innerHTML.includes('name="rate"'));submit({from:'2029',to:'2030',netAnnual:'0'});converted=current().p.rules.find(r=>r.id===pr.id).patterns[0];assert.equal(converted.years[2029].netAnnual,0);assert.equal(U.patterns.net(converted,2027).amount,5600000);
// Deletion is scoped to the owner, lists adopters, requires a replacement, preserves actuals.
for(const type of ['partnerIncome','selfIncome','housing','living','events','children','funds','investment','budget']){
 click('section',type);assert(element('app').innerHTML.includes('data-action="source-rename"'));assert(element('app').innerHTML.includes('data-action="source-delete"'));const initial=current(),original=initial.p.categorySelections[type],actualBefore=JSON.stringify(initial.n.actuals),other=type==='selfIncome'?'partnerIncome':'selfIncome',otherBefore=JSON.stringify(initial.n.categoryCatalog[other]);
 const originalCount=initial.n.categoryCatalog[type].length;if(originalCount===1){click('source-delete',type);assert(!element('editor').open);assert(element('saveStatus').textContent.includes('最後の'));}
 const beforeRename=JSON.stringify(current().n.actuals);click('source-rename',type);submit({name:type+'名前変更'});assert.equal(current().n.categoryCatalog[type].find(q=>q.id===original).name,type+'名前変更');assert.equal(JSON.stringify(current().n.actuals),beforeRename);
 click('source-copy',type);submit({name:type+'置換先'});const replacement=current().n.categoryCatalog[type].at(-1).id;const untouched=JSON.stringify(Object.fromEntries(Object.entries(current().n.categoryCatalog).filter(([t])=>t!==type))),openingBefore=JSON.stringify(current().n.opening),purposesBefore=JSON.stringify(current().n.purposes);
 click('source-delete',type);assert(element('editorFields').innerHTML.includes('影響する全体プラン（0件）'));const beforeCancel=stored.get('finance-v4-state');element('editor').close();assert.equal(stored.get('finance-v4-state'),beforeCancel);
 change({dataset:{sourceSelect:type},value:original});click('branch');submit({name:type+'を共有するプラン'});click('section',type);change({dataset:{sourceSelect:type},value:original});
 const affected=Object.values(current().n.plans).filter(p=>p.categorySelections[type]===original);click('source-delete',type);for(const p of affected)assert(element('editorFields').innerHTML.includes(p.name));
 const beforeInvalid=stored.get('finance-v4-state');element('editorForm').onsubmit({preventDefault(){},target:[['replacement','']]});assert(element('formError').textContent.includes('置換先'));assert.equal(stored.get('finance-v4-state'),beforeInvalid);
 submit({replacement});const after=current();assert(!after.n.categoryCatalog[type].some(q=>q.id===original));for(const p of affected)assert.equal(after.n.plans[p.id].categorySelections[type],replacement);assert.equal(JSON.stringify(after.n.actuals),actualBefore);assert.equal(JSON.stringify(after.n.categoryCatalog[other]),otherBefore);assert.equal(JSON.stringify(Object.fromEntries(Object.entries(after.n.categoryCatalog).filter(([t])=>t!==type))),untouched);assert.equal(JSON.stringify(after.n.opening),openingBefore);assert.equal(JSON.stringify(after.n.purposes),purposesBefore);assert(U.valid(after.s));
 click('source-copy',type);submit({name:'未使用の削除用'});click('source-delete',type);assert(element('editorFields').innerHTML.includes('影響する全体プラン（0件）'));submit({});assert.equal(current().n.categoryCatalog[type].length,originalCount);assert.equal(current().p.categorySelections[type],replacement);assert.equal(JSON.stringify(current().n.actuals),actualBefore);
 click('back');assert(!element('saveStatus').textContent.includes('見つかりません'));assert(U.valid(current().s));
}
console.log('PASS v4=11: legacy forecasts preserved; net-only base/year/bulk editing and zero; all nine source types rename and delete unused/shared sources with explicit replacement, cancel/invalid no-op, shared actuals/opening/fund allocations and other catalogs unchanged');


// Import both owners at once, with explicit adoption and no changes before confirmation.
click('section','income');assert(element('app').innerHTML.includes('年度別収入をまとめて読み込む'));
const bundle={format:'jp.finance.income.sources',version:1,sources:['self','partner'].map(owner=>({owner,name:'テスト用年度別収入',start:'2026-04',patterns:[{id:'work',name:'正社員',years:{2026:{netAnnual:1200},2027:{netAnnual:0}}}],stages:[{month:'2026-04',patternId:'work'}]}))};
const bundleBefore=stored.get('finance-v4-state'),bundleActuals=JSON.stringify(current().n.actuals),bundleOtherPlans=Object.fromEntries(Object.entries(current().n.plans).filter(([id])=>id!==current().p.id));
const readBundle=()=>element('incomeSourcesFile').onchange({target:{files:[{text:async()=>JSON.stringify(bundle)}],value:'x'}});
await readBundle();assert(element('editor').open);assert(element('editorFields').innerHTML.includes('正社員'));assert(element('editorFields').innerHTML.includes('1200円')||element('editorFields').innerHTML.includes('1,200円'));assert.equal(stored.get('finance-v4-state'),bundleBefore);element('editor').close();assert.equal(stored.get('finance-v4-state'),bundleBefore);
await readBundle();submit({adopt:'on'});assert.equal(U.record(current().n,current().p,'2026-10').planned.income,200);assert.equal(U.record(current().n,current().p,'2027-04').planned.income,0);assert.equal(JSON.stringify(current().n.actuals),bundleActuals);for(const[id,p]of Object.entries(bundleOtherPlans))assert.deepEqual(current().n.plans[id],p);assert(U.valid(current().s));
const importBeforeBad=stored.get('finance-v4-state');await element('incomeSourcesFile').onchange({target:{files:[{text:async()=>'{"format":"wrong"}'}],value:'x'}});assert.equal(stored.get('finance-v4-state'),importBeforeBad);assert(element('saveStatus').textContent.includes('取り込めません'));
console.log('PASS income bundle UI: summary/confirmation, cancelled and invalid imports unchanged, both owner sources with explicit adoption, existing actuals and other plans preserved');

// Monthly salary and bonus dialogs retain annual fallback and common actuals.
click('section','selfIncome');cc=current();const monthlyRule=cc.p.rules.find(r=>r.owner==='self'),monthlyKey=monthlyRule.id+':'+monthlyRule.patterns[0].id,monthlyActuals=JSON.stringify(cc.n.actuals);
click('salary-edit',monthlyKey);submit({month:'2026-10',net:'250000'});
assert.equal(U.record(current().n,current().p,'2026-10').planned.income,250100);
click('salary-edit',monthlyKey);submit({month:'2027-04',net:'260000'});
click('bonus-edit',monthlyKey);submit({month:'2026-12',net:'400000'});
assert.equal(U.record(current().n,current().p,'2026-12').planned.income,650100);
assert.equal(U.record(current().n,current().p,'2027-04').planned.income,260000);
cc=current();const bonusId=cc.p.rules.find(r=>r.owner==='self').patterns[0].bonuses[0].id;
click('bonus-edit',monthlyKey+':'+bonusId);submit({month:'2026-12',net:'410000'});
assert.equal(U.record(current().n,current().p,'2026-12').planned.income,660100);
click('bonus-delete',monthlyKey+':'+bonusId);
assert.equal(U.record(current().n,current().p,'2026-12').planned.income,250100);
assert.equal(JSON.stringify(current().n.actuals),monthlyActuals);assert(U.valid(current().s));
console.log('PASS monthly dialogs: effective changes, dated bonuses, edit/delete and preserved actuals');


// Education editing uses the master by default, with combined per-year summaries outside child cards.
click('section','children');const educationActuals=JSON.stringify(current().n.actuals);
ctx.window.EDUCATION_MASTER.ages={0:{基本生活費:360000},1:{基本生活費:360000},2:{基本生活費:360000}};
const childFields=(name,birthYear)=>({name,birthYear,annual:'',useMaster:'1',includeLiving:'1','choice-preschool':'保育園・幼稚園','choice-primary':'小学校/公立','choice-middle':'中学校/公立','choice-high':'高校/公立','choice-university':'大学/国公立文系','choice-graduate':'院/なし','choice-middleJuku':'塾/中学校/なし','choice-highJuku':'塾/高校/なし',scholarship:'',scholarshipAge:'',scholarshipYears:''});
click('child-new');let cf=element('editorFields').innerHTML;assert(cf.includes('type="hidden" name="useMaster"'));assert(!cf.includes('type="checkbox"'));assert(cf.includes('<section class="education-school-fields"><h3>進路・奨学金</h3>'));assert(cf.indexOf('data-child-years="true"')>cf.indexOf('name="scholarshipYears"'));
submit(childFields('第一子','2029'));const firstChild=current().p.children.at(-1);assert(firstChild.useMaster&&firstChild.includeLiving);
click('child-new');submit(childFields('第二子','2031'));let educationHtml=element('app').innerHTML;
assert(educationHtml.indexOf('年度ごとの内訳')>educationHtml.indexOf('childrenPage:'+current().p.children.at(-1).id));
assert(!educationHtml.includes('data-action="education-detail"'));assert(!educationHtml.includes('data-action="child-years"'));
assert(educationHtml.includes('2031年度　合計 720,000円'));assert(educationHtml.includes('第一子 360,000円 ／ 第二子 360,000円'));assert(educationHtml.includes('2100年度'));
click('child-edit',firstChild.id);
element('editorForm').onsubmit({preventDefault(){},target:Object.entries(childFields('第一子','2029')),submitter:{dataset:{childYears:'true'}}});assert.equal(element('formError').textContent,'');assert(element('app').innerHTML.includes('第一子：年度別の金額'));
change({dataset:{annual:'2031',owner:firstChild.id,type:'childyears'},value:'500000'});click('section','children');assert(element('app').innerHTML.includes('2031年度　合計 860,000円'));
assert.equal(JSON.stringify(current().n.actuals),educationActuals);assert(U.valid(current().s));
console.log('PASS education: visible school fields, master/living defaults, annual edit from modal, combined and per-child amounts through 2100, manual year precedence and preserved actuals');


// Investment deposits are configured here, with dated editable changes and common actuals intact.
click('section','investment');const investActuals=JSON.stringify(current().n.actuals),investOther=JSON.stringify(current().n.categoryCatalog.children);
assert(element('app').innerHTML.includes('毎月の積立・変更予定'));assert(element('app').innerHTML.includes('investment-settings'));
click('invest-rule-new');assert.equal(element('editorTitle').textContent,'積立を追加');submit({name:'NISA積立',start:'2026-10',end:'',amount:'50000'});
const deposit=current().p.rules.filter(r=>r.kind==='invest').at(-1);
click('invest-change-edit',deposit.id);submit({month:'2028-04',amount:'70000',label:'増額'});assert.equal(U.ruleAmount(current().p.rules.find(r=>r.id===deposit.id),'2028-03',current().p),50000);assert.equal(U.ruleAmount(current().p.rules.find(r=>r.id===deposit.id),'2028-04',current().p),70000);
click('invest-change-edit',deposit.id+':2028-04');submit({month:'2028-06',amount:'80000',label:'変更'});assert.equal(current().p.rules.find(r=>r.id===deposit.id).changes.length,1);assert.equal(U.ruleAmount(current().p.rules.find(r=>r.id===deposit.id),'2028-04',current().p),50000);
click('invest-change-edit',deposit.id);const investBeforeInvalid=stored.get('finance-v4-state');element('editorForm').onsubmit({preventDefault(){},target:Object.entries({month:'2028-06',amount:'999',label:''})});assert(element('formError').textContent.includes('同じ月'));assert.equal(stored.get('finance-v4-state'),investBeforeInvalid);element('editor').close();
click('invest-change-edit',deposit.id);submit({month:'2029-04',amount:'0',label:'停止'});assert.equal(U.ruleAmount(current().p.rules.find(r=>r.id===deposit.id),'2029-04',current().p),0);
click('invest-change-delete',deposit.id+':2028-06');assert.equal(current().p.rules.find(r=>r.id===deposit.id).changes.length,1);assert.equal(U.ruleAmount(current().p.rules.find(r=>r.id===deposit.id),'2028-06',current().p),50000);
assert.equal(JSON.stringify(current().n.actuals),investActuals);assert.equal(JSON.stringify(current().n.categoryCatalog.children),investOther);assert(U.valid(current().s));
console.log('PASS investment schedule: create, add/edit/move/delete dated amounts, duplicate rejection, zero pause and preserved common actuals/other sources');


// Freeze the full plan into original budgets without using common actual amounts.
click('section','budget');const budgetActuals=JSON.stringify(current().n.actuals),budgetOther=JSON.stringify(Object.fromEntries(Object.entries(current().n.categoryCatalog).filter(([t])=>t!=='budget')));
click('budget-capture-all');assert(element('editorFields').innerHTML.includes('value="2100"'));const beforeBulkInvalid=stored.get('finance-v4-state');element('editorForm').onsubmit({preventDefault(){},target:Object.entries({from:'2101',to:'2100',writeMode:'replace'})});assert(element('formError').textContent.includes('年度'));assert.equal(stored.get('finance-v4-state'),beforeBulkInvalid);element('editor').close();
click('budget-capture-all');submit({from:'2026',to:'2100',writeMode:'replace'});let frozen=current();assert.equal(Object.keys(frozen.p.budgets).length,75);assert.equal(Object.keys(frozen.p.budgets[2026].months).length,6);assert(frozen.p.budgets[2100].months['2101-03']);for(const m of ['2026-10','2028-04','2029-04','2031-04','2101-03'])assert.deepEqual(frozen.p.budgets[U.fy(m)].months[m],U.vector(U.planned(frozen.n,frozen.p,m,ctx.window.EDUCATION_MASTER)));
change({dataset:{budget:'2026-10',kind:'income'},value:'0'});const oldBudget=JSON.stringify(current().p.budgets);click('budget-capture-all');submit({from:'2026',to:'2100',writeMode:'missing'});assert.equal(JSON.stringify(current().p.budgets),oldBudget,'explicit zero and all existing values/timestamps retained');
click('budget-fill');submit({from:'2028',to:'2029',income:'',expense:'123456',invest:'0',reserve:''});let manualBudget=current().p.budgets;assert.equal(manualBudget[2028].months['2028-04'].expense,123456);assert.equal(manualBudget[2029].months['2030-03'].invest,0);assert.deepEqual(manualBudget[2027],JSON.parse(oldBudget)[2027]);assert.equal(manualBudget[2028].months['2028-04'].income,JSON.parse(oldBudget)[2028].months['2028-04'].income);
assert.equal(JSON.stringify(Object.fromEntries(Object.entries(current().n.categoryCatalog).filter(([t])=>t!=='budget'))),budgetOther);const frozenBeforePlanChange=JSON.stringify(current().p.budgets);click('section','investment');click('invest-change-edit',deposit.id);submit({month:'2030-04',amount:'99999',label:''});assert.equal(JSON.stringify(current().p.budgets),frozenBeforePlanChange);assert.equal(JSON.stringify(current().n.actuals),budgetActuals);
click('section','budget');click('budget-capture-all');submit({from:'2030',to:'2030',writeMode:'replace'});assert.equal(current().p.budgets[2030].months['2030-04'].invest,U.vector(U.planned(current().n,current().p,'2030-04',ctx.window.EDUCATION_MASTER)).invest);assert.equal(current().p.budgets[2026].months['2026-10'].income,0);assert.equal(JSON.stringify(current().n.actuals),budgetActuals);assert(U.valid(current().s));
console.log('PASS bulk original budgets: full 2026-2100 capture from planned amounts, partial first year, explicit zero/missing preservation, fixed-value ranges, frozen baseline after plan edits, scoped replacement and unchanged actuals');

// Housing costs and their linked earmarked saving use separate source catalogs without adoption.
click('section','housing');const housingBefore=current(),housingId=housingBefore.p.categorySelections.housing;change({dataset:{sourceSelect:'housing'},value:housingId});
const housingRule=current().n.categoryCatalog.housing.find(q=>q.id===housingId).rules.find(r=>r.patternType==='housing'),housingProfile=housingRule.patterns[0],housingKey=housingRule.id+':'+housingProfile.id,renewActuals=JSON.stringify(current().n.actuals),renewBudgets=JSON.stringify(current().p.budgets),fundsId=current().p.categorySelections.funds;
click('housing-renewal-edit',housingKey);submit({name:'更新料',amount:'130000',everyValue:'2',everyUnit:'12',fundId:''});
let renewal=current().n.categoryCatalog.housing.find(q=>q.id===housingId).rules.find(r=>r.id===housingRule.id).patterns.find(p=>p.id===housingProfile.id).renewals[0],renewalKey=housingKey+':'+renewal.id;
assert.equal(renewal.every,24);assert(element('app').innerHTML.includes('更新料・保険料などの支払予定'));
click('housing-renewal-fund',renewalKey);submit({fundId:'new',amount:'5417',start:'2026-10'});let renewed=current();assert(renewed.n.purposes.some(f=>f.name==='住居更新料'));assert.equal(renewed.p.categorySelections.funds,fundsId);let linked=renewed.n.categoryCatalog.funds.find(q=>q.id===fundsId).rules.filter(r=>r.housingLink?.costId===renewal.id);assert.equal(linked.length,1);assert.equal(linked[0].amount,5417);assert.equal(renewed.p.events.filter(e=>e.sinking).length,housingBefore.p.events.filter(e=>e.sinking).length);
click('housing-renewal-fund',renewalKey);submit({fundId:'new',amount:'6000',start:'2026-10'});renewed=current();assert.equal(renewed.n.purposes.filter(f=>f.name==='住居更新料').length,1);assert.equal(renewed.n.categoryCatalog.funds.find(q=>q.id===fundsId).rules.filter(r=>r.housingLink?.costId===renewal.id).length,1);
click('housing-renewal-edit',renewalKey);const savedRenewal=stored.get('finance-v4-state');element('editorForm').onsubmit({preventDefault(){},target:Object.entries({name:'更新料',amount:'130000',everyValue:'0',everyUnit:'12',fundId:''})});assert(element('formError').textContent.includes('周期'));assert.equal(stored.get('finance-v4-state'),savedRenewal);element('editor').close();
click('housing-renewal-edit',renewalKey);submit({name:'更新料',amount:'140000',everyValue:'2',everyUnit:'12',fundId:'',autoSaving:'on'});const autoSaved=current();assert.equal(autoSaved.n.categoryCatalog.housing.find(q=>q.id===housingId).rules.find(r=>r.id===housingRule.id).patterns.find(p=>p.id===housingProfile.id).renewals[0].autoSaving,true);assert.equal(autoSaved.n.purposes.filter(f=>f.name==='住居更新料').length,1);assert.equal(autoSaved.n.categoryCatalog.funds.find(q=>q.id===fundsId).rules.filter(r=>r.housingLink?.costId===renewal.id).length,1);
click('section','funds');assert(element('app').innerHTML.includes('住居更新料の積立'));assert(element('app').innerHTML.includes('住居費から自動作成'));assert.equal(JSON.stringify(current().n.actuals),renewActuals);assert.equal(JSON.stringify(current().p.budgets),renewBudgets);assert(U.valid(current().s));
click('section','housing');change({dataset:{sourceSelect:'housing'},value:housingId});click('housing-renewal-delete',renewalKey);assert.equal(current().n.categoryCatalog.housing.find(q=>q.id===housingId).rules.find(r=>r.id===housingRule.id).patterns.find(p=>p.id===housingProfile.id).renewals.length,0);assert.equal(JSON.stringify(current().n.actuals),renewActuals);
console.log('PASS housing renewal UI: monthly schedule, linked savings in independent source, no duplicate fund/rule/expense, invalid period rollback and preserved actuals/budgets');

// Notebook deletion is confirmed, scoped, recoverable and valid even after removing the last note.
nav('manage');let notebookState=current().s;const notebookIds=Object.keys(notebookState.notebooks),activeNotebook=notebookState.active,unusedNotebook=notebookIds.find(id=>id!==activeNotebook);
assert(unusedNotebook);const unusedSnapshot=JSON.stringify(notebookState.notebooks[unusedNotebook]),activeSnapshot=JSON.stringify(notebookState.notebooks[activeNotebook]);
assert(element('app').innerHTML.includes('notebook:'+activeNotebook));
click('note-delete',unusedNotebook);assert(element('editorFields').innerHTML.includes('共通実績'));assert(element('editorFields').innerHTML.includes(notebookState.notebooks[unusedNotebook].name));
const beforeNoteDelete=stored.get('finance-v4-state');element('editor').close();assert.equal(stored.get('finance-v4-state'),beforeNoteDelete);
click('note-delete',unusedNotebook);element('editorForm').onsubmit({preventDefault(){},target:[]});assert(element('formError').textContent.includes('確認'));assert.equal(stored.get('finance-v4-state'),beforeNoteDelete);assert(!stored.has('finance-v4-deleted-notebooks'));
submit({confirmDelete:'on'});assert(!current().s.notebooks[unusedNotebook]);assert.equal(JSON.stringify(current().n),activeSnapshot);assert.equal(JSON.stringify(JSON.parse(stored.get('finance-v4-deleted-notebooks'))[unusedNotebook].note),unusedSnapshot);
click('note-restore',unusedNotebook);assert.equal(current().s.active,unusedNotebook);assert.equal(JSON.stringify(current().n),unusedSnapshot);assert.equal(JSON.stringify(current().s.notebooks[activeNotebook]),activeSnapshot);assert(U.valid(current().s));
const beforeBadNote=stored.get('finance-v4-state');click('note-delete','not-a-note');assert.equal(stored.get('finance-v4-state'),beforeBadNote);click('note-restore','not-a-note');assert.equal(stored.get('finance-v4-state'),beforeBadNote);
click('note-delete',unusedNotebook);submit({confirmDelete:'on'});assert.notEqual(current().s.active,unusedNotebook);assert(current().s.notebooks[current().s.active]);assert.equal(JSON.stringify(current().s.notebooks[activeNotebook]),activeSnapshot);
for(const id of Object.keys(current().s.notebooks)){click('note-delete',id);submit({confirmDelete:'on'});}
assert.equal(data(),null);assert(element('app').innerHTML.includes('削除したノート'));assert(element('app').innerHTML.includes('まだノートがありません．'));
await vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8'),ctx);assert(element('app').innerHTML.includes('数字は，まだ何も入っていません'));assert(!element('saveStatus').textContent.includes('開けません'));
nav('manage');assert(element('app').innerHTML.includes('削除したノート'));click('note-restore',activeNotebook);assert(U.valid(current().s));assert.equal(JSON.stringify(current().n),activeSnapshot);
const restored=stored.get('finance-v4-state');await vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8'),ctx);assert.equal(stored.get('finance-v4-state'),restored);assert(element('app').innerHTML.includes('の実績'));
console.log('PASS notebooks: hidden actions, exact confirmation/cancel, unused/current/last delete, unchanged other notes, exact restore including actuals and budgets, invalid targets and reload with/without notes');

// Old household data is previewed first and added as a new note, without overwriting current notes.
const legacySample={format:'jp.household.book',schemaVersion:13,name:'昔の家計簿',categories:[{id:'pay',name:'給与',group:'給料',type:'income',defaultPlanned:300000}],months:[{month:'2026-04',status:'closed',values:{pay:{actual:280000,planned:300000}},comment:'旧メモ'}],planMonths:[{month:'2026-04',salary:300000}],openingBalances:{cash:10000,invest:0,other:0}},oldRaw=JSON.stringify(legacySample),beforeLegacy=stored.get('finance-v4-state'),beforeLegacyNotes=current().s.notebooks;
ctx.window.localStorage={getItem:k=>({'household-book-profiles-v1':'[{"id":"old","name":"昔の家計簿"}]','household-book-v1:old':oldRaw,'household-book-v1':oldRaw}[k]||null),setItem(){throw Error('旧データを書き換えない');},removeItem(){throw Error('旧データを削除しない');}};
click('legacy-open');assert(element('editorFields').innerHTML.includes('昔の家計簿'));click('legacy-browser-preview','0');assert(element('editorFields').innerHTML.includes('記録 1か月'));element('editor').close();assert.equal(stored.get('finance-v4-state'),beforeLegacy);
click('legacy-browser-preview','0');submit({name:'取り込んだノート'});let legacyCurrent=current();assert.equal(legacyCurrent.n.name,'取り込んだノート');assert.equal(legacyCurrent.n.actuals['2026-04'].note,'旧メモ');assert.equal(U.record(legacyCurrent.n,legacyCurrent.p,'2026-04').used.income,280000);for(const[id,n]of Object.entries(beforeLegacyNotes))assert.deepEqual(legacyCurrent.s.notebooks[id],n);assert.equal(ctx.window.localStorage.getItem('household-book-v1:old'),oldRaw);
const afterLegacy=stored.get('finance-v4-state');click('legacy-browser-preview','0');assert.equal(stored.get('finance-v4-state'),afterLegacy);assert(element('saveStatus').textContent.includes('取り込み済み'));
await element('legacyHouseholdFile').onchange({target:{files:[{size:12,text:async()=>'{bad json'}],value:'x'}});assert.equal(stored.get('finance-v4-state'),afterLegacy);assert(element('saveStatus').textContent.includes('読み込めません'));assert(U.valid(current().s));
console.log('PASS legacy UI: browser/profile preview and cancellation, exact new-note import, all existing notes/old storage unchanged, duplicate and invalid file rejection');

// Effective expense lifecycle through the actual UI handlers, with no user data.
click('section','living');click('pattern-create','living');let life=current(),lifeRule=life.p.rules.find(r=>r.patternType==='living'),lifeProfile=lifeRule.patterns[0],lifeKey=lifeRule.id+':'+lifeProfile.id;
const lifeActual=JSON.stringify(life.n.actuals),lifeBudget=JSON.stringify(life.p.budgets);
change({id:'plannedMonthPicker',value:'2026-06'});click('living-item',lifeKey);submit({category:'固定費',name:'期間テスト',month:'2026-06',monthly:'3000',annual:''});
let lifeItem=current().p.rules.find(r=>r.id===lifeRule.id).patterns[0].items.find(i=>i.name==='期間テスト');const lifeId='rule:'+lifeRule.id+':'+lifeItem.id,lifeCost=m=>U.planned(current().n,current().p,m).find(i=>i.id===lifeId)?.amount;
assert.equal(lifeCost('2026-05'),undefined);assert.equal(lifeCost('2026-06'),3000);
change({id:'plannedMonthPicker',value:'2026-08'});const lifeHtml=element('app').innerHTML;change({dataset:{livingItem:lifeKey+':'+lifeItem.id,livingKey:'monthly'},value:'4000'});assert.equal(element('app').innerHTML,lifeHtml);assert.equal(lifeCost('2026-07'),3000);assert.equal(lifeCost('2026-08'),4000);assert.equal(lifeCost('2027-01'),4000);
click('living-delete',lifeKey+':'+lifeItem.id);assert(element('editorFields').innerHTML.includes('この月から終了'));submit({month:'2026-10'});assert.equal(lifeCost('2026-09'),4000);assert.equal(lifeCost('2026-10'),undefined);change({id:'plannedMonthPicker',value:'2026-10'});assert(element('app').innerHTML.includes('過去・開始前の項目（1件）'));assert(!element('app').innerHTML.includes('data-living-item="'+lifeKey+':'+lifeItem.id+'"'));
click('living-item',lifeKey+':'+lifeItem.id);submit({category:'固定費',name:'期間テスト',month:'2026-10',monthly:'4500',annual:'',endedFrom:''});assert.equal(lifeCost('2026-10'),4500);assert.equal(lifeCost('2026-07'),3000);assert.equal(JSON.stringify(current().n.actuals),lifeActual);assert.equal(JSON.stringify(current().p.budgets),lifeBudget);assert(U.valid(current().s));
assert(element('app').innerHTML.includes('分類・費目を追加'));click('living-category-item',lifeKey);assert(element('editorFields').innerHTML.includes('分類名（新しい名前も追加できます）'));submit({category:'おこづかい',name:'おこづかい○',month:'2026-10',monthly:'10000',annual:''});assert(element('app').innerHTML.includes('生活費/おこづかい'));let customRows=U.planned(current().n,current().p,'2026-10');const customItem=customRows.find(i=>i.leafName==='おこづかい○');assert.deepEqual(U.recordUI.path(customItem),['支出','生活費','おこづかい']);click('cost-item-add',JSON.stringify([lifeRule.id,lifeProfile.id,'生活費','おこづかい']));assert(element('editorFields').innerHTML.includes('value="おこづかい"'));submit({category:'おこづかい',name:'おこづかい△',month:'2026-10',monthly:'20000',annual:''});assert.equal(U.recordUI.tree(U.planned(current().n,current().p,'2026-10'),{row:{values:{}}}).get('支出').children.get('生活費').children.get('おこづかい').planned,30000);assert.equal(JSON.stringify(current().n.actuals),lifeActual);assert.equal(JSON.stringify(current().p.budgets),lifeBudget);assert(U.valid(current().s));
const groupBase=current(),groupBefore=U.record(groupBase.n,groupBase.p,'2026-12').planned.expense,groupNote=groupBase.n.id,groupWhole=groupBase.p.id,groupActual=JSON.stringify(groupBase.n.actuals),groupBudget=JSON.stringify(groupBase.p.budgets),groupKey=JSON.stringify([lifeRule.id,lifeProfile.id,'生活費','おこづかい']);
assert(element('app').innerHTML.includes('中項目を削除'));assert(element('app').innerHTML.includes('大項目を削除'));
click('cost-group-delete',groupKey);assert(element('editorFields').innerHTML.includes('おこづかい○'));element('editor').close();assert.equal(U.record(current().n,current().p,'2027-01').planned.expense,groupBefore,'cancel does not change plans');
click('cost-group-delete',groupKey);submit({month:'2027-01'});let gp=current().p.rules.find(r=>r.id===lifeRule.id).patterns.find(p=>p.id===lifeProfile.id),deletedGroup=gp.hiddenGroups[0];assert.equal(U.record(current().n,current().p,'2026-12').planned.expense,groupBefore);assert.equal(U.record(current().n,current().p,'2027-01').planned.expense,groupBefore-30000);change({id:'plannedMonthPicker',value:'2027-01'});assert(!element('app').innerHTML.includes('data-keep="living:'+lifeProfile.id+':生活費/おこづかい"'));assert(element('app').innerHTML.includes('削除した分類（1件）'));assert(U.valid(current().s));
click('cost-group-restore',JSON.stringify([lifeRule.id,lifeProfile.id,deletedGroup.id]));submit({});assert.equal(U.record(current().n,current().p,'2027-01').planned.expense,groupBefore);assert(element('app').innerHTML.includes('data-keep="living:'+lifeProfile.id+':生活費/おこづかい"'));
click('cost-group-delete',JSON.stringify([lifeRule.id,lifeProfile.id,'生活費']));submit({month:'2027-02'});change({id:'plannedMonthPicker',value:'2027-02'});assert(!element('app').innerHTML.includes('data-keep="plan-cost:'+lifeProfile.id+':生活費"'));assert(U.planned(current().n,current().p,'2027-02').some(i=>i.id===lifeId),'fixed expenses survive deleting the living family');assert.equal(JSON.stringify(current().n.actuals),groupActual);assert.equal(JSON.stringify(current().p.budgets),groupBudget);assert.equal(current().n.id,groupNote);assert.equal(current().p.id,groupWhole);assert(U.valid(current().s));
console.log('PASS cost group UI: scoped middle/major deletion from month, cancellation, restore, hidden empty defaults, retained other groups and historical plans/actuals/budgets, valid JSON');
console.log('PASS cost lifecycle UI: dated add/change/end/restore, custom living category with multiple leaves, historical plans and common actuals/budgets preserved, stable input DOM, archived items and valid JSON');
nav('record');const deltaRows=U.planned(current().n,current().p,'2027-02'),deltaIncome=deltaRows.find(i=>i.kind==='income'),deltaPlanned=U.vector(deltaRows).income,deltaHTML=element('app').innerHTML,deltaBudget=JSON.stringify(current().p.budgets);assert(deltaIncome);change({dataset:{actual:deltaIncome.id},value:String(deltaPlanned+1000)});assert(element('actualMetrics').innerHTML.includes('delta-positive'));assert(element('actualMetrics').innerHTML.includes('＋1,000円'));change({dataset:{actual:deltaIncome.id},value:String(deltaPlanned-1000)});assert(element('actualMetrics').innerHTML.includes('−1,000円'));change({dataset:{actual:deltaIncome.id},value:''});assert(element('actualMetrics').innerHTML.includes('—（未入力）'));assert.equal(element('app').innerHTML,deltaHTML,'typing updates differences without replacing the entry form');assert.equal(JSON.stringify(current().p.budgets),deltaBudget);
console.log('PASS signed actual differences: live positive/negative/blank updates, stable input DOM and unchanged original budgets');
console.log('PASS restored UI flow: self/partner income estimates, living items, housing patterns, earmarked sinking purchase, investment conditions, master screens and complete JSON export');
console.log('PASS UI flow: blank onboarding; independent state key; create income; move event; actual entry; branch; outlook; JSON export; new empty notebook preserves old; invalid import unchanged');

// Event genres must classify by recurrence and open the adopted funds source.
click('begin');submit({name:'event groups',start:'2026-04',cash:'1000',invest:'',reserve:''});click('section','events');
click('event-new');assert(element('editorFields').innerHTML.includes('value="0" selected'));
submit({name:'一回のみテスト',month:'2026-06',kind:'expense',amount:'500',repeatMode:'0',end:'',enabled:'on'});
click('event-new-repeat');assert(element('editorFields').innerHTML.includes('value="1" selected'));
submit({name:'周期テスト',month:'2026-08',kind:'expense',amount:'30',repeatMode:'1',everyValue:'1',everyUnit:'12',end:'',enabled:'on'});
let groupedHTML=element('app').innerHTML;
const genre=(html,key,next)=>html.split('data-keep="events-category:'+key+'"')[1].split(next?'data-keep="events-category:'+next+'"':'</main>')[0];
assert(genre(groupedHTML,'once','repeat').includes('一回のみテスト'));assert(!genre(groupedHTML,'once','repeat').includes('周期テスト'));
assert(genre(groupedHTML,'repeat','funds').includes('周期テスト'));assert(!genre(groupedHTML,'repeat','funds').includes('一回のみテスト'));
const repeatEvent=current().p.events.find(e=>e.name==='周期テスト');click('event-edit',repeatEvent.id);
submit({name:'周期テスト',month:'2026-08',kind:'expense',amount:'30',repeatMode:'0',end:'',enabled:'on'});
groupedHTML=element('app').innerHTML;assert(genre(groupedHTML,'once','repeat').includes('周期テスト'));assert(!genre(groupedHTML,'repeat','funds').includes('周期テスト'));
click('event-sinking-new');submit({name:'採用中の冷蔵庫',fundId:'general',amount:'120000',everyValue:'10',everyUnit:'12',month:'2026-04',purchaseMonth:'',end:'',deposit:'',autoPurchase:'on',enabled:'on'});
const adoptedFunds=current().p.categorySelections.funds,adoptedSaving=current().p.events.find(e=>e.name==='採用中の冷蔵庫').id;
click('source-copy','funds');submit({name:'未採用の積立案'});const unusedFunds=current().n.categoryCatalog.funds.at(-1).id;
click('sinking-new');submit({name:'未採用のテレビ',fundId:'general',amount:'60000',everyValue:'5',everyUnit:'12',month:'2026-04',purchaseMonth:'',end:'',deposit:'',autoPurchase:'on',enabled:'on'});
const unusedBefore=JSON.stringify(current().n.categoryCatalog.funds.find(q=>q.id===unusedFunds)),actualBeforeGroup=JSON.stringify(current().n.actuals),budgetBeforeGroup=JSON.stringify(current().p.budgets);
click('section','events');groupedHTML=element('app').innerHTML;assert(genre(groupedHTML,'funds').includes('採用中の冷蔵庫'));assert(!groupedHTML.includes('未採用のテレビ'));
click('event-fund-edit',adoptedSaving);submit({name:'採用中の冷蔵庫',fundId:'general',amount:'150000',everyValue:'10',everyUnit:'12',month:'2026-04',purchaseMonth:'',end:'',deposit:'',autoPurchase:'on',enabled:'on'});
assert.equal(current().p.categorySelections.funds,adoptedFunds);assert.equal(current().p.events.find(e=>e.id===adoptedSaving).amount,150000);
assert.equal(JSON.stringify(current().n.categoryCatalog.funds.find(q=>q.id===unusedFunds)),unusedBefore);assert.equal(JSON.stringify(current().n.actuals),actualBeforeGroup);assert.equal(JSON.stringify(current().p.budgets),budgetBeforeGroup);
console.log('PASS event genres: recurrence grouping/defaults and reclassification; funds previews/editing use the adopted source and preserve unused sources, actuals and budgets');
// The new purpose graph must inspect views without altering the recorded data.
click('event-funds');assert(element('app').innerHTML.includes('用途別の積立・支出・残高を見る'));
click('fund-new');submit({name:'家電グラフ専用',initial:''});const chartFund=current().n.purposes.at(-1).id;
click('fund-rule',chartFund);submit({amount:'1000',start:'2026-04'});const beforeFundView=stored.get('finance-v4-state');
change({id:'fundChartPurpose',value:chartFund});change({id:'fundChartUnit',value:'month'});change({id:'fundChartYear',value:'2030'});
assert(element('app').innerHTML.includes('2030-04'));assert(element('app').innerHTML.includes('2031-03'));
const fundHTML=element('app').innerHTML,fundSVG=element('fundChart');fundSVG.dataset={left:'54',step:String((760-70)/12)};fundSVG.viewBox={baseVal:{width:760}};fundSVG.getBoundingClientRect=()=>({left:10,width:380});
listeners.pointerdown({type:'pointerdown',pointerType:'touch',buttons:1,clientX:10+(54+2.5*(760-70)/12)/2,target:{closest:selector=>selector==='#fundChart'?fundSVG:null}});
assert(element('fundPointDetails').innerHTML.includes('2030-06'));assert(element('fundPointDetails').innerHTML.includes('51,000円'));assert(element('fundPointDetails').innerHTML.includes('1,000円'));
click('fund-point-step','1');assert(element('fundPointDetails').innerHTML.includes('2030-07'));
listeners.input({target:{id:'fundPointSlider',value:'0'}});assert(element('fundPointDetails').innerHTML.includes('2030-04'));
assert.equal(element('app').innerHTML,fundHTML);assert.equal(stored.get('finance-v4-state'),beforeFundView);
change({id:'fundChartUnit',value:'year'});assert(element('app').innerHTML.includes('年度ごと'));assert.equal(stored.get('finance-v4-state'),beforeFundView);
console.log('PASS purpose graph: filter, month/year switch, fiscal boundaries, touch/slider/buttons, exact period balance and stable data');


// Composition is compact before tapping and adopted details live inside the matching category.
nav('outlook');const overview=element('app').innerHTML;
for(const type of U.patterns.categories.types){assert(overview.includes('data-keep="adopted-category:'+type+'"'));assert(!overview.includes('data-keep="adopted-category:'+type+'" open'));}
assert(overview.includes('<summary>本人の収入</summary>'));assert(overview.includes('<summary>イベント</summary>'));assert(overview.includes('data-adopt="children"'));
assert(!overview.includes('採用セットと切替時期の一覧'));
console.log('PASS compact composition: all nine adopted categories start collapsed with category-only summaries');
// Custom display dates filter every annual chart without restarting balance calculations or saving.
const beforeCustom=stored.get('finance-v4-state');
change({id:'chartRange',value:'custom'});change({id:'chartCustomStart',value:'2035'});change({id:'chartCustomEnd',value:'2040'});
assert(asset().includes('2035年度'));assert(asset().includes('2040年度'));assert(!asset().includes('2026年度'));assert(!asset().includes('2065年度'));
assert(element('app').innerHTML.includes('id="assetYearSlider" type="range" min="0" max="5"'));
const comparison=element('app').innerHTML.match(/<svg class="chart"[^>]*aria-label="案ごとの年度末の総資産">([\s\S]*?)<\/svg>/)[1];assert(comparison.includes('2035年度'));assert(comparison.includes('2040年度'));assert(!comparison.includes('2026年度'));
click('asset-year','2035');const real2035=U.annual(U.forecast(current().n,current().p,ctx.window.EDUCATION_MASTER)).find(v=>v.year===2035);assert(element('assetDetails').innerHTML.includes(yen(real2035.total)));
click('nisa-open');const customNisa=element('app').innerHTML.match(/<svg id="nisaChart"[\s\S]*?<\/svg>/)[0];assert(customNisa.includes('2035年度'));assert(customNisa.includes('2040年度'));assert(!customNisa.includes('2026年度'));
click('event-funds');const customFund=element('app').innerHTML.match(/<svg id="fundChart"[\s\S]*?<\/svg>/)[0];assert(customFund.includes('2035年度'));assert(customFund.includes('2040年度'));assert(!customFund.includes('2026年度'));
nav('outlook');change({id:'chartCustomEnd',value:'2030'});assert(asset().includes('2030年度'));assert(!asset().includes('2035年度'));assert(element('app').innerHTML.includes('id="assetYearSlider" type="range" min="0" max="0"'));
change({id:'chartCustomStart',value:'2042'});assert(asset().includes('2042年度'));assert(!asset().includes('2030年度'));
change({id:'chartCustomStart',value:'bad'});assert(asset().includes('2042年度'));
change({id:'chartRange',value:'life'});assert(asset().includes('2100年度'));change({id:'chartRange',value:'work'});assert(asset().includes('2065年度'));
assert.equal(stored.get('finance-v4-state'),beforeCustom);
console.log('PASS custom chart ranges: exact start/end, aligned comparison axis, NISA/funds, calculated balance continuity, one-year/reversed/invalid bounds and unchanged saved data');
{
// Detail editing must use the adopted source even after browsing an unused copied source.
nav('outlook');assert(element('app').innerHTML.includes('data-action="adopted-item-edit"'));
const beforeDetailOpen=stored.get('finance-v4-state'),unusedBefore=JSON.stringify(current().n.categoryCatalog.funds.find(q=>q.id===unusedFunds)),actualBefore=JSON.stringify(current().n.actuals),budgetBefore=JSON.stringify(current().p.budgets);
click('adopted-item-edit',JSON.stringify({type:'funds',id:adoptedSaving}));assert(element('editorFields').innerHTML.includes('採用中の冷蔵庫'));assert(!element('editorFields').innerHTML.includes('未採用のテレビ'));assert.equal(stored.get('finance-v4-state'),beforeDetailOpen);
submit({name:'採用中の冷蔵庫',fundId:'general',amount:'120123',everyValue:'10',everyUnit:'12',month:'2026-04',purchaseMonth:'',end:'',deposit:'',autoPurchase:'on',enabled:'on'});
assert.equal(current().p.events.find(e=>e.id===adoptedSaving).amount,120123);assert.equal(JSON.stringify(current().n.categoryCatalog.funds.find(q=>q.id===unusedFunds)),unusedBefore);assert.equal(JSON.stringify(current().n.actuals),actualBefore);assert.equal(JSON.stringify(current().p.budgets),budgetBefore);
nav('outlook');const eventToEdit=current().p.events.find(e=>!e.sinking);click('adopted-item-edit',JSON.stringify({type:'events',id:eventToEdit.id}));assert(element('editorFields').innerHTML.includes(eventToEdit.name));element('editor').close();
click('section','children');click('child-new');submit({...childFields('編集リンク確認の子','2029'),'choice-high':'高校/私立'});const linkedChild=current().p.children.at(-1);nav('outlook');click('adopted-item-edit',JSON.stringify({type:'children',id:linkedChild.id}));assert(element('editorFields').innerHTML.includes('編集リンク確認の子'));assert(element('editorFields').innerHTML.includes('高校/私立'));element('editor').close();
console.log('PASS detail editing: adopted event/fund/child opens exact editor; unused source, shared actuals and budgets preserved');
}
{
nav('outlook');const beforeGenres=stored.get('finance-v4-state'),h=element('app').innerHTML,eventsHTML=h.slice(h.indexOf('data-keep="adopted-category:events"'),h.indexOf('data-keep="adopted-category:children"'));
assert(eventsHTML.indexOf('adopted-events-genre:once')<eventsHTML.indexOf('adopted-events-genre:repeat'));assert(eventsHTML.indexOf('adopted-events-genre:repeat')<eventsHTML.indexOf('adopted-events-genre:funds'));
const boundaries=['once','repeat','funds'];for(let k=0;k<2;k++){const genre=eventsHTML.slice(eventsHTML.indexOf('adopted-events-genre:'+boundaries[k]),eventsHTML.indexOf('adopted-events-genre:'+boundaries[k+1])),expected=current().p.events.filter(e=>!e.sinking&&(k?U.N(e.every)>0:U.N(e.every)<=0)).sort((a,b)=>a.month.localeCompare(b.month));let last=-1;for(const e of expected){const pos=genre.indexOf('adopted-item:events:'+e.id);assert(pos>last,'events follow their scheduled month inside their genre');last=pos;}assert(!genre.includes('data-keep="adopted-events-genre:'+boundaries[k]+'" open'));}
assert(eventsHTML.includes('<summary>採用中の冷蔵庫</summary>'));assert(!eventsHTML.includes('<summary>未採用のテレビ</summary>'));assert(eventsHTML.includes('採用する用途別積立の案'));assert.equal(stored.get('finance-v4-state'),beforeGenres);
console.log('PASS adopted event genres: one-off/recurring/funds order, exact date order, adopted savings only, collapsed titles and no saved data changes');
}
})();

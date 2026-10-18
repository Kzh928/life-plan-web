// Exercise UI actions, form submissions and import/export with a minimal DOM, no browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),U=require('../core.js');
require('../patterns.js');
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
click('income-partner');cc=current();assert(cc.p.rules.some(r=>r.owner==='partner'));click('pattern-create','living');cc=current();const living=cc.p.rules.find(r=>r.patternType==='living');click('living-item',living.id+':'+living.patterns[0].id);submit({name:'食費',monthly:'60,000',annual:'120,000'});cc=current();assert.equal(U.record(cc.n,cc.p,'2026-10').planned.expense,70000);
click('pattern-create','housing');cc=current();const housing=cc.p.rules.find(r=>r.patternType==='housing');click('pattern-edit',housing.id+':'+housing.patterns[0].id);submit({name:'今の家',monthly:'130,000',annual:'24,000'});cc=current();assert.equal(U.record(cc.n,cc.p,'2026-10').planned.expense,202000);
click('fund-new');submit({name:'家電',initial:''});cc=current();const fund=cc.n.purposes[0];click('sinking-new');submit({name:'冷蔵庫',fundId:fund.id,amount:'120,000',every:'120',month:'2026-10',purchaseMonth:'',end:'',deposit:'',autoPurchase:'on',enabled:'on'});cc=current();assert.equal(U.record(cc.n,cc.p,'2026-10').planned.reserve,1000);
click('investment-edit');submit({annualCap:'1,000,000',lifetimeCap:'10,000,000',restore:'nextYear',cashFloor:'100,000',drawdown:'on'});cc=current();assert.equal(cc.p.investment.annualCap,1000000);assert(U.valid(cc.s));
click('section','master');assert(element('app').innerHTML.includes('教育費マスタの確認'));click('section','income');assert(element('app').innerHTML.includes('本人・パートナーの収入'));click('section','funds');assert(element('app').innerHTML.includes('冷蔵庫'));click('export');assert(element('saveStatus').textContent.includes('JSON'));
// Return one screen from self to the income list, retaining the previous scroll.
click('section','income');ctx.window.scrollY=321;click('patterns',current().p.rules.find(r=>r.owner==='self').id);let restoredScroll=null;ctx.window.scrollTo=(x,y)=>restoredScroll=y;click('back');assert(element('app').innerHTML.includes('本人・パートナーの収入'));assert.equal(restoredScroll,321);
// Income-only alternatives capture the complete owner bundle.
const baseIncome=current().p.activeIncomeScenario;click('income-scenario-new');submit({name:'専業主婦の案'});assert.equal(current().p.incomeScenarios.length,2);assert(element('app').innerHTML.includes('専業主婦の案'));change({id:'incomeScenarioSelect',value:baseIncome});assert.equal(current().p.activeIncomeScenario,baseIncome);
click('sinking-new');assert(element('editorFields').innerHTML.includes('everyUnit'));submit({name:'10年で買替',fundId:fund.id,amount:'120000',everyValue:'10',everyUnit:'12',month:'2026-10',purchaseMonth:'',end:'',deposit:'',autoPurchase:'on',enabled:'on'});assert.equal(current().p.events.at(-1).every,120);
click('event-new');submit({name:'2年ごと',month:'2026-10',kind:'expense',amount:'1000',repeatMode:'1',everyValue:'2',everyUnit:'12',end:'',enabled:'on'});assert.equal(current().p.events.at(-1).every,24);
nav('outlook');assert(element('app').innerHTML.includes('年度末資産の内訳と年間収支'));assert(element('app').innerHTML.includes('案ごとの年度末の総資産'));
console.log('PASS restored UI flow: self/partner income estimates, living items, housing patterns, earmarked sinking purchase, investment conditions, master screens and complete JSON export');
console.log('PASS UI flow: blank onboarding; independent state key; create income; move event; actual entry; branch; outlook; JSON export; new empty notebook preserves old; invalid import unchanged');
})();

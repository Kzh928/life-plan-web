// Exercise UI actions, form submissions and import/export with a minimal DOM, no browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),U=require('../core.js');
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
click('begin');assert(element('editorFields').innerHTML.includes('name="cash" type="number" value=""'));submit({name:'test',start:'2026-10',cash:'100000',invest:'',reserve:''});assert.equal(current().p.rules.length,0);assert(element('app').innerHTML.includes('この月には，何が入る'));
click('rule-new');submit({name:'給料',kind:'income',group:'給与',amount:'300000',start:'2026-10',end:''});let c=current();assert.equal(c.p.rules[0].amount,300000);
click('event-new');submit({name:'旅行',month:'2026-11',kind:'expense',amount:'50000',every:'0',end:'',enabled:'on'});const eid=current().p.events[0].id;
click('event-edit',eid);submit({name:'旅行',month:'2026-12',kind:'expense',amount:'60000',every:'0',end:'',enabled:'on'});assert.equal(current().p.events[0].month,'2026-12');
nav('record');assert(element('app').innerHTML.includes('給料の実績'));const rid=current().p.rules[0].id;change({dataset:{actual:'rule:'+rid},value:'280000'});c=current();assert.equal(c.n.actuals['2026-10'].values['rule:'+rid].amount,280000);
click('branch');submit({name:'別案'});c=current();assert.equal(Object.keys(c.n.plans).length,2);assert.equal(c.n.actuals['2026-10'].values['rule:'+rid].amount,280000);
nav('outlook');assert(element('app').innerHTML.includes('年度末資産'));click('export');assert(element('saveStatus').textContent.includes('JSON'));
click('begin');submit({name:'empty',start:'2026-10',cash:'',invest:'',reserve:''});c=current();assert.equal(Object.keys(c.s.notebooks).length,2);assert.equal(c.p.rules.length,0);assert.equal(Object.keys(c.n.actuals).length,0);assert.equal(c.n.openingEntered,false);
// Failed import leaves the existing data unchanged.
const before=stored.get('finance-v4-state');await element('importFile').onchange({target:{files:[{text:async()=>'{"format":"jp.finance.v3"}'}],value:'x'}});assert.equal(stored.get('finance-v4-state'),before);
console.log('PASS UI flow: blank onboarding; independent state key; create income; move event; actual entry; branch; outlook; JSON export; new empty notebook preserves old; invalid import unchanged');
})();

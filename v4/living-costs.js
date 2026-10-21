(function(root){
'use strict';
const U=root.MoneyV4||(typeof require==='function'?require('./core.js'):null),X=U.patterns;
const templates=[...['家','家り','外１','外り','外友','食堂','飲み'].map(name=>({category:'食費',name})),...['仕事','り','他'].map(name=>({category:'交通費',name})),...['日用品','医療','被服','旅行','趣味','ビジネス','交際費'].map(name=>({category:'',name})),...['電気','ガス','水道','通信','サブスク'].map(name=>({category:'固定費',name})),...['①るり','②スマホ','③家族'].map(name=>({category:'定期支出',name}))];
const path=i=>(i.category?i.category+' / ':'')+i.name;
// Undated values are the historical baseline. Dated patches replace fields,
// never add another expense, and keep the stable item ID used by actuals.
function active(i,m){return !m||(!i.start||i.start<=m)&&(!i.end||m<=i.end)&&(!i.endedFrom||m<i.endedFrom);}
function at(i,m){const v={...i};if(m)for(const c of (i.costChanges||[]).slice().sort((a,b)=>a.month.localeCompare(b.month)))if(c.month<=m)Object.assign(v,c);return v;}
function change(i,m,values){if(!U.validMonth(m))throw Error('反映する月を確認してください．');const list=i.costChanges||=[],c=list.find(c=>c.month===m);if(c)Object.assign(c,values);else list.push({month:m,...values});i.costChanges=list.sort((a,b)=>a.month.localeCompare(b.month));}
const categories=p=>[...new Set(p.items.filter(i=>i.category).map(i=>i.category))];
const total=(p,c)=>p.items.find(i=>!i.category&&i.name===c);
const mode=(p,c)=>(p.groupModes&&Object.hasOwn(p.groupModes,c)?p.groupModes[c]:null)||(total(p,c)?'total':'details');
function included(p,i){if(i.category&&total(p,i.category))return mode(p,i.category)==='details';if(!i.category&&categories(p).includes(i.name))return mode(p,i.name)==='total';return true;}
function addTemplates(p){let added=0;for(const t of templates){if(p.items.some(i=>i.name===t.name&&(i.category||'')===t.category))continue;const existing=p.items.find(i=>!i.category&&(i.name===t.name||i.name===path(t)));if(existing){existing.name=t.name;existing.category=t.category;continue;}p.items.push({id:U.uid(),...t,monthly:null,annual:null,inflation:false});added++;}return added;}
function summary(p,c,m){const q={...p,items:p.items.filter(i=>active(i,m))};return q.items.filter(i=>included(q,i)&&(c===undefined||(i.category||(!i.category&&categories(q).includes(i.name)?i.name:''))===c)).reduce((s,i)=>{const v=at(i,m);return s+U.N(v.monthly)+U.N(v.annual)/12;},0);}
const oldItems=X.livingItems;
X.livingItems=function(r,m,p){const original=X.selected(r,m);if(!original||X.present(r.annualYears?.[U.fy(m)]))return oldItems(r,m,p);const q={...original,items:original.items.filter(i=>active(i,m)).map(i=>at(i,m))};return q.items.filter(i=>included(q,i)).map(i=>({id:i.id==='base'?'rule:'+r.id:'rule:'+r.id+':'+i.id,source:'rule',sourceId:r.id,name:path(i),leafName:i.name,kind:'expense',group:r.group||'生活費',subgroup:i.category||(!i.category&&categories(q).includes(i.name)?i.name:''),patternName:q.name,amount:(U.N(i.monthly)+U.N(i.annual)/12)*(i.inflation?Math.pow(1+U.N(p.inflation)/100,Math.max(0,U.fy(m)-U.fy(r.start))):1)}));};
const oldAmount=X.patternAmount;X.patternAmount=function(r,m,p){if(r.patternType!=='housing')return oldAmount(r,m,p);const q=X.selected(r,m);if(!q)return null;const v=at(q,m);return (U.N(v.monthly)+U.N(v.annual)/12)*(v.inflation?Math.pow(1+U.N(p.inflation)/100,Math.max(0,U.fy(m)-U.fy(r.start))):1);};
const api={templates,path,categories,total,mode,included,addTemplates,summary,active,at,change};root.MoneyLiving=api;U.living=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);


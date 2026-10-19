(function(root){
'use strict';
const U=root.MoneyV4||(typeof require==='function'?require('./core.js'):null),X=U.patterns;
const templates=[...['家','家り','外１','外り','外友','食堂','飲み'].map(name=>({category:'食費',name})),...['仕事','り','他'].map(name=>({category:'交通費',name})),...['日用品','医療','被服','旅行','趣味','ビジネス','交際費'].map(name=>({category:'',name})),...['電気','ガス','水道','通信','サブスク'].map(name=>({category:'固定費',name})),...['①るり','②スマホ','③家族'].map(name=>({category:'定期支出',name}))];
const path=i=>(i.category?i.category+' / ':'')+i.name;
const categories=p=>[...new Set(p.items.filter(i=>i.category).map(i=>i.category))];
const total=(p,c)=>p.items.find(i=>!i.category&&i.name===c);
const mode=(p,c)=>(p.groupModes&&Object.hasOwn(p.groupModes,c)?p.groupModes[c]:null)||(total(p,c)?'total':'details');
function included(p,i){if(i.category&&total(p,i.category))return mode(p,i.category)==='details';if(!i.category&&categories(p).includes(i.name))return mode(p,i.name)==='total';return true;}
function addTemplates(p){let added=0;for(const t of templates){if(p.items.some(i=>i.name===t.name&&(i.category||'')===t.category))continue;const existing=p.items.find(i=>!i.category&&(i.name===t.name||i.name===path(t)));if(existing){existing.name=t.name;existing.category=t.category;continue;}p.items.push({id:U.uid(),...t,monthly:null,annual:null,inflation:false});added++;}return added;}
function summary(p,c){return p.items.filter(i=>included(p,i)&&(c===undefined||(i.category||(!i.category&&categories(p).includes(i.name)?i.name:''))===c)).reduce((s,i)=>s+U.N(i.monthly)+U.N(i.annual)/12,0);}
const oldItems=X.livingItems;
X.livingItems=function(r,m,p){const q=X.selected(r,m);if(!q||X.present(r.annualYears?.[U.fy(m)]))return oldItems(r,m,p);return q.items.filter(i=>included(q,i)).map(i=>({id:i.id==='base'?'rule:'+r.id:'rule:'+r.id+':'+i.id,source:'rule',sourceId:r.id,name:path(i),leafName:i.name,kind:'expense',group:r.group||'生活費',subgroup:i.category||(!i.category&&categories(q).includes(i.name)?i.name:''),patternName:q.name,amount:(U.N(i.monthly)+U.N(i.annual)/12)*(i.inflation?Math.pow(1+U.N(p.inflation)/100,Math.max(0,U.fy(m)-U.fy(r.start))):1)}));};
const api={templates,path,categories,total,mode,included,addTemplates,summary};root.MoneyLiving=api;U.living=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

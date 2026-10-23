// Apply only the current editing changes to other sources of the same category.
(function(root){'use strict';
const U=root.MoneyV4||(typeof require==='function'?require('./core.js'):null),copy=v=>v===undefined?undefined:U.C(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),obj=v=>v&&typeof v==='object'&&!Array.isArray(v),keyed=a=>a.every(v=>obj(v)&&typeof v.id==='string');
function delta(before,after){
 if(same(before,after))return null;
 if(Array.isArray(before)&&Array.isArray(after)&&keyed(before)&&keyed(after)){
  const old=new Map(before.map(v=>[v.id,v])),next=new Map(after.map(v=>[v.id,v]));
  return {op:'list',remove:before.filter(v=>!next.has(v.id)).map(v=>v.id),add:after.filter(v=>!old.has(v.id)).map(copy),edit:after.filter(v=>old.has(v.id)).map(v=>[v.id,delta(old.get(v.id),v)]).filter(([,d])=>d)};
 }
 if((obj(before)||before===undefined)&&obj(after)){const fields={},old=before||{};for(const k of new Set([...Object.keys(old),...Object.keys(after)])){if(!Object.hasOwn(after,k))fields[k]={op:'delete'};else {const d=delta(old[k],after[k]);if(d)fields[k]=d;}}return {op:'object',fields};}
 return {op:'set',value:copy(after)};
}
function apply(target,d){
 if(!d)return copy(target);if(d.op==='set')return copy(d.value);
 if(d.op==='object'){const out=obj(target)?copy(target):{};for(const [k,v]of Object.entries(d.fields)){if(v.op==='delete')delete out[k];else out[k]=apply(out[k],v);}return out;}
 const out=(Array.isArray(target)?copy(target):[]).filter(v=>!d.remove.includes(v.id));
 for(const v of d.add){const i=out.findIndex(x=>x.id===v.id);if(i<0)out.push(copy(v));else out[i]=copy(v);}
 for(const [id,change]of d.edit){const i=out.findIndex(v=>v.id===id);if(i>=0)out[i]=apply(out[i],change);}
 return out;
}
const content=q=>Object.fromEntries(Object.entries(q).filter(([k])=>!['id','name','parentId'].includes(k)));
function spread(n,type,id,before,ids){
 const list=n.categoryCatalog[type],source=list?.find(q=>q.id===id);if(!source)throw Error('編集中の案を確認してください．');
 const targets=[...new Set(ids)].filter(v=>v!==id);if(targets.some(v=>!list.some(q=>q.id===v)))throw Error('反映先の案を選び直してください．');
 const patch=delta(content(before),content(source));if(!patch)return {count:0,changed:false};
 const next=U.C(n);for(const target of next.categoryCatalog[type].filter(q=>targets.includes(q.id))){const value=apply(content(target),patch);for(const k of Object.keys(target))if(!['id','name','parentId'].includes(k))delete target[k];Object.assign(target,value);}
 U.patterns.categories.applyAll(next);U.valid(U.fresh(next));
 n.categoryCatalog=next.categoryCatalog;n.plans=next.plans;return {count:targets.length,changed:true};
}
U.sourceSpread={delta,apply,spread};if(typeof module!=='undefined')module.exports=U.sourceSpread;
})(typeof window==='undefined'?globalThis:window);

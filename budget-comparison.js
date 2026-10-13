// 当初予算と実績入力前の予想を，普段編集する予定から独立して保存します．
window.PlanBudget = (() => {
  const keys = ['income','expense','investment','reserve'];
  const amount = v => v === '' || v == null ? null : Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1e12 ? Number(v) : null;
  const validMonth = m => /^(19|20|21|22|23)\d{2}-(0[1-9]|1[0-2])$/.test(m);
  const flow = value => Object.fromEntries(keys.map(k=>[k,amount(value?.[k])]));
  function state(owner) {
    const s=owner.budgetComparison ||= {version:1,baselines:{},forecasts:{}};
    s.baselines ||= {};s.forecasts ||= {};return s;
  }
  function months(year) {
    if(!Number.isInteger(Number(year))||year<1900||year>2299)throw Error('年度は1900〜2299で入力してください．');
    return Array.from({length:12},(_,i)=>`${Number(year)+(i>=9?1:0)}-${String((i+3)%12+1).padStart(2,'0')}`);
  }
  function setBaseline(owner,month,key,value) {
    if(!validMonth(month)||!keys.includes(key)||value!==''&&value!=null&&amount(value)===null)throw Error('0以上1兆円以下の金額を入力してください．');
    const s=state(owner);s.baselines[month] ||= flow();s.baselines[month][key]=amount(value);
  }
  function distribute(owner,year,values) {
    const ms=months(year),v=flow(values);
    for(const k of keys)if(values[k]!==''&&values[k]!=null&&v[k]===null)throw Error('0以上1兆円以下の金額を入力してください．');
    for(const k of keys){if(values[k]===''||values[k]==null)continue;const total=Math.round(v[k]),base=Math.floor(total/12);ms.forEach((m,i)=>setBaseline(owner,m,k,base+(i===11?total-base*12:0)));}
  }
  function capture(owner,month,values,hasActual=false,origin='manual') {
    if(!validMonth(month))return false;
    const s=state(owner);if(s.forecasts[month])return false;
    s.forecasts[month]={values:flow(values),capturedAt:new Date().toISOString(),timing:hasActual?'afterActual':'beforeActual',origin};return true;
  }
  const diff=(a,b)=>a==null||b==null?null:a-b;
  function aggregate(rows,kind,key){const available=rows.filter(r=>r[kind]?.[key]!=null);return {count:available.length,total:available.reduce((sum,r)=>sum+r[kind][key],0)};}
  function merge(owner,incoming){if(!incoming||typeof incoming!=='object')return;const target=state(owner);for(const [m,v]of Object.entries(incoming.baselines||{}))if(validMonth(m)&&!Object.hasOwn(target.baselines,m))target.baselines[m]=flow(v);for(const [m,v]of Object.entries(incoming.forecasts||{}))if(validMonth(m)&&!target.forecasts[m]&&['beforeActual','afterActual'].includes(v?.timing))target.forecasts[m]={values:flow(v.values),timing:v.timing,capturedAt:String(v.capturedAt||''),origin:'householdImport'};}
  return {keys,flow,state,months,setBaseline,distribute,capture,diff,aggregate,merge};
})();

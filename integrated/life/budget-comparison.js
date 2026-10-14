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
  function range(from,to) {
    if(!validMonth(from)||!validMonth(to)||from>to)throw Error('開始月と終了月をYYYY-MMで入力してください．');
    const serial=m=>Number(m.slice(0,4))*12+Number(m.slice(5))-1,start=serial(from),end=serial(to);
    if(end-start>=960)throw Error('まとめて設定できる期間は80年以内です．');
    return Array.from({length:end-start+1},(_,i)=>`${Math.floor((start+i)/12)}-${String((start+i)%12+1).padStart(2,'0')}`);
  }
  function preview(owner,{from,to,mode='replace',values}) {
    if(!['replace','add','copy'].includes(mode))throw Error('設定方法が不正です．');
    const ms=range(from,to),s=state(owner),changes=[];
    for(const month of ms){const v=mode==='copy'?values[month]:values;
      for(const key of keys){const raw=v?.[key];if(raw===''||raw==null)continue;
        const value=amount(raw);if(value===null)throw Error('0以上1兆円以下の金額を入力してください．');
        const before=amount(s.baselines[month]?.[key]);if(mode==='add'&&before===null)throw Error(`${month}の${key==='expense'?'支出':key==='income'?'収入':key==='investment'?'NISA・投資':'用途別貯金'}は当初予算が未入力です．先に毎月の基本額を設定してください．`);
        const after=mode==='add'?before+value:value;if(amount(after)===null)throw Error('合計が1兆円を超えています．');
        if(before!==after)changes.push({month,key,before,after});
      }
    }
    if(!changes.length)throw Error('変更する金額を入力してください．同じ金額の場合は変更されません．');
    return {from,to,mode,changes};
  }
  function apply(owner,draft) {
    const s=state(owner);
    for(const c of draft.changes){if(!validMonth(c.month)||!keys.includes(c.key)||amount(c.after)===null||amount(s.baselines[c.month]?.[c.key])!==c.before)throw Error('予算が変更されています．もう一度プレビューしてください．');}
    for(const c of draft.changes)setBaseline(owner,c.month,c.key,c.after);
    s.lastBatch=JSON.parse(JSON.stringify(draft));
  }
  function undo(owner) {
    const s=state(owner),draft=s.lastBatch;if(!draft)throw Error('戻せるまとめ設定はありません．');
    for(const c of draft.changes)if(amount(s.baselines[c.month]?.[c.key])!==c.after)throw Error('設定後に月別予算を編集したため戻せません．月別欄で調整してください．');
    for(const c of draft.changes)setBaseline(owner,c.month,c.key,c.before);
    delete s.lastBatch;
  }
  return {keys,flow,state,months,setBaseline,distribute,capture,diff,aggregate,merge,range,preview,apply,undo};
})();

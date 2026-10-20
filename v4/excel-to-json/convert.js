(function(root){
'use strict';
const X=root.LocalXlsx||(typeof require==='function'?require('./xlsx-reader.js'):null),ym=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m||''),norm=s=>String(s||'').normalize('NFKC').trim();
function value(sheet,row,col){if(!col)return null;const ref=String(col).toUpperCase()+row,c=sheet.cells.get(ref);if(c?.error)throw Error(sheet.name+'!'+ref+'がExcelのエラー値です．');if(c?.missing)throw Error(sheet.name+'!'+ref+'の計算結果が未保存です．Excelで再計算して保存してください．');return c?.value??null;}
function number(v,where){if(typeof v==='string'&&v.trim()!=='')v=Number(v.replaceAll(',','').replaceAll('円','').trim());if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error(where+'は0円以上の金額が必要です．空欄を0円には変換しません．');return v;}
function month(v,m,book){
 if(m.timeKind==='year'){const y=Number(v);if(!Number.isInteger(y)||y<1900||y>2100)throw Error('年度は1900〜2100の西暦で指定してください．');return y+'-'+String(m.firstMonth||4).padStart(2,'0');}
 if(typeof v==='number'){const d=new Date(Date.UTC(book.date1904?1904:1899,book.date1904?0:11,book.date1904?1:30)+v*86400000);return d.toISOString().slice(0,7);}
 const text=norm(v).replace(/[年月/.]/g,'-').replace(/日.*$/,'').slice(0,10),a=/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(text);if(!a)throw Error('年月は2026-04のように指定してください．');return a[1]+'-'+a[2].padStart(2,'0');
}
function suggest(book){
 const maps=[];let ownerIndex=0;
 for(const s of book.sheets){let head=null;for(const[ref,c]of s.cells)if(c.value==='年度'&&Number(ref.match(/\d+/)[0])<=15){head={row:Number(ref.match(/\d+/)[0]),col:ref.match(/[A-Z]+/)[0]};break;}if(!head)continue;
  const labels=[];for(const[ref,c]of s.cells){const row=Number(ref.match(/\d+/)[0]);if(row>head.row&&row<=head.row+3&&typeof c.value==='string'&&/正社員|パート|育休|専業|無職|フルタイム|再雇用|時短|契約/.test(c.value))labels.push({row,col:ref.match(/[A-Z]+/)[0],name:c.value});}
  if(!labels.length)continue;const owner=ownerIndex++===0?'self':'partner';
  for(const label of labels){const rows=[...s.cells].filter(([r,c])=>r.match(/[A-Z]+/)[0]===head.col&&Number(r.match(/\d+/)[0])>label.row&&typeof c.value==='number'&&c.value>=1900&&c.value<=2100).map(([r])=>Number(r.match(/\d+/)[0]));if(!rows.length)continue;
   maps.push({enabled:true,sheet:s.name,owner,name:label.name,timeColumn:head.col,timeKind:'year',firstMonth:4,startRow:Math.min(...rows),endRow:Math.max(...rows),mode:'annual',amountColumn:label.col,bonus1Column:'',bonus1Month:6,bonus2Column:'',bonus2Month:12,useFrom:''});}
 }
 // Read generic stage tables (label / start year / referenced style) when present.
 let group=0;for(const s of book.sheets)for(let r=1;r<=Math.min(s.maxRow,100);r++)for(let c=1;c<=Math.min(s.maxCol,40);c++){const heading=s.cells.get(X.columnName(c)+r)?.value;if(typeof heading!=='string'||!heading.includes('働き方')||s.cells.get(X.columnName(c+1)+r)?.value!=='開始年')continue;const owner=group++===0?'self':'partner';for(let next=r+1;next<Math.min(s.maxRow+1,r+8);next++){const y=s.cells.get(X.columnName(c+1)+next)?.value,label=s.cells.get(X.columnName(c+2)+next)?.value;if(typeof y==='number'&&y>=1900&&y<=2100&&label){const m=maps.find(m=>m.owner===owner&&norm(m.name)===norm(label));if(m&&!m.useFrom)m.useFrom=y+'-04';}}}
 return maps;
}
function convert(book,mappings){
 const groups=new Map(),preview=[],warnings=[];
 for(const m of mappings.filter(m=>m.enabled!==false)){
  const sheet=book.sheets.find(s=>s.name===m.sheet);if(!sheet)throw Error('対象シートを選んでください．');if(!['self','partner'].includes(m.owner)||!['annual','monthly'].includes(m.mode)||!norm(m.name))throw Error('対象者・働き方・入力方式を確認してください．');
  const a=Number(m.startRow),b=Number(m.endRow);if(!Number.isInteger(a)||!Number.isInteger(b)||a<1||b<a||b-a>10000)throw Error('読み取る行の範囲を確認してください．');X.column(m.timeColumn);X.column(m.amountColumn);for(const col of [m.bonus1Column,m.bonus2Column])if(col)X.column(col);
  const g=groups.get(m.owner)||{owner:m.owner,name:'Excelからの収入案',patterns:[],stages:[],start:null,end:''},p={id:'style'+(g.patterns.length+1),name:norm(m.name),years:{}},seen=new Set(),salaries=[],bonuses=[];
  for(let row=a;row<=b;row++){
   const time=value(sheet,row,m.timeColumn);if(time===null||time==='')continue;const date=month(time,m,book);if(!ym(date)||Number(date.slice(0,4))<1900||Number(date.slice(0,4))>2100)throw Error('対象年月が範囲外です．');if(seen.has(date))throw Error(sheet.name+'の年月・年度が重複しています：'+date);seen.add(date);
   const amount=number(value(sheet,row,m.amountColumn),sheet.name+'!'+m.amountColumn+row);g.start=g.start===null||date<g.start?date:g.start;
   if(m.mode==='annual'){if(Number(m.firstMonth||4)!==4)throw Error('年間手取りは4月始まりの年度で指定してください．');if(m.timeKind!=='year')throw Error('年間手取りは「年度の列」を指定してください．');p.years[date.slice(0,4)]={netAnnual:amount};preview.push({owner:m.owner,style:p.name,month:date.slice(0,4)+'年度',kind:'年間手取り',amount});}
   else{
    salaries.push({from:date,netMonthly:amount});preview.push({owner:m.owner,style:p.name,month:date,kind:'月給・手取り',amount});
    for(let i=1;i<=2;i++){const col=m['bonus'+i+'Column'];if(!col)continue;const v=value(sheet,row,col);if(v===null||v==='')continue;const amount=number(v,sheet.name+'!'+col+row),bm=Number(m['bonus'+i+'Month']);if(!Number.isInteger(bm)||bm<1||bm>12)throw Error('賞与月は1〜12で指定してください．');if(m.timeKind==='month'&&Number(date.slice(5))!==bm)throw Error(sheet.name+'!'+col+row+'の賞与月が行の年月と一致しません．');const year=Number(date.slice(0,4))+(m.timeKind==='year'&&bm<Number(m.firstMonth||4)?1:0),target=year+'-'+String(bm).padStart(2,'0');bonuses.push({month:target,net:amount});preview.push({owner:m.owner,style:p.name,month:target,kind:'賞与・手取り',amount});}
   }
  }
  if(!seen.size)throw Error(sheet.name+'に対象の年月・金額がありません．');
  if(m.mode==='monthly'){
   salaries.sort((a,b)=>a.from.localeCompare(b.from));p.salaryChanges=salaries.filter((s,i)=>i===0||s.netMonthly!==salaries[i-1].netMonthly);bonuses.sort((a,b)=>a.month.localeCompare(b.month));const dates=new Set();for(const v of bonuses){if(dates.has(v.month))throw Error('同じ働き方の同月の賞与が重複しています：'+v.month);dates.add(v.month);}p.bonuses=bonuses;
   warnings.push(p.name+'：最後の月給は，次の変更まで翌年度以降も引き継ぎます．賞与は記載の支給月だけです．');
  }else warnings.push(p.name+'：記載のない年度の手取りは0円です．年間手取りに含まれる賞与は分割しません．');
  if(m.useFrom){if(!ym(m.useFrom))throw Error('働き方の使用開始月を確認してください．');g.stages.push({month:m.useFrom,patternId:p.id});}
  g.patterns.push(p);groups.set(m.owner,g);
 }
 if(!groups.size)throw Error('出力する働き方を1つ以上選んでください．');
 for(const g of groups.values()){if(!g.stages.length)g.stages=[{month:g.start,patternId:g.patterns[0].id}];g.stages.sort((a,b)=>a.month.localeCompare(b.month));if(g.stages[0].month>g.start)throw Error('収入開始月に使う働き方を設定してください．');const dates=new Set();for(const s of g.stages){if(dates.has(s.month))throw Error('働き方の使用開始月が重複しています：'+s.month);dates.add(s.month);}}
 return {payload:{format:'jp.finance.income.sources',version:2,sources:[...groups.values()]},preview:preview.sort((a,b)=>a.owner.localeCompare(b.owner)||a.style.localeCompare(b.style)||a.month.localeCompare(b.month)),warnings:[...new Set(warnings)]};
}
const api={suggest,convert,value};root.IncomeConvert=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

(function(root){
'use strict';
const U=root.MoneyV4||(typeof require==='function'?require('./core.js'):null);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function row(key,summary,body,classes=''){return `<details class="compact-row ${classes}" data-keep="row:${escape(key)}"><summary>${summary}</summary><div class="compact-row-body">${body}</div></details>`;}
function delta(before,after,kind='expense'){if(before==null||after==null)return '';const diff=Number(after)-Number(before);if(!Number.isFinite(diff))return '';const benefit=kind==='income'?diff:kind==='expense'?-diff:0,cl=diff===0?'delta-same':benefit>0?'delta-good':benefit<0?'delta-bad':'delta-neutral';return '<small class="plan-delta '+cl+'">前回比 '+(diff>0?'＋':diff<0?'−':'±')+new Intl.NumberFormat('ja-JP',{maximumFractionDigits:2}).format(Math.abs(diff))+'円'+(diff===0?'（変更なし）':'')+'</small>';}
U.listUI={row,delta};if(typeof module!=='undefined')module.exports=U.listUI;
})(typeof window==='undefined'?globalThis:window);

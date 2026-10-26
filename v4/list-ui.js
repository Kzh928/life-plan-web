(function(root){
'use strict';
const U=root.MoneyV4||(typeof require==='function'?require('./core.js'):null);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function row(key,summary,body,classes=''){return `<details class="compact-row ${classes}" data-keep="row:${escape(key)}"><summary>${summary}</summary><div class="compact-row-body">${body}</div></details>`;}
function delta(before,after,kind='expense'){if(before==null||after==null)return '';const diff=Math.round(Number(after))-Math.round(Number(before));if(!Number.isFinite(diff))return '';const benefit=kind==='income'?diff:kind==='expense'?-diff:0,cl=diff===0?'delta-same':benefit>0?'delta-good':benefit<0?'delta-bad':'delta-neutral';return '<small class="plan-delta '+cl+'">前回比 '+(diff>0?'＋':diff<0?'−':'±')+new Intl.NumberFormat('ja-JP',{maximumFractionDigits:0}).format(Math.abs(diff))+'円'+(diff===0?'（変更なし）':'')+'</small>';}
// Signed arithmetic comparison: actual minus planned, including expenses.
// Keep this separate from benefit-based colors for changes to future plans.
function difference(planned,actual,caption='予定との差',entered=true){const diff=Math.round(Number(actual))-Math.round(Number(planned));if(!Number.isFinite(diff))return '';const cl=!entered||diff===0?'delta-zero':diff>0?'delta-positive':'delta-negative',value=!entered?'—（未入力）':(diff>0?'＋':diff<0?'−':'±')+new Intl.NumberFormat('ja-JP',{maximumFractionDigits:0}).format(Math.abs(diff))+'円';return '<span class="actual-delta '+cl+'">'+(caption?escape(caption)+' ':'')+'<span class="delta-value">'+value+'</span></span>';}
U.listUI={row,delta,difference};if(typeof module!=='undefined')module.exports=U.listUI;
})(typeof window==='undefined'?globalThis:window);

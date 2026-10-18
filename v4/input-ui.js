(function(root){
'use strict';
const raw=v=>String(v??'').replaceAll(',','').replaceAll('円','').trim(),format=v=>{const x=raw(v);if(x==='')return '';const n=Number(x);return Number.isFinite(n)?new Intl.NumberFormat('ja-JP',{maximumFractionDigits:8}).format(n):v;},selector='input[data-money],input[data-number]';
function decorate(scope=document){for(const t of scope.querySelectorAll(selector)){t.autocomplete='off';t.spellcheck=false;t.enterKeyHint='done';if(t.matches('[data-money]')&&document.activeElement!==t)t.value=format(t.value);}}
function normalize(form){for(const t of form.querySelectorAll(selector)){const value=raw(t.value);if(value==='')continue;if(!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))throw Error('数字の入力を確認してください．');const n=Number(value),min=t.getAttribute('min'),max=t.getAttribute('max');if(min!==null&&n<Number(min)||max!==null&&n>Number(max))throw Error('入力できる数値の範囲を確認してください．');const step=t.getAttribute('step');if(step&&step!=='any'&&Math.abs((n-Number(min||0))/Number(step)-Math.round((n-Number(min||0))/Number(step)))>1e-8)throw Error('年数・年度・周期は整数で入力してください．');t.value=value;}}
let selecting=null;
function choose(t){if(!t?.matches?.(selector))return;if(t.type==='number')return;t.value=raw(t.value);try{t.select();}catch{}selecting=t;}
document.addEventListener('focusin',e=>choose(e.target));
document.addEventListener('pointerup',e=>{const t=e.target;if(t===selecting&&t.matches?.(selector)){e.preventDefault();try{t.select();}catch{}}});
document.addEventListener('blur',e=>{const t=e.target;if(t.matches?.('[data-money]'))t.value=format(t.value);if(selecting===t)selecting=null;},true);
root.MoneyInput={raw,format,decorate,normalize};if(typeof module!=='undefined')module.exports=root.MoneyInput;
})(typeof window==='undefined'?globalThis:window);

(function(root){
'use strict';
const U=root.MoneyV4||(typeof require==='function'?require('./core.js'):null);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function row(key,summary,body,classes=''){return `<details class="compact-row ${classes}" data-keep="row:${escape(key)}"><summary>${summary}</summary><div class="compact-row-body">${body}</div></details>`;}
U.listUI={row};if(typeof module!=='undefined')module.exports=U.listUI;
})(typeof window==='undefined'?globalThis:window);

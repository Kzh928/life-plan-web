/* このコードは，開いたURLのバージョン表示を現在の公開版にそろえます． */
'use strict';
const HITO_MEMO_VERSION=22;
if(typeof window!=='undefined'){try{const url=new URL(window.location.href);url.searchParams.delete('v');url.searchParams.append('v',String(HITO_MEMO_VERSION));window.history.replaceState(window.history.state,'',url.href);}catch(e){}}

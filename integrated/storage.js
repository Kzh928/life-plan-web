// v3専用の保存．元のv1/v2は読み取りのみ．保存完了は端末DBのトランザクション完了後に通知する．
(function(root){
'use strict';
const prefix='finance-v3-';
function createStore({native,driver,onState=()=>{}}){
 const cache=new Map(),dirty=new Map();let running=null,scheduled=false,lastError=null,mode='initializing';
 const original=()=>typeof native==='function'?native():native;
 const privateKey=k=>{if(!String(k).startsWith(prefix))throw Error('v3以外の保存先への書き込みは禁止されています');return String(k)};
 const emit=(phase,error=null)=>{lastError=error;onState({phase,mode,error});};
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;flush().catch(()=>{});});}
 function flush(){if(running)return running;if(!dirty.size){if(lastError)return Promise.reject(lastError);return Promise.resolve();}const batch=new Map(dirty);dirty.clear();emit('saving');running=Promise.resolve().then(()=>driver.write(batch)).then(()=>{running=null;emit('saved');return dirty.size?flush():undefined;},error=>{running=null;for(const [k,v]of batch)if(!dirty.has(k))dirty.set(k,v);emit('error',error);throw error;});return running;}
 const storage={getItem:k=>String(k).startsWith(prefix)?(cache.get(String(k))??null):original().getItem(k),setItem:(k,v)=>{k=privateKey(k);v=String(v);cache.set(k,v);dirty.set(k,v);schedule();},removeItem:k=>{k=privateKey(k);cache.delete(k);dirty.set(k,null);schedule();}};
 const ready=(async()=>{const local=new Map();try{const s=original();for(let i=0;i<s.length;i++){const k=s.key(i);if(k?.startsWith(prefix))local.set(k,s.getItem(k));}}catch{}driver=await driver();mode=driver.mode;const saved=await driver.readAll();const marker=prefix+'storage-migrated',migrate=mode==='IndexedDB'&&!saved.has(marker);if(mode!=='IndexedDB'||migrate)for(const [k,v]of local)cache.set(k,v);for(const [k,v]of saved)if(k.startsWith(prefix))cache.set(k,v);if(migrate){for(const [k,v]of local)if(!saved.has(k))dirty.set(k,v);cache.set(marker,'1');dirty.set(marker,'1');}if(dirty.size)await flush();return storage;})();
 async function verify(){await ready;const key=prefix+'check-'+Date.now()+'-'+Math.random().toString(36).slice(2),value='storage-check';storage.setItem(key,value);await flush();const persisted=await driver.readAll();if(persisted.get(key)!==value)throw Error('保存後の読み戻しを確認できませんでした');storage.removeItem(key);await flush();return mode;}
 return {storage,ready,flush,verify,status:()=>({mode,error:lastError,pending:!!running||!!dirty.size})};
}
function localDriver(native){return {mode:'localStorage',readAll:async()=>{const s=native(),m=new Map();for(let i=0;i<s.length;i++){const k=s.key(i);if(k?.startsWith(prefix))m.set(k,s.getItem(k));}return m;},write:async batch=>{const s=native(),before=new Map([...batch.keys()].map(k=>[k,s.getItem(k)]));try{for(const [k,v]of batch)v===null?s.removeItem(k):s.setItem(k,v);}catch(e){for(const [k,v]of before)try{v===null?s.removeItem(k):s.setItem(k,v)}catch{}throw e;}}};}
function databaseDriver(indexedDB){return new Promise((resolve,reject)=>{const request=indexedDB.open('finance-v3-local',1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv');};request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('古いv3のタブを閉じてから，もう一度開いてください'));request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve({mode:'IndexedDB',readAll:()=>new Promise((yes,no)=>{const map=new Map(),tx=db.transaction('kv','readonly'),r=tx.objectStore('kv').openCursor();r.onsuccess=()=>{const c=r.result;if(c){map.set(String(c.key),c.value);c.continue();}};tx.oncomplete=()=>yes(map);tx.onabort=()=>no(tx.error||Error('読み込みに失敗しました'));}),write:batch=>new Promise((yes,no)=>{const tx=db.transaction('kv','readwrite'),s=tx.objectStore('kv');for(const [k,v]of batch)v===null?s.delete(k):s.put(v,k);tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error||Error('保存に失敗しました'));})});};});}
function describe(error){if(error?.name==='QuotaExceededError')return 'このブラウザの保存容量が上限に達しています．入力内容をJSONで書き出してください．';if(error?.name==='SecurityError'||error?.name==='InvalidStateError')return 'このブラウザで端末内保存を利用できません．通常タブで開いているか確認してください．';return '保存できません：'+(error?.message||error?.name||'原因を確認できませんでした');}
const api={createStore,localDriver,databaseDriver,describe};if(typeof module!=='undefined')module.exports=api;
if(!root.document)return;
try{if(root.parent!==root&&root.parent.FinanceV3Store){root.FinanceV3Store=root.parent.FinanceV3Store;return;}}catch{}
const native=()=>root.localStorage;
root.FinanceV3Store=createStore({native,driver:async()=>{try{return await databaseDriver(root.indexedDB);}catch{return localDriver(native);}},onState:detail=>root.dispatchEvent(new CustomEvent('v3-save-state',{detail}))});
root.FinanceV3Store.describe=describe;
})(typeof window!=='undefined'?window:globalThis);

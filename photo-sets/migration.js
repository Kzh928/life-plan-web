// ## このコードは写真本体・2種類の隠しセット・設定を完全JSONとして安全に移す．
async function digestBytes(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''); }
async function exportComplete(argumentsText='') {
 const epoch=privacyEpoch, supplied=argumentsText.trim().split(/\s+/).filter(Boolean);
 for(const profile of ['primary','secondary']) if(validGate(getGate(profile)) && !(await Promise.all(supplied.map(phrase=>verifyPhrase(phrase,profile)))).some(Boolean)) throw Error('入力を確認してください．');
 if(epoch!==privacyEpoch) throw Error('もう一度お試しください．');
 $('commandStatus').textContent='写真をまとめています．この画面のままお待ちください…';
 await prefsPending;
 const snapshot={format:'photo-sets-complete',version:1,createdAt:new Date().toISOString(),sets:sets.map(s=>({...s,customOrder:(s.customOrder||[]).filter(id=>photos.some(p=>p.id===id&&p.setId===s.id))})),photos:[],preferences:{}};
 for(const key of PREF_KEYS) { const value=appStorage.getItem(key); if(value!==null) snapshot.preferences[key]=value; }
 const exportPhotos=await all('photos'); let preparedCount=0;
 for(const photo of exportPhotos) { const {blob,...fields}=photo; const bytes=await blob.arrayBuffer(); snapshot.photos.push({...fields,size:bytes.byteLength,data:await toBase64(blob),sha256:await digestBytes(bytes)}); preparedCount++; $('commandStatus').textContent=`写真をまとめています：${preparedCount} / ${exportPhotos.length}枚`; }
 if(epoch!==privacyEpoch) throw Error('もう一度お試しください．');
 showBackupSave(new File([JSON.stringify(snapshot)],`photo-sets-complete-${new Date().toISOString().slice(0,10)}.json`,{type:'application/json'}));
}
async function validateComplete(raw) {
 if(raw?.format!=='photo-sets-complete'||raw.version!==1||!Array.isArray(raw.sets)||!Array.isArray(raw.photos)||!raw.preferences||typeof raw.preferences!=='object'||Array.isArray(raw.preferences)) throw Error('形式が異なります');
 const ids=new Set(),photoIds=new Set(),prepared=[];
 const str=v=>typeof v==='string'&&v.length>0;
 for(const s of raw.sets) { if(!str(s.id)||ids.has(s.id)||!str(s.name)||!Number.isFinite(s.created)||!Number.isFinite(s.order)||(s.hidden!==undefined&&typeof s.hidden!=='boolean')||(s.secretGroup!==undefined&&!['primary','secondary'].includes(s.secretGroup))||(s.customOrder!==undefined&&(!Array.isArray(s.customOrder)||s.customOrder.some(id=>!str(id))))) throw Error('セットが不正です'); ids.add(s.id); }
 for(const [key,value] of Object.entries(raw.preferences)) if(!PREF_KEYS.includes(key)||typeof value!=='string') throw Error('設定が不正です');
 for(const key of [GATE_KEY,`${GATE_KEY}-secondary`]) if(raw.preferences[key]!==undefined&&!validGate(JSON.parse(raw.preferences[key]))) throw Error('設定が不正です');
 if(raw.preferences['photo-order']&&!['custom','newest','oldest','name'].includes(raw.preferences['photo-order'])) throw Error('表示順が不正です');
 for(const s of raw.sets) if(s.hidden&&!raw.preferences[gateStorageKey(setProfile(s))]) throw Error('合言葉設定が不足しています');
 for(const p of raw.photos) {
 if(!str(p.id)||photoIds.has(p.id)||!ids.has(p.setId)||!str(p.name)||typeof p.type!=='string'||!Number.isFinite(p.created)||!Number.isSafeInteger(p.size)||p.size<0||typeof p.data!=='string'||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(p.data)||! /^[a-f0-9]{64}$/.test(p.sha256)) throw Error('写真が不正です');
 const blob=fromBase64(p.data,p.type);if(blob.size!==p.size||await digestBytes(await blob.arrayBuffer())!==p.sha256) throw Error('写真が破損しています'); const {data,sha256,...fields}=p;prepared.push({...fields,blob});photoIds.add(p.id);
 }
 for(const s of raw.sets) if(s.customOrder&&(new Set(s.customOrder).size!==s.customOrder.length||s.customOrder.some(id=>!prepared.some(p=>p.id===id&&p.setId===s.id)))) throw Error('写真の関連が不正です');
 return {sets:raw.sets,photos:prepared,preferences:{...raw.preferences}};
}
async function importComplete(raw) {
 const valid=await validateComplete(raw);
 const existing=await all('photos'),existingSets=await all('sets');
 if(existing.length||existingSets.some(s=>s.name!=='マイ写真')) {
 if(!confirm('全データを置き換えます．現在のデータは書き出し済みですか？未保存ならキャンセルし，先にバックアップしてください．')) return;
 }
 if(!confirm(`検証済みの写真${valid.photos.length}枚・セット${valid.sets.length}件を復元しますか？`)) return;
 await prefsPending;
 const tx=db.transaction(['sets','photos','settings'],'readwrite'),done=txDone(tx);
 try {tx.objectStore('sets').clear();tx.objectStore('photos').clear();for(const s of valid.sets)tx.objectStore('sets').put(s);for(const p of valid.photos)tx.objectStore('photos').put(p);tx.objectStore('settings').put({id:'preferences',value:valid.preferences});} catch(error){tx.abort();await done.catch(()=>{});throw error;}
 await done;preferenceCache=valid.preferences;
 for(const key of PREF_KEYS)try{if(Object.hasOwn(preferenceCache,key))localStorage.setItem(key,preferenceCache[key]);else localStorage.removeItem(key);}catch{}
 photoOrder=appStorage.getItem('photo-order')||'newest';$('photoOrder').value=photoOrder;activeSetId=appStorage.getItem('active-photo-set');lockSession();await refresh();$('settingsDialog').close();toast('全データを復元しました');
}

// 保存先は端末だけが把握するため，保存する操作と確認手順を残す．
function showBackupSave(file) {
 // iPhoneで複数のモーダルを重ねない．合言葉・設定画面を閉じてから保存画面を開く．
 for(const opened of document.querySelectorAll('dialog[open]')) opened.close();
 const dialog=document.createElement('dialog');dialog.id='backupSaveDialog';dialog.className='sheet command-sheet';dialog.setAttribute('aria-labelledby','backupSaveTitle');
 const title=document.createElement('h2');title.id='backupSaveTitle';title.textContent='バックアップの準備ができました';
 const filename=document.createElement('p');filename.textContent=file.name;filename.style.cssText='overflow-wrap:anywhere;font-weight:700';
 const help=document.createElement('p');help.className='setting-explain';help.textContent='このJSONには写真と設定が含まれ，暗号化されません．まだ端末への保存は完了していません．下のボタンを押し，共有画面の「ファイルに保存」を選んでください．保存先は「このiPhone内」→「ダウンロード」など，自分で選べます．';
 const save=document.createElement('button');save.type='button';save.className='primary-button';save.textContent='保存先を選ぶ（ファイルに保存）';
 const fallback=document.createElement('a');fallback.className='secondary-button wide';fallback.textContent='JSONをダウンロード';fallback.style.cssText='display:flex;align-items:center;justify-content:center;text-decoration:none';fallback.download=file.name;
 const url=URL.createObjectURL(file);fallback.href=url;
 const tips=document.createElement('p');tips.className='setting-explain';tips.style.marginTop='16px';tips.textContent='ダウンロードした場合：「ファイル」アプリ→「ブラウズ」→「iCloud Drive」または「このiPhone内」→「ダウンロード」で，上のファイル名を探してください．設定によって保存先は異なります．';
 const status=document.createElement('p');status.className='setting-explain';status.setAttribute('role','status');
 const close=document.createElement('button');close.type='button';close.className='secondary-button wide';close.textContent='閉じる';close.onclick=()=>dialog.close();
 save.onclick=async()=>{
   if(!navigator.canShare?.({files:[file]})) {status.textContent='このブラウザでは保存先の選択に対応していません．「JSONをダウンロード」を押し，上の手順で探してください．';return;}
   save.disabled=true;
   try{await navigator.share({files:[file],title:'写真セットのバックアップ'});status.textContent='共有画面を閉じました．「ファイル」アプリで，選んだ保存先にファイルがあることを確認してください．';}
   catch(error){status.textContent=error.name==='AbortError'?'保存をキャンセルしました．もう一度保存先を選べます．':'保存画面を開けませんでした．「JSONをダウンロード」をお試しください．';}
   finally{save.disabled=false;}
 };
 fallback.onclick=()=>{status.textContent='ダウンロードを開始しました．「ファイル」アプリの「ダウンロード」を確認してください．';};
 dialog.append(title,filename,help,save,fallback,tips,status,close);document.body.append(dialog);dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);dialog.remove();},{once:true});dialog.showModal();
}

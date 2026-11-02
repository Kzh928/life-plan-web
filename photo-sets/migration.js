// ## このコードは写真本体・2種類の隠しセット・設定を完全JSONとして安全に移す．
async function digestBytes(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''); }
let multipartCleanup = null;
async function exportComplete(argumentsText='') {
 const epoch=privacyEpoch, supplied=argumentsText.trim().split(/\s+/).filter(Boolean);
 for(const profile of ['primary','secondary']) if(validGate(getGate(profile)) && !(await Promise.all(supplied.map(phrase=>verifyPhrase(phrase,profile)))).some(Boolean)) throw Error('入力を確認してください．');
 if(epoch!==privacyEpoch) throw Error('もう一度お試しください．');
 await prefsPending;
 const exportPhotos=await all('photos'), byId=new Map(exportPhotos.map(p=>[p.id,p]));
 const metadata={sets:sets.map(s=>({...s,customOrder:(s.customOrder||[]).filter(id=>byId.get(id)?.setId===s.id)})),preferences:{}};
 for(const key of PREF_KEYS) {const value=appStorage.getItem(key);if(value!==null)metadata.preferences[key]=value;}
 const batches=[];let batch=[],bytes=0;
 for(const p of exportPhotos){const size=p.blob.size;if(batch.length&&(batch.length>=20||bytes+size>16*1024*1024)){batches.push(batch);batch=[];bytes=0;}batch.push(p);bytes+=size;}
 if(batch.length||!batches.length)batches.push(batch);
 const manifest=exportPhotos.map(p=>({id:p.id,setId:p.setId,size:p.blob.size}));
 const signature=await digestBytes(new TextEncoder().encode(JSON.stringify({metadata,manifest})));
 let saved=null;try{saved=JSON.parse(localStorage.getItem('photo-export-checkpoint')||'null')}catch{}
 let id=saved?.signature===signature?saved.id:uid();let index=saved?.signature===signature?Math.min(saved.done||0,batches.length-1):0;
 async function prepare(){
  if(epoch!==privacyEpoch)throw Error('もう一度合言葉を入力して，続きから書き出してください．');
  multipartCleanup?.();multipartCleanup=null;
  const host=$('commandDialog');$('commandTitle').hidden=false;$('commandTitle').textContent='分割バックアップ';$('commandForm').hidden=true;$('commandTools').hidden=true;
  $('commandStatus').textContent=`ファイル ${index+1} / ${batches.length} を準備しています…`;if(!host.open)host.showModal();
  const raw={format:'photo-sets-complete',version:1,...metadata,transfer:{id,part:index,parts:batches.length,manifest},photos:[]};let done=0;
  for(const photo of batches[index]){const {blob,...fields}=photo;const data=await toBase64(blob);raw.photos.push({...fields,size:blob.size,data,sha256:await digestBytes(await blob.arrayBuffer())});done++;$('commandStatus').textContent=`ファイル ${index+1} / ${batches.length}：${done} / ${batches[index].length}枚`;await new Promise(r=>setTimeout(r,0));}
  if(epoch!==privacyEpoch)throw Error('もう一度合言葉を入力して，続きから書き出してください．');
  const file=new File([JSON.stringify(raw)],`photo-sets-${id.slice(0,8)}-part-${String(index+1).padStart(3,'0')}-of-${String(batches.length).padStart(3,'0')}.json`,{type:'application/json'});
  showBackupSave(file);const panel=$('backupSavePanel');
  const progress=document.createElement('p');progress.textContent=`全${exportPhotos.length}枚を${batches.length}ファイルに分けます．今は ${index+1} / ${batches.length} です．`;panel.prepend(progress);
  const next=document.createElement('button');next.className='primary-button';next.style.marginTop='16px';next.textContent=index+1<batches.length?'このファイルを保存できた → 次へ':'最後のファイルも保存できた';
  next.onclick=async()=>{if(next.disabled)return;next.disabled=true;try{localStorage.setItem('photo-export-checkpoint',JSON.stringify({id,signature,done:index+1}));if(index+1===batches.length){localStorage.removeItem('photo-export-checkpoint');next.textContent='全ファイルの書き出しを確認しました';return;}index++;await prepare();}catch(error){$('commandStatus').textContent=error.message;next.disabled=false;}};
  panel.append(next);
  const restart=document.createElement('button');restart.className='secondary-button wide';restart.textContent='1番目からやり直す';restart.onclick=async()=>{restart.disabled=true;index=0;localStorage.removeItem('photo-export-checkpoint');try{await prepare()}catch(error){$('commandStatus').textContent=error.message;}};panel.append(restart);
 }
 await prepare();
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
 if(!str(p.id)||photoIds.has(p.id)||!ids.has(p.setId)||!str(p.name)||typeof p.type!=='string'||!Number.isFinite(p.created)||!Number.isSafeInteger(p.size)||p.size<0||typeof p.data!=='string'||(p.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(p.data))||! /^[a-f0-9]{64}$/.test(p.sha256)) throw Error('写真が不正です');
 const blob=fromBase64(p.data,p.type);if(blob.size!==p.size||await digestBytes(await blob.arrayBuffer())!==p.sha256) throw Error('写真が破損しています'); const {data,sha256,...fields}=p;prepared.push({...fields,blob});photoIds.add(p.id);
 }
 for(const s of raw.sets) if(s.customOrder&&(new Set(s.customOrder).size!==s.customOrder.length||s.customOrder.some(id=> raw.transfer ? !raw.transfer.manifest?.some(p=>p.id===id&&p.setId===s.id) : !prepared.some(p=>p.id===id&&p.setId===s.id)))) throw Error('写真の関連が不正です');
 return {sets:raw.sets,photos:prepared,preferences:{...raw.preferences}};
}
async function importComplete(raw) {
 if(raw.transfer)return importPart(raw);
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
 // 同じ画面の中身だけを保存操作へ切り替え，iPhoneのモーダル切替を避ける．
 const host=$('commandDialog');
 for(const opened of document.querySelectorAll('dialog[open]')) if(opened!==host) opened.close();
 multipartCleanup?.();multipartCleanup=null;
 const dialog=document.createElement('section');dialog.id='backupSavePanel';
 $('commandForm').hidden=true; $('commandTools').hidden=true; $('commandTitle').hidden=true; $('commandStatus').textContent='';
 const title=document.createElement('h2');title.id='backupSaveTitle';title.textContent='ダウンロードを開始しました';
 const filename=document.createElement('p');filename.textContent=file.name;filename.style.cssText='overflow-wrap:anywhere;font-weight:700';
 const help=document.createElement('p');help.className='setting-explain';help.textContent='保存先を選ぶ操作は不要です．ブラウザのダウンロード先に保存します．確認画面が出た場合は「ダウンロード」を押してください．';
 const fallback=document.createElement('a');fallback.className='primary-button';fallback.textContent='もう一度ダウンロードする';fallback.style.cssText='display:flex;align-items:center;justify-content:center;text-decoration:none';fallback.download=file.name;
 const url=URL.createObjectURL(file);fallback.href=url;
 const tips=document.createElement('p');tips.className='setting-explain';tips.style.marginTop='16px';tips.textContent='探し方：「ファイル」アプリ→「ブラウズ」→「iCloud Drive」または「このiPhone内」→「ダウンロード」．見つからなければ「photo-sets」で検索してください．ブラウザの設定によって保存先は異なります．';
 const status=document.createElement('p');status.className='setting-explain';status.setAttribute('role','status');status.textContent='ファイルがあることを確認するまで，この画面を残してください．見つからなければ上のボタンで再度ダウンロードできます．このJSONは暗号化されず写真を含むため，安全に保管してください．';
 const close=document.createElement('button');close.type='button';close.className='secondary-button wide';close.textContent='確認できたので閉じる';close.onclick=()=>host.close();
 fallback.onclick=()=>{title.textContent='ダウンロードを開始しました';};
 dialog.append(title,filename,help,fallback,tips,status,close);host.append(dialog);const cleanup=()=>{URL.revokeObjectURL(url);dialog.remove();host.removeEventListener('close',cleanup);$('commandTitle').hidden=false;$('commandTitle').textContent='操作';};multipartCleanup=cleanup;host.addEventListener('close',cleanup,{once:true});if(!host.open)host.showModal();
 try { fallback.click(); } catch { title.textContent='準備できました．下のボタンで保存してください'; }
}
// 各分割ファイルは検証後に一時保管する．全て揃うまで現在の写真を変更しない．
async function importPart(raw){
 const t=raw.transfer;
 if(!t||typeof t.id!=='string'||! /^[a-zA-Z0-9-]{8,80}$/.test(t.id)||!Number.isSafeInteger(t.parts)||t.parts<1||t.parts>100000||!Number.isSafeInteger(t.part)||t.part<0||t.part>=t.parts||!Array.isArray(t.manifest))throw Error('分割情報が不正です');
 const ids=new Set(),setIds=new Set((raw.sets||[]).map(s=>s.id));const expected=[];let batch=[],bytes=0;
 for(const p of t.manifest){if(typeof p.id!=='string'||ids.has(p.id)||!setIds.has(p.setId)||!Number.isSafeInteger(p.size)||p.size<0)throw Error('写真一覧が不正です');ids.add(p.id);if(batch.length&&(batch.length>=20||bytes+p.size>16*1024*1024)){expected.push(batch);batch=[];bytes=0;}batch.push(p);bytes+=p.size;}
 if(batch.length||!expected.length)expected.push(batch);
 if(expected.length!==t.parts||!Array.isArray(raw.photos)||expected[t.part].length!==raw.photos.length||raw.photos.some((p,i)=>p.id!==expected[t.part][i].id||p.setId!==expected[t.part][i].setId||p.size!==expected[t.part][i].size))throw Error('分割の内容が一致しません');
 const valid=await validateComplete(raw);
 const signature=await digestBytes(new TextEncoder().encode(JSON.stringify({sets:valid.sets,preferences:valid.preferences,manifest:t.manifest,parts:t.parts})));
 const metaKey=t.id+'-meta',prefix=t.id+'-photo-';
 const previous=await request(db.transaction('transfer').objectStore('transfer').get(metaKey));
 if(previous&&previous.signature!==signature)throw Error('別のバックアップが混ざっています');
 const received=[...new Set([...(previous?.received||[]),t.part])].sort((a,b)=>a-b);
 const stage=db.transaction('transfer','readwrite'),staged=txDone(stage);
 try{for(const photo of valid.photos)stage.objectStore('transfer').put({id:prefix+photo.id,photo});stage.objectStore('transfer').put({id:metaKey,signature,received});}catch(error){stage.abort();await staged.catch(()=>{});throw error;}await staged;
 const message=`分割ファイル ${received.length} / ${t.parts} を読み込みました．`;
 $('usageText').textContent=message+' 残りのJSONも「バックアップから復元」で選んでください．全て揃うまで今のデータは変更しません．';if(!$('settingsDialog').open)$('settingsDialog').showModal();
 if(received.length<t.parts){toast(message);return;}
 // 反映前に，保管済み全画像の存在と関連を再点検する．
 const verify=db.transaction('transfer'),store=verify.objectStore('transfer');let checked=0;
 await new Promise((resolve,reject)=>{const req=store.openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));req.onerror=()=>reject(req.error);req.onsuccess=()=>{const c=req.result;if(!c){resolve();return;}const p=c.value.photo;if(!p||!ids.has(p.id)||!t.manifest.some(m=>m.id===p.id&&m.setId===p.setId&&m.size===p.blob.size)){reject(Error('保管中の写真が不正です'));return;}checked++;c.continue();};});
 if(checked!==t.manifest.length)throw Error('保管中の写真が不足しています');
 if(!confirm(`全${t.parts}ファイル・写真${checked}枚が揃いました．現在のデータをバックアップ済みであることを確認して，置き換えて復元しますか？`))return;
 await prefsPending;
 const tx=db.transaction(['sets','photos','settings','transfer'],'readwrite'),done=txDone(tx);
 try{
 tx.objectStore('sets').clear();tx.objectStore('photos').clear();for(const set of valid.sets)tx.objectStore('sets').put(set);tx.objectStore('settings').put({id:'preferences',value:valid.preferences});
 const req=tx.objectStore('transfer').openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));req.onerror=()=>tx.abort();req.onsuccess=()=>{const c=req.result;if(!c)return;tx.objectStore('photos').put(c.value.photo);c.delete();c.continue();};tx.objectStore('transfer').delete(metaKey);
 }catch(error){tx.abort();await done.catch(()=>{});throw error;}await done;
 preferenceCache=valid.preferences;for(const key of PREF_KEYS)try{if(Object.hasOwn(preferenceCache,key))localStorage.setItem(key,preferenceCache[key]);else localStorage.removeItem(key);}catch{}
 photoOrder=appStorage.getItem('photo-order')||'newest';$('photoOrder').value=photoOrder;activeSetId=appStorage.getItem('active-photo-set');lockSession();await refresh();toast(`写真${checked}枚と全セット・設定を復元しました`);
}

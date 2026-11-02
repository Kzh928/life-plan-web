/* このコードは，パスワードなしの端末内保存と，旧暗号化データからの移行を扱います． */
'use strict';
let localError='';
function validateLocalData(data){if(!data||!Array.isArray(data.people)||!Array.isArray(data.facts)||!Array.isArray(data.relations))throw Error('データ形式を確認してください');return ensureCommunities(data);}
function localEnvelope(data){return {format:'hito-memo-local-v1',notebookId:typeof activeNotebook==='undefined'?'personal':activeNotebook,state:validateLocalData(data)};}
function writeLocalData(data){localStorage.setItem(STORE,JSON.stringify(localEnvelope(data)));}
function initializeLocal(){
  localError='';
  try{const raw=localStorage.getItem(STORE);if(!raw){state={people:[],facts:[],relations:[]};key=true;}
    else{const blob=JSON.parse(raw);if(blob.format==='hito-memo-local-v1'){state=validateLocalData(blob.state);key=true;vault=null;}else if(blob.format==='hito-memo-v1'){key=null;}else throw Error('保存データの形式を確認してください');}
  }catch(e){key=null;localError='保存データを開けませんでした．データは削除していません．バックアップからの復元をお試しください．';}
  render();
}
function migrationScreen(){return `<div class="setup"><div class="brand"><span class="brandmark">人</span>ひとメモ</div><div class="panel"><h1>最初の一度だけ解除</h1><p>旧データを引き継ぐため，今までのパスワードを入力してください．移行後はパスワードなしで開きます．</p><form id="auth-form"><label class="field"><span>今までのパスワード</span><input name="password" type="password" autocomplete="current-password" required></label><button class="btn" type="submit">データを引き継いで開く</button><p id="auth-error" class="error" role="alert">${escapeHtml(localError)}</p></form><button class="iconbtn" data-action="import-locked">バックアップから復元</button><input type="file" id="import-file" accept=".json,application/json" hidden></div><p class="footnote">移行後の人物データとバックアップは暗号化しません．このブラウザを開ける人がメモを見られます．公開URLだけで，別の端末の保存データが共有されることはありません．</p></div>`;}
async function migratePassword(pass){
  const oldState=state,targetStore=STORE;
  try{const blob=JSON.parse(localStorage.getItem(STORE));if(blob.format!=='hito-memo-v1')throw Error('旧データではありません');
    const candidate=await derive(pass,from64(blob.salt)),data=await decrypt(blob,candidate);if(STORE!==targetStore)return;writeLocalData(data);state=data;key=true;vault=null;render();toast('移行しました．次回からパスワードなしで開けます');
  }catch(e){state=oldState;key=null;$('#auth-error').textContent='パスワード，データ，または空き容量を確認してください．旧データは変更していません．';}
}
function prepareLocalRestore(blob){
  validateLocalData(blob.state);if(blob.notebookId&&blob.notebookId!==(typeof activeNotebook==='undefined'?'personal':activeNotebook)){toast('別のノートのバックアップです．対応するノートに切り替えてください');return;}if(!blob.notebookId&&typeof activeNotebook!=='undefined'&&activeNotebook==='oshi'){toast('旧バックアップは個人用のひとメモで復元してください');return;}pending={blob};
  setModal(`<h2 id="modal-title">バックアップを復元</h2><p>「${typeof notebookTitle==='function'?notebookTitle():'ひとメモ'}」のデータだけを選んだバックアップで置き換えます．このバックアップはパスワードなしです．</p><p id="local-restore-error" class="error" role="alert"></p><div class="actions"><button class="btn subtle" data-action="close-modal">戻る</button><button class="btn" data-action="restore-local">復元する</button></div>`);
}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-action]')?.dataset.action!=='restore-local'||!pending?.blob||working)return;
  try{const data=validateLocalData(pending.blob.state);writeLocalData(data);resetPersonDrafts();state=data;key=true;vault=null;pending=null;modal=null;selected=null;page='list';quickDraft='';render();toast('復元しました');}
  catch(e){$('#local-restore-error').textContent='復元できませんでした．ファイルと空き容量を確認してください．';}
});

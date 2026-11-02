/* 全ノートを写真本体ごと移す．通信・アカウント認証は使用しない． */
'use strict';
let portablePending=null,portableBackedUp=false;
function validatePortableState(data){
  validateLocalData(data);
  const ids=(rows)=>{const seen=new Set();for(const r of rows){if(!r||typeof r.id!=='string'||!r.id||seen.has(r.id))throw Error('IDが不正・重複しています');seen.add(r.id);}return seen;};
  const people=ids(data.people),groups=ids(data.communities);ids(data.facts);ids(data.relations);
  for(const p of data.people){if(typeof p.name!=='string'||!p.name.trim()||!Array.isArray(p.aliases)||p.aliases.some(a=>typeof a!=='string'))throw Error('人物の形式が不正です');if(p.photo&&!safePersonPhoto(p))throw Error('写真本体がないか，対応しない写真です');if(p.communityIds&&(!Array.isArray(p.communityIds)||p.communityIds.some(g=>!groups.has(g))))throw Error('所属先が見つかりません');}
  for(const f of data.facts)if(!people.has(f.personId)||typeof f.text!=='string'||typeof f.category!=='string')throw Error('情報の関連付けが不正です');
  for(const r of data.relations)if(!people.has(r.a)||!people.has(r.b)||r.a===r.b||!labels[r.type])throw Error('人間関係の形式が不正です');
  for(const g of data.communities){if(typeof g.name!=='string'||g.parentId&&!groups.has(g.parentId))throw Error('コミュニティが不正です');const seen=new Set([g.id]);let parent=g.parentId;while(parent){if(seen.has(parent))throw Error('コミュニティが循環しています');seen.add(parent);parent=data.communities.find(x=>x.id===parent)?.parentId;}}
  return data;
}
function portableSnapshot(){
  const notebooks={};for(const [nid,n] of Object.entries(NOTEBOOKS)){const raw=localStorage.getItem(n.store);notebooks[nid]=nid===activeNotebook&&key===true?{format:'hito-memo-local-v1',notebookId:nid,state:structuredClone(state)}:raw?JSON.parse(raw):null;}
  return validatePortableBundle({format:'hito-memo-all-v1',version:HITO_MEMO_VERSION,createdAt:new Date().toISOString(),activeNotebook,notebooks});
}
function validatePortableBundle(input){
  const b=JSON.parse(JSON.stringify(input));if(b.format!=='hito-memo-all-v1'||!b.notebooks||Object.keys(b.notebooks).length!==2||!Object.hasOwn(b.notebooks,'personal')||!Object.hasOwn(b.notebooks,'oshi')||!NOTEBOOKS[b.activeNotebook])throw Error('全ノートのバックアップではありません');
  for(const [nid,v] of Object.entries(b.notebooks)){if(v===null)continue;if(v.format==='hito-memo-v1'&&nid==='personal'){if(![v.salt,v.iv,v.data].every(s=>typeof s==='string'&&/^[A-Za-z0-9+/=]+$/.test(s)))throw Error('暗号化データが不正です');continue;}if(v.format!=='hito-memo-local-v1'||v.notebookId!==nid)throw Error('ノートの形式が不正です');validatePortableState(v.state);}
  return b;
}
function downloadPortable(){const b=portableSnapshot(),url=URL.createObjectURL(new Blob([JSON.stringify(b)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='hito-memo-all-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);portableBackedUp=true;toast('全ノートを書き出しました．ファイルの保存完了を確認してください');}
function restorePortable(input){
  const b=validatePortableBundle(input),previous=new Map(Object.values(NOTEBOOKS).map(n=>[n.store,localStorage.getItem(n.store)])),written=[];
  try{for(const [nid,n] of Object.entries(NOTEBOOKS)){const v=b.notebooks[nid];if(v===null)localStorage.removeItem(n.store);else localStorage.setItem(n.store,JSON.stringify(v));written.push(n.store);}}
  catch(error){for(const k of written.slice().reverse()){const v=previous.get(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}throw error;}
  activeNotebook=b.activeNotebook;STORE=NOTEBOOKS[activeNotebook].store;resetPersonDrafts();quickDraft='';organizerPlan=null;organizerResult=null;organizerUndo=null;graphUndo=null;pending=null;selected=null;page='list';modal=null;portablePending=null;initializeLocal();
}
function portableSettings(){return `<section class="panel section"><h2>全ノートの引っ越し</h2><p>個人用・推し用の全記録，写真本体，コミュニティ，表示順，相関図の配置を一つのJSONで保存します．未整理の入力は先に整理してください．ファイルは暗号化しません．</p><div class="actions"><button class="btn" data-action="portable-export">全ノートを書き出す</button><label class="btn subtle">全ノートを読み込む<input id="portable-file" type="file" accept=".json,application/json" hidden></label></div><p class="footnote">元サイトと移行先の保存場所は別です．元サイトで書き出し，移行先で読み込んでください．外部サイトへのリンクはリンク先の継続に依存します．PDF添付機能はありません．</p></section>`;}
document.addEventListener('change',async e=>{if(e.target.id!=='portable-file'||working)return;const file=e.target.files?.[0],targetStore=STORE;e.target.value='';try{if(!file||file.size>32000000)throw Error('32 MB以下のJSONを選んでください');const b=validatePortableBundle(JSON.parse(await file.text()));if(STORE!==targetStore)return;portablePending=b;portableBackedUp=false;const counts=Object.entries(b.notebooks).map(([nid,v])=>NOTEBOOKS[nid].name+'：'+(v?.state?`${v.state.people.length}人・情報${v.state.facts.length}件・関係${v.state.relations.length}件・写真${v.state.people.filter(p=>p.photo).length}枚`:v?'旧暗号化データ（復元後に解除）':'未作成')).join('／');setModal(`<h2 id="modal-title">全ノートを復元</h2><p>${escapeHtml(counts)}</p><p>現在の両方のノートを置き換えます．先に現在の全ノートを書き出して，保存完了を確認してください．</p><div class="actions"><button class="btn subtle" data-action="portable-export">現在の全ノートを書き出す</button><button class="btn" data-action="portable-restore">保存を確認して復元</button><button class="btn subtle" data-action="close-modal">戻る</button></div>`);}catch(error){toast(error.message||'読み込めませんでした');}});
document.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(working)return;try{if(action==='portable-export')downloadPortable();if(action==='portable-restore'&&portablePending){if(!portableBackedUp){toast('先に現在の全ノートを書き出してください');return;}restorePortable(portablePending);toast('全ノートを復元しました');}}catch(error){toast('処理できませんでした．元データを保持しています．'+error.message);}});

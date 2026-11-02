/* 個人用と推し用は別の保存キー．共有は推し用の現在のデータだけを対象にする． */
'use strict';
let activeNotebook='personal';
const NOTEBOOKS={personal:{name:'ひとメモ',store:'hito-memo.v1'},oshi:{name:'推しメモ',store:'hito-memo.oshi.v1'}};
function notebookTitle(){return NOTEBOOKS[activeNotebook].name;}
function kuzuhaSeed(){
  const date='2026-10-07T00:00:00.000Z',unitSource='https://www.anycolor.co.jp/news/qwex7qjayhj?nextInternalLocale=en',chronoSource='https://chronoir-official.com/profile/';
  const rows=[
    ['kuzuha','葛葉',['くずは','Kuzuha'],['chrono','dokuzu'],'kuzuha','UCSFCh5NL4qXrAy9u-u2lX3g'],
    ['kanae','叶',['かなえ','Kanae'],['chrono'],'kanae','UCspv01oxUFf_MTSipURRhkA'],
    ['dola','ドーラ',[],['dokuzu'],'dola','UC53UDnhAAYwvNO7j_2Ju1cQ'],
    ['himawari','本間ひまわり',['ひまわり'],['dokuzu'],'himawari-honma','UC0g1AE0DOjBYnLhkgoRWN1w'],
    ['yashiro','社築',['やしろきずく'],['dokuzu'],'kizuku-yashiro','UCKMYISTJAQ8xTplUPHiABlA']
  ];
  const people=rows.map(([id,name,aliases,communityIds])=>({id:'oshi-'+id,name,aliases,communityIds,createdAt:date}));
  const facts=rows.flatMap(([pid,name,aliases,groups,slug,channel])=>[
    {id:pid+'-profile',personId:'oshi-'+pid,category:'公式プロフィール',text:'https://www.nijisanji.jp/talents/l/'+slug,source:'にじさんじ公式プロフィールを確認（2026年10月7日）',createdAt:date,archived:false},
    {id:pid+'-youtube',personId:'oshi-'+pid,category:'YouTube',text:'https://www.youtube.com/channel/'+channel,source:'にじさんじ公式プロフィールのYouTubeリンクを確認（2026年10月7日）',createdAt:date,archived:false}
  ]);
  facts.push({id:'kuzuha-intro',personId:'oshi-kuzuha',category:'紹介',text:'にじさんじ所属．叶とChroNoiRを結成．ド葛本社でもユニット活動の公式発表あり．',source:chronoSource+'\n'+unitSource,createdAt:date,archived:false},
    {id:'kuzuha-chrono-channel',personId:'oshi-kuzuha',category:'ユニットのYouTube',text:'https://www.youtube.com/channel/UCz6vnIbgiqFT9xUcD6Bp65Q',source:unitSource,createdAt:date,archived:false});
  const relations=[['kanae','ChroNoiR',chronoSource],['dola','ド葛本社',unitSource],['himawari','ド葛本社',unitSource],['yashiro','ド葛本社',unitSource]].map(([pid,unitName,source])=>({id:'kuzuha-'+pid,a:'oshi-kuzuha',b:'oshi-'+pid,type:'unitmate',unitName,source,createdAt:date}));
  const graphPositions={};for(const [groupId,pid,x,y] of [['chrono','kuzuha',0,0],['chrono','kanae',0,-132],['dokuzu','kuzuha',0,0],['dokuzu','dola',0,-132],['dokuzu','himawari',114,66],['dokuzu','yashiro',-114,66]])graphPositions[JSON.stringify([groupId,'oshi-'+pid])]={x,y};
  return {people,facts,relations,graphPositions,communities:[{id:'nijisanji',name:'にじさんじ',parentId:null},{id:'chrono',name:'ChroNoiR',parentId:'nijisanji'},{id:'dokuzu',name:'ド葛本社',parentId:'nijisanji'}],personOrder:people.map(p=>p.id)};
}
function openNotebookMenu(){
  if(working||modal){toast('今の編集を保存するか閉じてから切り替えてください');return;}
  setModal(`<h2 id="modal-title">ノートを切り替え</h2><p>人物・検索・相関図・バックアップは別々です．隠し操作はロックではありません．</p>${Object.entries(NOTEBOOKS).map(([nid,n])=>`<button class="choice" data-action="notebook-switch" data-id="${nid}" ${nid===activeNotebook?'disabled':''}>${n.name}${nid===activeNotebook?'（いま開いています）':''}</button>`).join('')}${quickDraft.trim()?'<p class="warning">切り替えると未整理の入力は消えます．残す場合は戻って整理してください．</p>':''}<div class="actions"><button class="btn subtle" data-action="close-modal">戻る</button></div>`);
}
function switchNotebook(nid){
  if(working||!NOTEBOOKS[nid]||nid===activeNotebook)return false;
  let next,nextKey=true;
  try{
    const raw=localStorage.getItem(NOTEBOOKS[nid].store);
    if(raw){const blob=JSON.parse(raw);if(blob.format==='hito-memo-local-v1')next=validateLocalData(blob.state);else if(blob.format==='hito-memo-v1'&&nid==='personal'){next={people:[],facts:[],relations:[]};nextKey=null;}else throw Error('形式が不正');}
    else{next=nid==='oshi'?kuzuhaSeed():{people:[],facts:[],relations:[]};ensureCommunities(next);if(nid==='oshi')localStorage.setItem(NOTEBOOKS[nid].store,JSON.stringify({format:'hito-memo-local-v1',notebookId:nid,state:next}));}
  }catch(e){toast('ノートを開けませんでした．元のデータは変更していません');return false;}
  resetPersonDrafts();activeNotebook=nid;STORE=NOTEBOOKS[nid].store;state=next;key=nextKey;vault=null;page=nid==='oshi'?'graph':'list';selected=null;modal=null;pending=null;filter='';communityFilter='all';quickDraft='';batchDraft=null;organizerPlan=null;organizerUndo=null;organizerResult=null;localError='';lastHidden=null;
  graphFilter='all';graphZoom=1;graphSelectedGroup='';graphDrag=null;graphIgnoreClickUntil=0;
  render();scrollTo(0,0);toast(notebookTitle()+'に切り替えました');return true;
}
function notebookSettings(){return `<p class="footnote">対象：${notebookTitle()}だけ．もう一方のノートは変更しません．</p>${activeNotebook==='oshi'?'<div class="panel section"><div class="settings-row"><div><b>推しメモを布教用に書き出す</b><small>このノートの人物・情報・相関図だけを，閲覧用HTMLにします．元の入力文・過去の情報・個人用ノートは含めません．</small></div><button class="btn small" data-action="oshi-share">書き出す</button></div></div>':''}`;}
function memoTextHtml(text){
  return String(text??'').split(/(https?:\/\/[^\s<>"']+)/g).map(part=>{
    if(!/^https?:\/\//.test(part))return escapeHtml(part);
    try{const u=new URL(part);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return escapeHtml(part);return `<a class="memo-link" href="${escapeHtml(u.href)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${escapeHtml(part)}</a>`;}catch(e){return escapeHtml(part);}
  }).join('');
}
function buildOshiShare(){
  if(activeNotebook!=='oshi'||!key)throw Error('推しメモを開いてください');
  const model=typeof overlapGraphModel==='function'?overlapGraphModel(state,'all'):graphModel(state,'all'),b=graphBounds(model);
  // Generated from the active state, never from storage enumeration or the other notebook.
  const cards=orderedPeople(state).map(p=>`<section><h2>${escapeHtml(p.name)}</h2><p>${escapeHtml(communityMembershipLabels(p).join('・'))}</p>${state.facts.filter(f=>f.personId===p.id&&!f.archived).map(f=>`<p><small>${escapeHtml(f.category)}</small><br>${memoTextHtml(f.text)}</p>`).join('')}</section>`).join('');
  const svg=graphSvg(model,1).replace(/viewBox="[^"]*"/,`viewBox="${b.x} ${b.y} ${b.width} ${b.height}"`).replace(/width="[^"]*" height="[^"]*"/,'width="100%" height="600"');
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>推しメモ 相関図</title><style>body{font:16px/1.7 system-ui,sans-serif;margin:0;color:#12213e;background:#eef3fa}main{max-width:1100px;margin:auto;padding:20px}h1{font-size:24px}section{background:white;border-radius:16px;padding:18px;margin:16px 0}p,a{overflow-wrap:anywhere}small{color:#53617a}.graph-person text{font-size:16px;font-weight:700}.graph-edge-label,.graph-community{font-size:14px}svg{max-width:100%;background:white;border-radius:16px;touch-action:pan-x pan-y}svg text{font-family:system-ui,sans-serif}</style><main><h1>推しメモ 相関図</h1><p>個人が作成した紹介メモです．公式の相関図ではありません．</p>${svg}${cards}</main></html>`;
}
function downloadOshiShare(){
  const html=buildOshiShare(),url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='oshi-memo-share.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);closeModal();toast('推しメモだけを書き出しました');
}
let notebookPress=null;
function cancelNotebookPress(){if(notebookPress)clearTimeout(notebookPress.timer);notebookPress=null;}
document.addEventListener('pointerdown',e=>{
  if(!e.target.closest('[data-action="notebook-menu"]')||e.button>0)return;
  cancelNotebookPress();const press={x:e.clientX,y:e.clientY};press.timer=setTimeout(()=>{if(notebookPress!==press)return;cancelNotebookPress();openNotebookMenu();},650);notebookPress=press;
});
document.addEventListener('pointermove',e=>{if(notebookPress&&Math.hypot(e.clientX-notebookPress.x,e.clientY-notebookPress.y)>12)cancelNotebookPress();});
for(const event of ['pointerup','pointercancel'])document.addEventListener(event,cancelNotebookPress);
document.addEventListener('contextmenu',e=>{if(e.target.closest('[data-action="notebook-menu"]'))e.preventDefault();});
document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.closest('[data-action="notebook-menu"]')){e.preventDefault();openNotebookMenu();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='notebook-switch')switchNotebook(b.dataset.id);if(b.dataset.action==='oshi-share')setModal('<h2 id="modal-title">推しメモを共有用に書き出す？</h2><p>推しメモ内の現在の人物・情報・相関図が含まれます．公開してよい内容か確認してください．個人用のひとメモは含めません．書き出したファイルは暗号化しません．</p><div class="actions"><button class="btn subtle" data-action="close-modal">戻る</button><button class="btn" data-action="oshi-share-confirm">書き出す</button></div>');if(b.dataset.action==='oshi-share-confirm'&&activeNotebook==='oshi')downloadOshiShare();});

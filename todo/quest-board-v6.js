
'use strict';
const $=id=>document.getElementById(id),KEY='quest-log-v1';let state={version:1,tasks:[],settings:{effects:true,sound:false}},filter='open',editing=null,selected=null,missingMode=false,fxTimer,noticeTimer;
try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(valid(parsed))state=parsed;else throw Error('invalid')}}catch(e){setTimeout(()=>toast('保存データを読み込めません。元のデータは上書きせず、再読み込みをお試しください。'),100);state.readError=true}
function valid(s){return s&&s.version===1&&Array.isArray(s.tasks)&&s.tasks.length<=10000&&s.tasks.every(t=>t&&typeof t.id==='string'&&typeof t.title==='string'&&t.title.trim()&&typeof t.detail==='string'&&typeof t.comment==='string'&&typeof t.due==='string'&&(!t.due||/^\d{4}-\d{2}-\d{2}$/.test(t.due))&&['importance','urgency'].every(k=>t[k]===undefined||(Number.isInteger(t[k])&&t[k]>=1&&t[k]<=4))&&['open','active','done'].includes(t.status))&&new Set(s.tasks.map(t=>t.id)).size===s.tasks.length&&s.settings&&typeof s.settings.effects==='boolean'&&typeof s.settings.sound==='boolean'}
function toast(t){$('notice').textContent=t;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,4500)}
function persist(){if(state.readError){toast('保存データを読み込めなかったため、上書きを停止しています。');return false}try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch(e){toast('保存できませんでした。JSONを書き出して保管してください。');return false}}
function days(t){if(!t.due)return Infinity;const now=new Date();return Math.round((new Date(t.due+'T00:00:00')-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000)}
function dueText(t){if(!t.due)return '期日未設定';const d=days(t);return t.due.replaceAll('-',' / ')+(t.status==='done'?'':d<0?' · '+Math.abs(d)+'日超過':d===0?' · 今日まで':d<=3?' · あと'+d+'日':'')}

function rank(t,k){return Number.isInteger(t[k])&&t[k]>=1&&t[k]<=4?t[k]:1}
function rankText(k,n){return n===4?(k==='importance'?'⚠ 最重要 4':'⚠ 最切迫 4'):(k==='importance'?'重要度 ':'切迫度 ')+n}
function compareTasks(a,b){const mode=state.settings.sort||'importance';return (mode==='importance'?rank(b,'importance')-rank(a,'importance')||rank(b,'urgency')-rank(a,'urgency'):mode==='urgency'?rank(b,'urgency')-rank(a,'urgency')||rank(b,'importance')-rank(a,'importance'):0)||(a.due||'9999').localeCompare(b.due||'9999')||String(a.createdAt||'').localeCompare(String(b.createdAt||''))}
function rankControl(t,k){
 const wrap=document.createElement('div');wrap.className='rank-control'+(rank(t,k)===4?' rank-max':'');
 const minus=document.createElement('button'),plus=document.createElement('button'),label=document.createElement('span');
 const name=k==='importance'?'重要度':'切迫度',n=rank(t,k);
 label.textContent=rankText(k,n);minus.textContent='−';plus.textContent='＋';
 minus.type=plus.type='button';minus.disabled=n===1;plus.disabled=n===4;
 minus.setAttribute('aria-label',t.title+'の'+name+'を1下げる');plus.setAttribute('aria-label',t.title+'の'+name+'を1上げる');
 for(const [button,delta]of[[minus,-1],[plus,1]])button.onclick=()=>{if(state.readError)return toast('保存データの読み込みエラーを解消してください。');const wasMissing=$('missingDialog').open;t[k]=Math.max(1,Math.min(4,rank(t,k)+delta));persist();render();const root=wasMissing?$('missingList'):$('list');const next=[...root.querySelectorAll('.row')].find(r=>r.dataset.id===t.id);next?.querySelector('[data-rank="'+k+'"] button:'+(delta===1?'last-child':'first-child'))?.focus({preventScroll:true});toast(t.title+'：'+rankText(k,rank(t,k)))};
 wrap.dataset.rank=k;wrap.append(minus,label,plus);return wrap
}
function renderMatrix(){
 const grid=$('matrixGrid'),tasks=state.tasks.filter(t=>t.status!=='done').sort(compareTasks);grid.replaceChildren();$('matrixCount').textContent='未達成 '+tasks.length+'件';
 for(let i=4;i>=1;i--)for(let u=1;u<=4;u++){
 const cell=document.createElement('div');cell.className='matrix-cell'+(i>=3?' high-importance':'')+(u>=3?' high-urgency':'');cell.dataset.importance=i;cell.dataset.urgency=u;
 const cap=document.createElement('span');cap.className='cell-coordinate';cap.textContent='重要'+i+'・切迫'+u;cell.append(cap);
 for(const t of tasks.filter(t=>rank(t,'importance')===i&&rank(t,'urgency')===u)){const b=document.createElement('button');b.type='button';b.className='matrix-task'+(i===4||u===4?' rank-max':'');b.textContent=(i===4||u===4?'⚠ ':'')+t.title;b.setAttribute('aria-label',t.title+'、重要度'+i+'、切迫度'+u+'、依頼を開く');b.onclick=()=>edit(t.id);cell.append(b)}grid.append(cell)
 }
 $('matrixEmpty').hidden=tasks.length>0
}

function row(t){const r=document.createElement('div');r.className='row';if(t.id===selected)r.classList.add('selected');r.dataset.status=t.status;r.dataset.id=t.id;const b=document.createElement('button');b.className='task';const strong=document.createElement('strong');strong.textContent=(t.status==='active'?'⚔ ':t.status==='done'?'✓ ':'')+t.title;const small=document.createElement('small');small.textContent=dueText(t);if(days(t)<=3&&t.status!=='done')small.className='urgent';b.append(strong,small);b.onclick=()=>{selected=t.id;if(window.matchMedia('(min-width:850px)').matches&&!$('missingDialog').open){render();document.querySelector('#list .selected .task')?.focus()}else edit(t.id)};const controls=document.createElement('div');controls.className='rank-controls';controls.append(rankControl(t,'importance'),rankControl(t,'urgency'));r.append(b,controls);return r}
function render(){const open=state.tasks.filter(t=>t.status!=='done'),done=state.tasks.length-open.length;$('stats').replaceChildren();for(const [n,label]of[[open.length,'受付中'],[done,'達成']]){const span=document.createElement('span'),b=document.createElement('strong');b.textContent=n;span.append(b,label);$('stats').append(span)}const missing=open.filter(t=>!t.due);$('missing').hidden=!missing.length;$('missing').textContent='！ 期日が未設定のクエスト '+missing.length+'件 →';$('missingList').replaceChildren(...missing.map(row));const tasks=state.tasks.filter(t=>filter==='open'?t.status!=='done':t.status===filter).sort(compareTasks);if(!tasks.some(t=>t.id===selected))selected=tasks[0]?.id||null;updateSheet(tasks.find(t=>t.id===selected));$('list').replaceChildren(...tasks.map(row));if(!tasks.length){const e=document.createElement('div');e.className='empty';const b=document.createElement('b');b.textContent=filter==='done'?'最初の達成を、ここに。':'次の冒険は、ここから。';const p=document.createElement('p');p.textContent=filter==='done'?'完了したクエストが並びます。':'タイトルだけで気軽に追加できます。';e.append(b,p);$('list').append(e)}document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));$('sortOrder').value=state.settings.sort||'importance';renderMatrix()}
function updateSheet(t){$('sheetTitle').textContent=t?t.title:'次の冒険は、ここから。';$('sheetDue').textContent=t?dueText(t):'未設定';const status=t?({open:'未達成',active:'進行中',done:'達成済み'}[t.status]):'未達成';$('sheetStatus').textContent=status;$('sheetState').textContent=t?.status==='done'?'達成':t?.status==='active'?'進行中':'受付中';$('sheetDetail').textContent=t?(t.detail||'依頼内容はまだ記入されていません。'):'新しい依頼を追加すると、ここに内容が表示されます。';$('sheetComment').textContent=t?(t.comment||'—'):'—';$('sheetImportance').textContent=t?rankText('importance',rank(t,'importance')):'—';$('sheetUrgency').textContent=t?rankText('urgency',rank(t,'urgency')):'—';for(const k of['importance','urgency'])$('sheet'+(k==='importance'?'Importance':'Urgency')).classList.toggle('rank-max',!!t&&rank(t,k)===4);$('sheetEdit').hidden=!t;document.querySelector('.quest-sheet').classList.toggle('sheet-cleared',t?.status==='done');$('sheetEdit').onclick=()=>t&&edit(t.id)}
function edit(id){editing=id;const t=state.tasks.find(x=>x.id===id);for(const k of['title','due','detail','comment'])$(k).value=t[k];for(const k of['importance','urgency']){$('edit'+k).value=rank(t,k);$('edit'+k).classList.toggle('rank-max',rank(t,k)===4)}$('start').hidden=t.status!=='open';$('complete').textContent=t.status==='done'?'未達成に戻す':'✓ 達成する';if($('missingDialog').open){missingMode=true;$('missingDialog').close()}$('editor').showModal()}
function saveFields(){const t=state.tasks.find(t=>t.id===editing);if(!$('title').value.trim()){toast('タイトルを入力してください');$('title').focus();return null}if(!$('due').checkValidity()){toast('期日を確認してください');return null}for(const k of['title','due','detail','comment'])t[k]=$(k).value.trim();for(const k of['importance','urgency'])t[k]=Number($('edit'+k).value);return t}
function closeEdit(){ $('editor').close();render();if(missingMode){missingMode=false;if(state.tasks.some(t=>!t.due&&t.status!=='done'))$('missingDialog').showModal()}}
$('add').onclick=()=>{if(state.readError)return toast('保存データの読み込みエラーを解消してください。');const title=$('quickTitle').value.trim();if(!title)return $('quickTitle').focus();state.tasks.push({id:crypto.randomUUID(),title,due:'',detail:'',comment:'',status:'open',importance:1,urgency:1,createdAt:new Date().toISOString()});persist();$('quickTitle').value='';render();toast('クエストを受注しました')};
$('quickTitle').onkeydown=e=>{if(e.key==='Enter')e.preventDefault()};
$('save').onclick=()=>{if(saveFields()){persist();closeEdit()}};$('closeEditor').onclick=closeEdit;$('editor').addEventListener('cancel',()=>{missingMode=false});
$('start').onclick=()=>{const t=saveFields();if(!t)return;t.status='active';persist();closeEdit();if(state.settings.bgm!==false&&$('bgmCard')){startBgm(true);effect('QUEST START',t.title,'start')}else effect('QUEST START',t.title,'start')};$('complete').onclick=()=>{const t=saveFields();if(!t)return;const completed=t.status!=='done';t.status=completed?'done':'open';persist();closeEdit();if(completed)effect('QUEST CLEAR',t.title,'clear')};
$('delete').onclick=()=>{if(confirm('このクエストを削除しますか？')){state.tasks=state.tasks.filter(t=>t.id!==editing);persist();closeEdit()}};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;selected=null;render()});$('missing').onclick=()=>$('missingDialog').showModal();$('closeMissing').onclick=()=>$('missingDialog').close();
$('settingsBtn').onclick=()=>{$('effects').checked=state.settings.effects;$('sound').checked=state.settings.sound;$('settings').showModal()};$('closeSettings').onclick=()=>$('settings').close();for(const k of['effects','sound'])$(k).onchange=()=>{state.settings[k]=$(k).checked;persist()};
$('sortOrder').onchange=()=>{state.settings.sort=$('sortOrder').value;persist();render()};for(const k of['importance','urgency'])$('edit'+k).onchange=()=>$('edit'+k).classList.toggle('rank-max',Number($('edit'+k).value)===4);
let audioCtx,audioNodes=[];
function stopSound(){for(const node of audioNodes){try{node.stop()}catch(e){}}audioNodes=[]}
function playSound(type){if(!state.settings.sound)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume();stopSound();const base=audioCtx.currentTime+(type==='clear'?.88:.59);
function tone(f,at,len,vol,wave='triangle',end=f){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=wave;o.frequency.setValueAtTime(f,at);o.frequency.exponentialRampToValueAtTime(end,at+len);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(vol,at+.015);g.gain.exponentialRampToValueAtTime(.0001,at+len);o.connect(g);g.connect(audioCtx.destination);o.start(at);o.stop(at+len+.02);audioNodes.push(o)}
tone(145,base,.38,.26,'sine',42);tone(76,base+.02,.55,.22,'triangle',30);
const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*.2,audioCtx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const n=audioCtx.createBufferSource(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();n.buffer=buffer;f.type='lowpass';f.frequency.value=1700;g.gain.value=.2;n.connect(f);f.connect(g);g.connect(audioCtx.destination);n.start(base);audioNodes.push(n);
const notes=type==='clear'?[[293.66,0],[440,.16],[587.33,.32],[554.37,.58],[739.99,.76],[880,1.02]]:type==='start'?[[220,0],[329.63,.22],[440,.44]]:[[220,0],[220,.3]];for(const [hz,t]of notes){tone(hz,base+.18+t,.58,.08,'sawtooth');tone(hz/2,base+.18+t,.65,.08)}
}catch(e){}}
let previousFocus;function endFx(){clearTimeout(fxTimer);stopSound();$('fx').close();$('fx').hidden=true;document.body.classList.remove('impact');if(previousFocus?.isConnected)previousFocus.focus()}
function effect(label,title,type){if(!state.settings.effects){toast(type==='clear'?'達成！ おつかれさま！':type==='start'?'クエスト開始！':'期日が近いクエストがあります');return}previousFocus=document.activeElement;$('fx').dataset.kind=type;$('resultCaption').textContent=type==='clear'?'目的を達成しました':type==='start'?'依頼を開始します':'期日が近づいています';$('sealEn').textContent=label;$('sealJp').textContent=type==='clear'?'クエスト達成':type==='start'?'クエスト開始':'期日接近';$('stamp').querySelector('.seal-caption').textContent=type==='clear'?'— HUNT COMPLETE —':type==='start'?'— YOUR QUEST BEGINS —':'— TIME TO ACT —';$('fxTitle').textContent=title;$('fx').querySelectorAll('.spark').forEach(e=>e.remove());for(let i=0;i<36;i++){const s=document.createElement('i');s.className='spark';s.style.setProperty('--a',i*10+'deg');$('fx').append(s)}$('fx').hidden=false;if(!$('fx').open)$('fx').showModal();$('fx').getAnimations({subtree:true}).forEach(a=>{a.cancel();a.play()});document.body.classList.add('impact');$('fx').focus();playSound(type);clearTimeout(fxTimer);fxTimer=setTimeout(endFx,5200)}$('fx').onclick=endFx;$('fx').onkeydown=e=>{if(['Escape','Enter',' '].includes(e.key)){e.preventDefault();endFx()}if(e.key==='Tab'){e.preventDefault();$('fx').focus()}};$('preview').onclick=()=>effect('QUEST CLEAR','ひとつ達成。次の冒険へ。','clear');
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='quest-log-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('import').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10000000)throw Error();const next=JSON.parse(await f.text());if(!valid(next))throw Error();if(confirm(next.tasks.length+'件のクエストで置き換えます。現在のJSONは書き出しましたか？')){state={version:1,tasks:next.tasks,settings:next.settings};persist();render();$('settings').close();toast('読み込みました')}}catch(e){toast('対応するJSONファイルではありません。データは変更していません。')}finally{$('importFile').value=''}};
render();const urgent=state.tasks.filter(t=>t.status!=='done'&&days(t)<=3);if(urgent.length)setTimeout(()=>effect('TIME TO QUEST',urgent.length+'件のクエストの期日が迫っています','warning'),500);

/* YouTube IFrame Player API: no Data API key or paid service. */
let bgmPlayer=null,bgmReady=false;
function bgmMessage(message){if($('bgmStatus'))$('bgmStatus').textContent=message}
function startBgm(restart=false){
 if(!$('bgmCard'))return;

 if(!bgmReady){bgmMessage('準備ができたら「BGM再生」または動画の再生ボタンをタップしてください。');return}
 try{bgmPlayer.unMute();bgmPlayer.setVolume(Number($('bgmVolume').value));if(restart===true)bgmPlayer.seekTo(0,true);bgmPlayer.playVideo();bgmMessage('再生を要求しました。音が出ない場合は動画の再生ボタンをタップしてください。')}catch(e){bgmMessage('動画の再生ボタンをタップしてください。')}
}
function stopBgm(){try{bgmPlayer?.pauseVideo()}catch(e){}bgmMessage('停止しました。')}
if($('bgmPlayer')){
 $('bgmToggle').checked=state.settings.bgm!==false;
 $('bgmVolume').value=Number.isFinite(state.settings.bgmVolume)?Math.max(0,Math.min(100,state.settings.bgmVolume)):40;
 $('bgmToggle').onchange=()=>{state.settings.bgm=$('bgmToggle').checked;if(!state.settings.bgm)stopBgm();persist()};
 $('bgmVolume').oninput=()=>{const v=Number($('bgmVolume').value);state.settings.bgmVolume=v;try{bgmPlayer?.setVolume(v)}catch(e){}persist()};
 $('bgmPlay').onclick=startBgm;$('bgmStop').onclick=stopBgm;
 window.onYouTubeIframeAPIReady=()=>{bgmPlayer=new YT.Player('bgmPlayer',{events:{
 onReady:()=>{bgmReady=true;bgmMessage('準備できました。「開始」または「BGM再生」で再生します。')},
 onStateChange:e=>{if(e.data===1)bgmMessage('再生中');else if(e.data===2)bgmMessage('一時停止中');else if(e.data===0)bgmMessage('再生が終了しました。')},
 onAutoplayBlocked:()=>bgmMessage('自動再生が制限されました。動画の再生ボタンをタップしてください。'),
 onError:e=>bgmMessage([101,150].includes(e.data)?'この動画は埋め込み再生が許可されていません。「YouTubeで開く」をご利用ください。':'YouTubeを再生できませんでした。動画内の案内、または「YouTubeで開く」をご確認ください。')
 }})};
 const yt=document.createElement('script');yt.src='https://www.youtube.com/iframe_api';yt.async=true;document.head.append(yt);
}

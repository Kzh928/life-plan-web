/* 端末内の明確な表現だけを項目と値へ整理する．曖昧・否定・過去の文は推測しない． */
'use strict';
const INFORMATION_PRESETS={
  standard:['年齢','性別','場所','出身','誕生日','仕事','学業','趣味・活動','人間関係・交際','その他'],
  company:['年次','入社年','役職','部署','職業','性別','年齢','場所','出身','誕生日','仕事','趣味・活動','その他'],
  school:['学年','学業','年齢','性別','場所','出身','誕生日','趣味・活動','その他'],
  friends:['年齢','誕生日','場所','出身','趣味・活動','性別','仕事','学業','人間関係・交際','その他'],
  oshi:['公式プロフィール','YouTube','紹介','ユニットのYouTube','誕生日','趣味・活動','その他']
};
const INFORMATION_PRESET_NAMES={standard:'標準',company:'会社・バイト',school:'学校・サークル',friends:'友達',oshi:'推し'};
const infoNorm=s=>String(s??'').normalize('NFKC').trim().replace(/\s+/g,' ');
function canonicalMemoInfo(input,category='その他',owner=null){
  const original=String(input??''),allowed=new Set(['その他','場所','住所','居住地','住まい','出身','年齢','年次','入社年','役職','部署','職業','性別','学年','学業','仕事','プロフィール']);
  if(!allowed.has(category)||/[\r\n]/.test(original))return {category,text:original,key:null};
  let text=infoNorm(original).replace(/[。．]$/,'');
  if(owner)for(const name of [owner.name,...(owner.aliases||[])].sort((a,b)=>b.length-a.length)){const prefix=infoNorm(name);if(text.startsWith(prefix+'は')||text.startsWith(prefix+'って')){text=text.slice(prefix.length).replace(/^(?:は|って)/,'').trim();break;}}
  if(/[?？\n]|かも|らしい|たぶん|多分|不明|予定|以前|昔|だった|住んでいた|ない|なかった/.test(text))return {category,text:original,key:null};
  const result=(label,value)=>{value=infoNorm(value).replace(/です$/,'').replace(/\s/g,'');return {category:label,text:value,key:label+'\u0000'+value};};let m;
  if((m=text.match(/^(?:居住地|住所|住まい|場所)\s*[:：]\s*(.{1,40})$/)))return result('場所',m[1]);
  if((m=text.match(/^(.{1,40}?)(?:に住んで(?:いる|る|います)|(?:に)?在住)(?:です)?$/))&&!/[、，,。.!！はが]|(?:ので|けど|から|と一緒|人が|友達が|彼女が|彼氏が)/.test(m[1]))return result('場所',m[1]);
  if((m=text.match(/^(?:出身(?:地)?\s*[:：は]\s*(.{1,40})|(.{1,40}?)出身)(?:です)?$/)))return result('出身',m[1]||m[2]);
  if((m=text.match(/^(?:年齢\s*[:：は]\s*)?(\d{1,3})歳(?:です)?$/))&&Number(m[1])<130)return result('年齢',Number(m[1])+'歳');
  if((m=text.match(/^(?:性別\s*[:：は]\s*)?(男性|女性|男|女)(?:です)?$/)))return result('性別',({男:'男性',女:'女性'}[m[1]]||m[1]));
  if((m=text.match(/^(?:年次\s*[:：は]\s*|入社)?(\d{1,2})年目(?:です)?$/)))return result('年次',Number(m[1])+'年目');
  if((m=text.match(/^(\d{4})年入社(?:です)?$/)))return result('入社年',m[1]+'年');
  if((m=text.match(/^(?:入社年)\s*[:：は]\s*(\d{4})年?$/)))return result('入社年',m[1]+'年');
  if((m=text.match(/^(?:役職|部署|職業|学年)\s*[:：は]\s*(.{1,40})$/)))return result(text.match(/^(役職|部署|職業|学年)/)[1],m[1]);
  if(['場所','住所','居住地','住まい','出身','性別','年次','入社年','役職','部署','職業','学年','年齢'].includes(category)&&text.length<=40&&!/[、，,。!！]|です$|に住|在住|出身$/.test(text))return result(['住所','居住地','住まい'].includes(category)?'場所':category,text);
  return {category,text:original,key:null};
}
function factInformation(f,data=state){return canonicalMemoInfo(f.text,f.category||'その他',data.people.find(p=>p.id===f.personId));}
function sameFactMeaning(f,text,category,pid,data=state){if(f.archived||f.personId!==pid)return false;const a=factInformation(f,data),b=canonicalMemoInfo(text,category,data.people.find(p=>p.id===pid));return a.key&&b.key?a.key===b.key:infoNorm(f.text)===infoNorm(text);}
function keepFactSource(f,raw){if(!raw||raw===f.source)return;f.sourceEntries??=[];if(!f.sourceEntries.some(entry=>entry.text===raw))f.sourceEntries.push({text:raw,createdAt:new Date().toISOString()});}
function defaultPresetType(group,groups){const names=communityPath(groups,group?.id||'');return /会社|バイト|職場|勤務/.test(names)?'company':/学校|高校|中学|大学|サークル|部活/.test(names)?'school':/友達|友人/.test(names)?'friends':/にじさんじ|推し|VTuber|ChroNoiR/.test(names)?'oshi':'standard';}
function communityInformationPreset(group,groups){
  const seen=new Set();let current=group;while(current&&!seen.has(current.id)){seen.add(current.id);if(Array.isArray(current.informationOrder)&&current.informationOrder.length)return {name:communityPath(groups,current.id),order:current.informationOrder};current=groups.find(g=>g.id===current.parentId);}
  const type=defaultPresetType(group,groups);return {name:group?communityPath(groups,group.id):'標準',order:INFORMATION_PRESETS[type]};
}
function personInformationPreset(p,data=state){
  const groups=data.communities||[],members=groups.filter(g=>communityIds(p,groups).includes(g.id));const chosen=members.find(g=>g.id===p.informationCommunityId)||members.find(g=>defaultPresetType(g,groups)==='company')||members[0];return communityInformationPreset(chosen,groups);
}
function organizedPersonFacts(p,data=state){
  const order=personInformationPreset(p,data).order,seen=new Map(),rows=[];
  for(const f of data.facts.filter(f=>f.personId===p.id&&!f.archived)){const info=factInformation(f,data),key=info.key||'raw\u0000'+infoNorm(info.text);if(seen.has(key)){seen.get(key).mergedFactIds.push(f.id);continue;}const row={...f,category:info.category,text:info.text,mergedFactIds:[f.id]};seen.set(key,row);rows.push(row);}
  const rank=c=>{const i=order.indexOf(c);return i<0?order.length:i;};return rows.sort((a,b)=>rank(a.category)-rank(b.category)||a.category.localeCompare(b.category,'ja')||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
}
function informationPresetHint(p){const preset=personInformationPreset(p);return `<div class="information-preset-hint">表示順：${escapeHtml(preset.name)} <button data-action="person-information-preset" class="edit">変更</button></div>`;}
function personInformationPresetForm(){const p=person(selected);if(!p)return;const groups=state.communities.filter(g=>communityIds(p,state.communities).includes(g.id));setModal(`<h2 id="modal-title">情報の表示順</h2><form id="person-information-preset-form"><label class="field"><span>優先するコミュニティ</span><select name="group"><option value="">自動（会社を優先）</option>${groups.map(g=>`<option value="${escapeHtml(g.id)}" ${p.informationCommunityId===g.id?'selected':''}>${escapeHtml(communityPath(state.communities,g.id))}</option>`).join('')}</select></label><p>項目の順番は，人物一覧のコミュニティ「管理」から変更できます．</p><div class="actions"><button type="button" class="btn subtle" data-action="close-modal">戻る</button><button class="btn">保存</button></div></form>`);}
function informationPresetEditor(gid){const group=state.communities.find(g=>g.id===gid);if(!group)return;const preset=communityInformationPreset(group,state.communities);setModal(`<h2 id="modal-title">${escapeHtml(group.name)}の情報プリセット</h2><form id="information-preset-form" data-id="${escapeHtml(gid)}"><label class="field"><span>ひな形</span><select id="information-preset-template"><option value="">現在の順番</option>${Object.entries(INFORMATION_PRESET_NAMES).map(([key,name])=>`<option value="${key}">${name}</option>`).join('')}</select></label><label class="field"><span>大事な順に1行1項目（追加・並べ替えできます）</span><textarea name="order" rows="10" maxlength="2000">${escapeHtml(preset.order.join('\n'))}</textarea></label><p class="footnote">未登録の内容は推測しません．ここにない項目は最後に表示します．</p><div class="actions"><button type="button" class="btn subtle" data-action="communities-manage">戻る</button><button class="btn">保存</button></div></form>`);}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='community-information-preset')informationPresetEditor(b.dataset.id);if(b.dataset.action==='person-information-preset')personInformationPresetForm();});
document.addEventListener('change',e=>{if(e.target.id==='information-preset-template'&&INFORMATION_PRESETS[e.target.value]){const form=e.target.closest('form');field(form,'order').value=INFORMATION_PRESETS[e.target.value].join('\n');}});
document.addEventListener('submit',async e=>{const form=e.target;if(!['information-preset-form','person-information-preset-form'].includes(form.id))return;e.preventDefault();if(working)return;if(form.id==='information-preset-form'){const order=[...new Set(field(form,'order').value.split(/[\n、，,]/).map(s=>s.trim()).filter(Boolean))].slice(0,50);if(!order.length){toast('項目を1つ以上入力してください');return;}if(await mutate(()=>{const group=state.communities.find(g=>g.id===form.dataset.id);group.informationOrder=order;modal=null;}))toast('コミュニティの表示順を保存しました');}else await mutate(()=>{const p=person(selected);if(p)p.informationCommunityId=field(form,'group').value||null;modal=null;});});
if(typeof module!=='undefined')module.exports={canonicalMemoInfo,sameFactMeaning,organizedPersonFacts,personInformationPreset,communityInformationPreset};
function semanticFactMembers(f){return state.facts.filter(other=>sameFactMeaning(other,f.text,f.category,f.personId));}
function informationMissingHtml(p,rows){const present=new Set(rows.map(f=>f.category)),missing=personInformationPreset(p).order.filter(c=>c!=='その他'&&!present.has(c));return missing.length?`<details class="information-missing"><summary>未登録の項目（${missing.length}）</summary><div>${missing.map(c=>`<button class="btn subtle small" data-action="preset-add-field" data-category="${escapeHtml(c)}">${escapeHtml(c)}を追加</button>`).join('')}</div></details>`:'';}
function informationFieldOptions(p){return `<datalist id="information-field-options">${personInformationPreset(p).order.map(c=>`<option value="${escapeHtml(c)}">`).join('')}</datalist>`;}
document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button?.dataset.action==='preset-add-field')factForm(null,button.dataset.category);});

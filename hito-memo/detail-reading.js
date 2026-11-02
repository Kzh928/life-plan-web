/* 人物ページは読むことを優先し，入力と記録の詳細は必要なときに開く． */
'use strict';
function compactPersonCommunities(p){return `<div class="detail-community-line">${communityMembershipLabels(p).map(name=>`<span class="chip">${escapeHtml(name)}</span>`).join('')||'<span class="muted">未分類</span>'}<button class="edit" data-action="memberships-edit" data-id="${escapeHtml(p.id)}">所属を編集</button></div>`;}
function factRecordDetails(f){
  if(!f)return '';const date=value=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'不明':parsed.toLocaleString('ja-JP');};
  const members=typeof semanticFactMembers==='function'?semanticFactMembers(f):[f],sources=[...new Set(members.flatMap(item=>[item.source||item.text,...(item.sourceEntries||[]).map(entry=>entry.text)]))];
  const old=f.key?state.facts.filter(x=>x.personId===f.personId&&x.key===f.key&&x.archived):[];
  return `<div class="fact-record-date">登録：${escapeHtml(date(f.createdAt))}${f.updatedAt?` ／ 更新：${escapeHtml(date(f.updatedAt))}`:''}</div><details class="fact-record-source"><summary>元の入力${sources.length>1?'（'+sources.length+'件）':''}${old.length?'・以前の情報':''}</summary>${sources.map(text=>`<div class="preview-box">${escapeHtml(text)}</div>`).join('')}${old.map(x=>`<p>${escapeHtml(x.text)} <small>${escapeHtml(date(x.createdAt))}</small></p>`).join('')}</details>`;
}
function openDetailInput(){
  if(page!=='detail'||!person(selected)||working)return;const p=person(selected);
  setModal(`<h2 id="modal-title">${escapeHtml(p.name)}の情報を追加</h2><form id="quick-form" class="detail-quick-form"><label class="field"><span>メモ</span><textarea id="quick" name="quick" rows="7" maxlength="20000" placeholder="短い文章も，複数行の長いメモも入力できます" required>${escapeHtml(quickDraft)}</textarea></label><p class="footnote">名前を書かない情報は，基本的に${escapeHtml(p.name)}へ整理します．</p><div class="actions"><button type="button" class="btn subtle" data-action="add-fact">項目を指定して追加</button><button type="button" class="btn subtle" data-action="close-modal">閉じる</button><button class="btn" type="submit">整理する</button></div></form>`);
}
document.addEventListener('click',e=>{if(e.target.closest('[data-action]')?.dataset.action==='detail-quick')openDetailInput();});
function returnToMemoInput(){
  if(page==='detail'){openDetailInput();return;}
  closeModal();const input=document.querySelector('#quick');input?.focus({preventScroll:true});input?.scrollIntoView?.({block:'center'});
}
function refreshDetailDraftStatus(){
  const button=document.querySelector('[data-action="detail-quick"]');if(button)button.textContent=quickDraft?'＋ 情報を追加（入力途中）':'＋ 情報を追加';
}
document.addEventListener('click',e=>{if(e.target.closest('[data-action]')?.dataset.action==='organizer-back-input')returnToMemoInput();});
document.addEventListener('input',e=>{if(e.target.id==='quick'){quickDraft=e.target.value;refreshDetailDraftStatus();}});

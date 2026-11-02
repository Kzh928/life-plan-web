/* このコードは，階層コミュニティと人物の複数所属を，既存メモを消さずに管理します． */
'use strict';
let communityFilter='all';
function ensureCommunities(data){
  if(data.communities===undefined)data.communities=[{id:'community-company',name:'会社',parentId:null},{id:'community-friends',name:'友達',parentId:null},{id:'community-highschool',name:'高校',parentId:'community-friends'},{id:'community-juniorhigh',name:'中学',parentId:'community-friends'}];
  if(!Array.isArray(data.communities))throw Error('コミュニティの形式を確認してください');
  return data;
}
function communityDescendants(groups,gid){const found=new Set([gid]);let changed=true;while(changed){changed=false;for(const g of groups)if(found.has(g.parentId)&&!found.has(g.id)){found.add(g.id);changed=true;}}return found;}
function communityPath(groups,gid){const parts=[],seen=new Set();let current=groups.find(g=>g.id===gid);while(current&&!seen.has(current.id)){parts.unshift(current.name);seen.add(current.id);current=groups.find(g=>g.id===current.parentId);}return parts.join(' › ');}
function communityIds(p,groups){return [...new Set((Array.isArray(p.communityIds)?p.communityIds:[]).filter(gid=>groups.some(g=>g.id===gid)))];}
function communityMatches(p,groups,filter){if(filter==='all')return true;const ids=communityIds(p,groups);if(filter==='unassigned')return !ids.length;const family=communityDescendants(groups,filter);return ids.some(gid=>family.has(gid));}
function validateCommunity(groups,gid,name,parentId){
  if(!name.trim()||name.trim().length>80)throw Error('名前は1〜80文字で入力してください．');
  if(parentId&&!groups.some(g=>g.id===parentId))throw Error('親コミュニティが見つかりません．');
  if(gid&&parentId&&communityDescendants(groups,gid).has(parentId))throw Error('自分自身や配下のコミュニティを親にはできません．');
  if(groups.some(g=>g.id!==gid&&g.parentId===(parentId||null)&&g.name.normalize('NFKC').trim()===name.normalize('NFKC').trim()))throw Error('同じ場所に同じ名前のコミュニティがあります．');
}
function removeCommunity(data,gid){const g=data.communities.find(g=>g.id===gid);if(!g)return;data.communities=data.communities.filter(g=>g.id!==gid);for(const child of data.communities)if(child.parentId===gid)child.parentId=g.parentId||null;for(const p of data.people)p.communityIds=(p.communityIds||[]).filter(id=>id!==gid);}
function sortedCommunities(){ensureCommunities(state);return [...state.communities].sort((a,b)=>communityPath(state.communities,a.id).localeCompare(communityPath(state.communities,b.id),'ja'));}
function communityMembershipLabels(p){ensureCommunities(state);return communityIds(p,state.communities).map(gid=>communityPath(state.communities,gid));}
function communityFilterHtml(){const groups=sortedCommunities();if(!['all','unassigned',...groups.map(g=>g.id)].includes(communityFilter))communityFilter='all';
  const opts=[{id:'all',name:'すべて'},{id:'unassigned',name:'未分類'},...groups.map(g=>({id:g.id,name:communityPath(groups,g.id)}))];
  return `<div class="community-filter"><label class="field"><span>コミュニティで見る</span><select id="community-filter">${opts.map(g=>`<option value="${escapeHtml(g.id)}" ${g.id===communityFilter?'selected':''}>${escapeHtml(g.name)}（${state.people.filter(p=>communityMatches(p,groups,g.id)).length}人）</option>`).join('')}</select></label><button class="btn subtle small" data-action="communities-manage">管理</button></div>`;
}
function communityPicker(p){const groups=sortedCommunities(),chosen=p?communityIds(p,groups):groups.some(g=>g.id===communityFilter)?[communityFilter]:[];return `<fieldset class="community-picker"><legend>コミュニティ（複数選択できます）</legend>${groups.map(g=>`<label><input type="checkbox" name="communities" value="${escapeHtml(g.id)}" ${chosen.includes(g.id)?'checked':''}><span>${escapeHtml(communityPath(groups,g.id))}</span></label>`).join('')||'<p>人物一覧の「管理」から追加できます．</p>'}</fieldset>`;}
function selectedCommunities(form){return [...form.querySelectorAll('input[name="communities"]:checked')].map(input=>input.value).filter(gid=>state.communities.some(g=>g.id===gid));}
function communitiesManage(){const groups=sortedCommunities();setModal(`<h2 id="modal-title">コミュニティを管理</h2><p>会社・友達などを自由に作れます．「友達」の中に「高校」「中学」などを追加できます．人物は消えません．</p>${groups.map(g=>`<div class="community-manage-row"><span>${escapeHtml(communityPath(groups,g.id))}${!g.parentId?'<small class="community-root-note">上位なし（どのコミュニティの中でもない）</small>':''}</span><div class="community-manage-actions"><button class="iconbtn" data-action="community-information-preset" data-id="${escapeHtml(g.id)}">情報プリセット</button><button class="iconbtn" data-action="community-edit" data-id="${escapeHtml(g.id)}">編集</button></div></div>`).join('')}<div class="actions"><button class="btn subtle" data-action="close-modal">閉じる</button><button class="btn" data-action="community-new">＋ 追加</button></div>`);}
function communityForm(gid){const groups=sortedCommunities(),g=groups.find(g=>g.id===gid),excluded=gid?communityDescendants(groups,gid):new Set();setModal(`<h2 id="modal-title">コミュニティを${g?'編集':'追加'}</h2><form id="community-form" data-id="${escapeHtml(gid||'')}"><label class="field"><span>名前</span><input name="name" maxlength="80" required value="${escapeHtml(g?.name||'')}"></label><label class="field"><span>どのコミュニティの中に作る？</span><select name="parent"><option value="">上位なし（どのコミュニティの中でもない）</option>${groups.filter(group=>!excluded.has(group.id)).map(group=>`<option value="${escapeHtml(group.id)}" ${g?.parentId===group.id?'selected':''}>${escapeHtml(communityPath(groups,group.id))}</option>`).join('')}</select></label><p id="community-error" class="error" role="alert"></p><div class="actions">${g?`<button class="btn danger" type="button" data-action="community-delete" data-id="${escapeHtml(g.id)}">削除</button>`:''}<button class="btn subtle" type="button" data-action="communities-manage">戻る</button><button class="btn" type="submit">保存</button></div></form>`);}
function membershipsForm(pid){const p=person(pid);if(!p)return;setModal(`<h2 id="modal-title">${escapeHtml(p.name)}の所属</h2><form id="membership-form" data-id="${escapeHtml(pid)}">${communityPicker(p)}<p class="footnote">高校にも会社にも所属，という登録ができます．未選択なら未分類になります．</p><div class="actions"><button class="btn subtle" type="button" data-action="close-modal">戻る</button><button class="btn" type="submit">保存</button></div></form>`);}
function communityDetail(p){return `<section class="panel section community-section"><div class="sectionheader"><h2>コミュニティ</h2><button class="iconbtn" data-action="memberships-edit" data-id="${escapeHtml(p.id)}">所属を編集</button></div><div class="community-badges">${communityMembershipLabels(p).map(label=>`<span class="chip">${escapeHtml(label)}</span>`).join('')||'<span class="muted">未分類</span>'}</div></section>`;}
if(typeof document!=='undefined'){
document.addEventListener('change',e=>{if(e.target.id==='community-filter'){communityFilter=e.target.value;render();}});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const gid=b.dataset.id;switch(b.dataset.action){
  case 'communities-manage':communitiesManage();break;
  case 'community-new':communityForm(null);break;
  case 'community-edit':communityForm(gid);break;
  case 'memberships-edit':membershipsForm(gid);break;
  case 'community-delete':{const g=state.communities.find(g=>g.id===gid);if(!g)return;setModal(`<h2 id="modal-title">コミュニティを削除</h2><p>「${escapeHtml(g.name)}」を削除します．人物やメモは消えません．配下のコミュニティは一つ上へ移動します．</p><div class="actions"><button class="btn subtle" data-action="communities-manage">戻る</button><button class="btn danger" data-action="community-delete-confirm" data-id="${escapeHtml(gid)}">削除する</button></div>`);break;}
  case 'community-delete-confirm':if(await mutate(()=>{removeCommunity(state,gid);if(communityFilter===gid)communityFilter='all';},{render:false})){render();communitiesManage();}break;
}});
document.addEventListener('submit',async e=>{const form=e.target;if(!['community-form','membership-form'].includes(form.id))return;e.preventDefault();if(working)return;
  if(form.id==='community-form'){const gid=form.dataset.id,name=field(form,'name').value.trim(),parentId=field(form,'parent').value||null;try{validateCommunity(state.communities,gid,name,parentId);}catch(err){$('#community-error').textContent=err.message;return;}
    if(await mutate(()=>{if(gid){const g=state.communities.find(g=>g.id===gid);g.name=name;g.parentId=parentId;}else state.communities.push({id:id(),name,parentId});},{render:false})){render();communitiesManage();}}
  else{const memberships=selectedCommunities(form);await mutate(()=>{const p=person(form.dataset.id);if(!p)throw Error('人物が見つかりません');p.communityIds=memberships;p.memoCommunityIds=[];modal=null;});}
});
}
if(typeof module!=='undefined')module.exports={ensureCommunities,communityDescendants,communityPath,communityIds,communityMatches,validateCommunity,removeCommunity};

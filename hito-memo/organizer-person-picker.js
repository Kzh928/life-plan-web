/* 保存先は，コミュニティを開いてから選ぶ．未分類だけは最初の一覧の末尾に並べる． */
'use strict';
let organizerPersonView=null;
function organizerPersonSelection(q){
  ensureCommunities(state);const allowed=new Set(q.choices.map(c=>c.value));
  const people=orderedPeople(state).filter(p=>allowed.has(p.id));
  const groups=sortedCommunities().filter(g=>people.some(p=>communityMatches(p,state.communities,g.id)));
  return {people,groups,unassigned:people.filter(p=>!communityIds(p,state.communities).length)};
}
function organizerPersonAtRoot(q){return !organizerPersonView||organizerPersonView.plan!==organizerPlan||organizerPersonView.questionId!==q.id||!organizerPersonView.groupId;}
function organizerPersonChoices(q){
  if(organizerPersonView?.plan!==organizerPlan||organizerPersonView?.questionId!==q.id)organizerPersonView=null;
  const {people,groups,unassigned}=organizerPersonSelection(q),group=groups.find(g=>g.id===organizerPersonView?.groupId);
  const personButton=p=>`<button type="button" class="choice organizer-person-choice" data-action="organizer-answer" data-question="${escapeHtml(q.id)}" data-answer="${escapeHtml(p.id)}">${escapeHtml(p.name)}</button>`;
  if(group){const members=people.filter(p=>communityMatches(p,state.communities,group.id));return `<div class="organizer-community-heading"><button type="button" class="btn subtle small" data-action="organizer-person-root" data-question="${escapeHtml(q.id)}">コミュニティ一覧に戻る</button><h4>${escapeHtml(communityPath(state.communities,group.id))}</h4></div><div class="organizer-person-choices">${members.map(personButton).join('')}</div>`;}
  organizerPersonView=null;
  return `<div class="organizer-person-choices">${groups.map(g=>{const count=people.filter(p=>communityMatches(p,state.communities,g.id)).length;return `<button type="button" class="choice organizer-community-choice" data-action="organizer-person-community" data-question="${escapeHtml(q.id)}" data-id="${escapeHtml(g.id)}"><span>${escapeHtml(communityPath(state.communities,g.id))}</span><small>${count}人</small></button>`;}).join('')}${unassigned.length?`<div class="organizer-unassigned-label">未分類</div>${unassigned.map(personButton).join('')}`:''}${!people.length?'<p class="muted">登録済みの人物がいません．下から新しい人物を登録できます．</p>':''}</div>`;
}
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');if(!button||working||!organizerPlan)return;
  if(!['organizer-person-community','organizer-person-root'].includes(button.dataset.action))return;
  const q=organizerPlan.issues.find(q=>!q.resolved&&q.id===button.dataset.question&&['subject-pick','identity-pick'].includes(q.kind));if(!q)return;
  if(button.dataset.action==='organizer-person-community'){
    const groups=organizerPersonSelection(q).groups;if(!groups.some(g=>g.id===button.dataset.id))return;
    organizerPersonView={plan:organizerPlan,questionId:q.id,groupId:button.dataset.id};
  }else organizerPersonView=null;
  continueOrganizer();
});

/* このコードは，曖昧な部分への質問と回答，人物別の一括保存を行います．外部通信はしません． */
'use strict';
let organizerPlan=null,organizerUndo=null,organizerResult=null;
function startOrganizer(raw){
  if(working)return;
  quickDraft=raw;
  const defaultId=page==='detail'?selected:null;
  if(organizerPlan?.raw===raw&&organizerPlan.defaultId===defaultId)return continueOrganizer();
  ensureCommunities(state);organizerPlan=analyzeMemo(raw,state.people,defaultId,state.communities);organizerPlan.defaultId=defaultId;
  if(!organizerPlan.notes.length&&!organizerPlan.relations.length){toast('整理できる情報がありません．名前の下に情報を入力してください');return;}
  return continueOrganizer();
}
function continueOrganizer(){
  const q=organizerPlan.issues.find(q=>!q.resolved);
  if(!q)return commitOrganizer();
  const remaining=organizerPlan.issues.filter(q=>!q.resolved).length;
  setModal(`<h2 id="modal-title">ここだけ教えてください</h2><p>未確認 ${remaining}件．ほかの部分は自動で整理しています．</p><h3>${escapeHtml(q.prompt)}</h3><div class="preview-box">${escapeHtml(q.excerpt)}</div>${typeof organizerPersonChoices==='function'&&['subject-pick','identity-pick'].includes(q.kind)?organizerPersonChoices(q):q.choices.map(c=>`<button class="choice" data-action="organizer-answer" data-question="${q.id}" data-answer="${escapeHtml(c.value)}">${escapeHtml(c.label)}</button>`).join('')}${q.kind==='subject-pick'&&(typeof organizerPersonAtRoot!=='function'||organizerPersonAtRoot(q))?`<details class="organizer-new-person"><summary>新しい人物を登録する</summary><form id="organizer-person-form" data-question="${q.id}"><label class="field"><span>新しい人物の名前</span><input name="name" maxlength="80" required></label><button class="btn" type="submit">この人物の情報として保存</button></form></details>`:''}<p id="organizer-error" class="error" role="alert"></p><div class="actions"><button class="btn subtle" data-action="organizer-back-input">入力に戻る</button></div>`);
}
async function commitOrganizer(){
  if(working||!organizerPlan)return;
  const plan=organizerPlan,snapshot=structuredClone(state);let count=0,duplicates=0;const groups=new Map(),receipt={raw:plan.raw,factIds:[],relationIds:[],newPersonIds:[],duplicateIds:[]};
  const addResult=(p,text,category)=>{if(!groups.has(p.id))groups.set(p.id,{name:p.name,notes:[]});groups.get(p.id).notes.push({text,category});};
  const saved=await mutate(()=>{
    const ids=new Map();
    for(const t of plan.targets.filter(t=>!t.mergedInto)){
      // Only create a person if they receive facts, relations, or an explicitly confirmed alias.
      if(!plan.notes.some(n=>n.targets.includes(t.key))&&!plan.relations.some(r=>r.a===t.key||r.b===t.key)&&!t.aliases.length)continue;
      let p=t.personId?person(t.personId):state.people.find(p=>norm(p.name)===norm(t.name));
      if(!p){p={id:id(),name:t.name,aliases:[],createdAt:stamp()};state.people.push(p);receipt.newPersonIds.push(p.id);}
      p.aliases=[...new Set([...p.aliases,...t.aliases])].filter(a=>norm(a)!==norm(p.name));ids.set(t.key,p.id);
    }
    for(const n of plan.notes){
      if(!n.targets.length)throw Error('保存先が未確定です');
      for(const target of n.targets){const pid=ids.get(target),p=person(pid);if(!p)throw Error('保存先が見つかりません');
        addResult(p,n.text,n.category);
        const communityId=n.communityName?resolveMemoCommunity(state,n.communityName,n.communityId):null;
        const duplicate=state.facts.find(f=>!f.archived&&f.personId===pid&&(typeof sameFactMeaning==='function'?sameFactMeaning(f,n.text,n.category,pid):f.text.trim().normalize('NFKC')===n.text.trim().normalize('NFKC')));if(duplicate){if(typeof keepFactSource==='function')keepFactSource(duplicate,plan.raw);if(communityId){duplicate.communityId=communityId;duplicate.category='コミュニティ';attachMemoCommunity(state,pid,communityId);}receipt.factIds.push(duplicate.id);receipt.duplicateIds.push(duplicate.id);duplicates++;continue;}
        const fid=id();receipt.factIds.push(fid);state.facts.push({id:fid,kind:'fact',personId:pid,text:n.text,category:n.category,source:plan.raw,createdAt:stamp(),archived:false,...(communityId?{communityId}:{})});if(communityId)attachMemoCommunity(state,pid,communityId);count++;
      }
    }
    for(const r of plan.relations){const relation={...r,a:ids.get(r.a),b:ids.get(r.b)};if(!relation.a||!relation.b||relation.a===relation.b)throw Error('関係の人物を確認してください');
      const duplicate=state.relations.find(existing=>sameRelation(existing,relation));if(duplicate){receipt.relationIds.push(duplicate.id);receipt.duplicateIds.push(duplicate.id);duplicates++;continue;}
      const rid=id();receipt.relationIds.push(rid);state.relations.push({...relation,id:rid,createdAt:stamp()});count++;
      addResult(person(relation.a),person(relation.b).name+'：'+labelFor(relation,relation.a),'人間関係');addResult(person(relation.b),person(relation.a).name+'：'+labelFor(relation,relation.b),'人間関係');
    }
    syncMemoCommunityMemberships(state);
  },{render:false});
  if(!saved){setModal(`<h2 id="modal-title">保存できませんでした</h2><p>入力と回答は残っています．空き容量などを確認して再試行してください．</p><div class="actions"><button class="btn subtle" data-action="organizer-back-input">入力に戻る</button><button class="btn" data-action="organizer-retry">再試行</button></div>`);return;}
  organizerUndo=snapshot;organizerPlan=null;quickDraft='';modal=null;render();
  organizerResult={...receipt,count,duplicates};showOrganizerResult();
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  if(b.dataset.action==='memo-input-help')setModal(`<h2 id="modal-title">名前の下に情報を並べる</h2><p>空行の後に名前を書くと，次の人へ切り替えます．「就職」「仕事」などの項目名は人物にしません．人物ページでは，名前を書かない情報は開いている人へ追加します．</p><pre class="preview-box">名前A
学生
バンドが好き

名前B
会社員
東京に住んでいる</pre><h3>関係とコミュニティも入力できます</h3><p>名前の下に「名前Bのかれし」「名前Bのかのじょ」で二人の関係を登録します．「会社の人」「高校の友達」「バイトの人」で所属を登録します．曖昧な相手や所属先だけ確認します．</p><h3>記号で確実に指定したいとき</h3><p>「名前A：」で人物を切り替え，その下に情報を書けます．「名前A：学生」と一行でも書けます．半角の : も使えます．</p><p>「：本文」は，別の人の名前が文中にあっても現在の人のメモとして保存します．名前を切り替えるまでは同じ人の情報です．</p><div class="actions"><button class="btn" data-action="organizer-back-input">入力に戻る</button></div>`);
  if(b.dataset.action==='organizer-answer'&&organizerPlan){try{resolveMemoIssue(organizerPlan,b.dataset.question,b.dataset.answer);await continueOrganizer();}catch(err){$('#organizer-error').textContent=err.message;}}
  if(b.dataset.action==='organizer-retry')await commitOrganizer();
  if(b.dataset.action==='organizer-undo'&&organizerUndo&&!working){const snapshot=organizerUndo;if(await mutate(()=>{state=structuredClone(snapshot);modal=null;})){organizerUndo=null;organizerResult=null;toast('今回の保存を取り消しました');}}
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='organizer-person-form')return;e.preventDefault();if(!organizerPlan)return;
  const q=organizerPlan.issues.find(q=>q.id===e.target.dataset.question),name=field(e.target,'name').value.trim();if(!name)return;
  const existing=state.people.filter(p=>[p.name,...p.aliases].some(a=>norm(a)===norm(name)));
  if(existing.length>1){$('#organizer-error').textContent='同じ呼び方の人物が複数います．上の保存先を選んでください．';return;}
  let t=organizerPlan.targets.find(t=>norm(t.name)===norm(name));if(!t){t={key:'manual-'+id(),name,personId:existing[0]?.id||null,aliases:[]};organizerPlan.targets.push(t);}
  for(const i of q.noteIndexes)organizerPlan.notes[i].targets=[t.key];q.resolved=true;await continueOrganizer();
});

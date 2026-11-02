/* このコードは，人物の表示順を保存し，人物ページを前後に切り替えます． */
'use strict';
let peopleReordering=false;
const personQuickDrafts=new Map();let generalQuickDraft='';
function resetPersonDrafts(){if(typeof organizerPersonView!=='undefined')organizerPersonView=null;if(typeof organizerResult!=='undefined')organizerResult=null;if(typeof resetGraphSession==='function')resetGraphSession();personQuickDrafts.clear();generalQuickDraft='';peopleReordering=false;}
function orderedPeople(data){const byId=new Map(data.people.map(p=>[p.id,p])),result=[];for(const pid of Array.isArray(data.personOrder)?data.personOrder:[]){if(byId.has(pid)){result.push(byId.get(pid));byId.delete(pid);}}return result.concat([...byId.values()].sort((a,b)=>a.name.localeCompare(b.name,'ja')));}
function filteredPeople(data,search='',group='all'){return orderedPeople(data).filter(p=>norm([p.name,...p.aliases].join('')).includes(norm(search))&&communityMatches(p,data.communities,group));}
function movePersonOrder(data,pid,direction,visibleIds){const order=orderedPeople(data).map(p=>p.id),visible=visibleIds.filter(id=>order.includes(id)),index=visible.indexOf(pid),other=visible[index+direction];if(!other)return false;const a=order.indexOf(pid),b=order.indexOf(other);[order[a],order[b]]=[order[b],order[a]];data.personOrder=order;return true;}
function personSequence(){const visible=filteredPeople(state,filter,communityFilter);return visible.some(p=>p.id===selected)?visible:orderedPeople(state);}
function personPager(){const people=personSequence(),index=people.findIndex(p=>p.id===selected),prev=people[index-1],next=people[index+1];return `<nav class="person-pager" aria-label="人物の切り替え"><button class="btn subtle" data-action="person-prev" ${prev?'':'disabled'} aria-label="前の人物"><span>← 前の人</span><b>${escapeHtml(prev?.name||'先頭です')}</b></button><span>${index+1} / ${people.length}</span><button class="btn subtle" data-action="person-next" ${next?'':'disabled'} aria-label="次の人物"><span>次の人 →</span><b>${escapeHtml(next?.name||'最後です')}</b></button></nav>`;}
function switchPerson(pid){if(!person(pid))return;if(page==='detail')personQuickDrafts.set(selected,quickDraft);else generalQuickDraft=quickDraft;quickDraft=personQuickDrafts.get(pid)||'';selected=pid;page='detail';modal=null;render();scrollTo(0,0);}
function leavePersonDetail(){if(page==='detail'){personQuickDrafts.set(selected,quickDraft);quickDraft=generalQuickDraft;}}
if(typeof document!=='undefined')document.addEventListener('click',async e=>{const button=e.target.closest('[data-action]');if(!button||working)return;const action=button.dataset.action;
  if(action==='people-reorder'){peopleReordering=!peopleReordering;render();}
  if(action==='person-prev'||action==='person-next'){const people=personSequence(),index=people.findIndex(p=>p.id===selected),next=people[index+(action==='person-next'?1:-1)];if(next)switchPerson(next.id);}
  if(action==='person-up'||action==='person-down'){await mutate(()=>movePersonOrder(state,button.dataset.id,action==='person-up'?-1:1,filteredPeople(state,filter,communityFilter).map(p=>p.id)));}
});
if(typeof module!=='undefined')module.exports={orderedPeople,movePersonOrder};

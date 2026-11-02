/* このコードは，関係選択肢のA・Bを実際の人物名で表示します． */
'use strict';
function reverseRelationType(type){return ({girlfriend:'boyfriend',boyfriend:'girlfriend',boss:'subordinate',subordinate:'boss',parent:'child',child:'parent'}[type]||type);}
function namedRelationLabel(type,a,b){
  const directed={girlfriend:'彼女',boyfriend:'彼氏',boss:'上司',subordinate:'部下',parent:'親',child:'子'};
  if(directed[type])return `${a}は${b}の${directed[type]}`;
  return `${a}と${b}は${({friend:'友人',colleague:'同僚',partner:'恋人',sibling:'きょうだい',spouse:'夫婦・配偶者',unitmate:'ユニット仲間',collab:'コラボ相手',contemporary:'同期'}[type]||'友人')}`;
}
function relationshipPeople(raw){const value=norm(raw),exact=state.people.filter(p=>norm(p.name)===value);return exact.length?exact:state.people.filter(p=>p.aliases.some(alias=>norm(alias)===value));}
function relationshipInputError(message){const error=document.querySelector('#relation-error');if(error)error.textContent=message;toast(message);}
function refreshRelationNames(){const form=document.querySelector('#relation-form');if(!form)return;const a=person(selected)?.name||'この人物',raw=field(form,'other').value.trim(),candidates=relationshipPeople(raw),found=candidates.length===1?candidates[0]:null,b=found?.name||raw||'相手の名前';
  const error=document.querySelector('#relation-error');if(error)error.textContent=candidates.length>1?'同じ呼び方の人が複数います．名前を選び直してください．':'';
  const select=field(form,'type');for(const option of select.options)option.textContent=namedRelationLabel(option.value,a,b);
  const description=document.querySelector('#relation-description');if(description)description.textContent=namedRelationLabel(select.value,a,b);
}
if(typeof document!=='undefined'){
  document.addEventListener('input',e=>{if(e.target.closest('#relation-form'))refreshRelationNames();});
  document.addEventListener('change',e=>{if(e.target.closest('#relation-form'))refreshRelationNames();});
}
if(typeof module!=='undefined')module.exports={reverseRelationType,namedRelationLabel};

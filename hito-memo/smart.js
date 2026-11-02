/* このコードは，長文の主語・人物・項目を端末内で整理し，曖昧な部分だけ質問候補にします． */
'use strict';
const memoNorm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/\s/g,'');
const memoBase=s=>s.trim().replace(/(?:ちゃん|さん)$/,'');
function memoCategory(text){
  if(typeof canonicalMemoInfo==='function'){const info=canonicalMemoInfo(text);if(info.key)return info.category;}
  if(/誕生日|生年月日|生まれ/.test(text))return '誕生日';
  if(/歳|同い年|年齢|年は|年上|年下/.test(text))return '年齢';
  if(/(?:付き合|つきあ|交際|彼女|かのじょ|彼氏|恋人|友達|友人|さいごまで|アピール|あぴーる)/.test(text))return '人間関係・交際';
  if(/回生|学年|学生|学校|大学/.test(text))return /就職/.test(text)?'学業・就職':'学業';
  if(/社会人|教諭|インターン|仕事|職場|就職|会社|職業|勤務/.test(text))return '仕事';
  if(/ついて|引っ越|引越|転居/.test(text))return '住まい・将来';
  if(/大阪|おおさか|岡山|島根|東京|出身|住んで|北長瀬|きたながせ/.test(text))return '場所';
  if(/バンド|趣味|好き|嫌い|苦手/.test(text))return '趣味・活動';
  if(/かげつ|ヶ月|か月|ヵ月|ケ月/.test(text))return '期間（意味未確認）';
  return 'その他';
}
function analyzeMemo(raw,people,defaultId=null,communities=[]){
  const plan={raw,targets:[],notes:[],relations:[],issues:[],aliases:[]};let serial=0;
  const issue=(kind,prompt,excerpt,choices,extra={})=>{const q={id:'q'+serial++,kind,prompt,excerpt,choices,resolved:false,...extra};plan.issues.push(q);return q;};
  function target(name){
    name=name.trim();const base=memoBase(name);
    let found=plan.targets.find(t=>[t.name,...t.aliases].some(a=>memoNorm(a)===memoNorm(name)||memoNorm(a)===memoNorm(base)));
    if(found)return found;
    const candidates=people.filter(p=>[p.name,...p.aliases].some(a=>memoNorm(a)===memoNorm(name)||memoNorm(a)===memoNorm(base)));
    if(candidates.length===1){const existing=plan.targets.find(t=>t.personId===candidates[0].id&&!t.mergedInto);if(existing)return existing;}
    found={key:'t'+serial++,name:candidates.length===1?candidates[0].name:base,personId:candidates.length===1?candidates[0].id:null,aliases:[],candidates:candidates.map(p=>p.id)};
    if(name!==found.name&&!candidates.length)found.aliases.push(name);
    plan.targets.push(found);
    if(candidates.length>1)issue('identity-pick',`「${name}」はどの人物ですか？`,name,candidates.map(p=>({value:p.id,label:p.name})),{target:found.key});
    return found;
  }
  const generic={test:name=>isNonPersonMemoName(memoBase(name))};
  function subject(line,allowUnknown=false){
    const topic=line.match(/^([\p{L}ー・]{1,20}?)(?:は|が)(.+)$/u);if(topic&&generic.test(topic[1]))return null;
    if(generic.test(line))return null;
    const names=[...people.flatMap(p=>[p.name,...p.aliases]),...plan.targets.flatMap(t=>[t.name,...t.aliases])].filter(Boolean).sort((a,b)=>b.length-a.length);
    for(const name of names){if(line.startsWith(name)){const rest=line.slice(name.length);if(!rest||/^(?:ちゃん|さん)?(?:は|が|って|社会人|学生|\s)/.test(rest))return {name,body:rest.replace(/^(?:ちゃん|さん)/,'').replace(/^(?:は|が|って)/,'').trim(),bare:!rest};}}
    const honor=line.match(/^([\p{L}ー・]{1,12}?(?:ちゃん|さん))(.*)$/u);
    if(honor&&!generic.test(memoBase(honor[1])))return {name:honor[1],body:honor[2].replace(/^(?:は|が|って)/,'').trim(),bare:!honor[2]};
    const plain=line.match(/^([\p{L}ー・]{1,12}?)(?:は|が)(.+)$/u);
    if(!defaultId&&allowUnknown&&plain&&!generic.test(plain[1]))return {name:plain[1],body:plain[2].trim(),bare:false};
    return null;
  }
  const blocks=splitMemoBlocks(raw,people,defaultId);
  for(const block of blocks){
    const primary=block.name?target(block.name):defaultId?target(people.find(p=>p.id===defaultId)?.name||''):null;
    let possible=null,contextNotes=[];
    function finishContext(){if(possible&&contextNotes.length&&possible.key!==primary?.key)issue('subject',`名前のない次の行は，誰の情報ですか？`,contextNotes.map(i=>plan.notes[i].text).join('\n'),[{value:primary.key,label:primary.name},{value:possible.key,label:possible.name},{value:'both',label:'両方に関するメモ'}],{noteIndexes:contextNotes,primary:primary.key,other:possible.key});contextNotes=[];}
    const prepared=[];
    for(const [lineIndex,original] of block.lines.entries()){
      if(block.forcedLineIndexes?.includes(lineIndex)){prepared.push({text:original,forced:true});continue;}
      // Split clauses only when punctuation is followed by an identifiable subject.
      const pieces=original.split(/[。；;／]|[、，,](?=[\p{L}ー・]{1,12}(?:は|が))/u).map(s=>s.trim()).filter(Boolean);
      if(pieces.length>1&&pieces.slice(1).every(s=>subject(s,!primary)))prepared.push(...pieces.map(text=>({text,forced:false})));
      else prepared.push({text:original,forced:false});
    }
    for(const entry of prepared){
      const line=entry.text,hit=entry.forced?null:subject(line,!primary);let owner=primary;
      if(hit){
        owner=target(hit.name);
        if(hit.bare&&primary&&owner.key!==primary.key){
          finishContext();possible=owner;
          if(!plan.issues.some(q=>q.kind==='alias'&&q.primary===primary.key&&q.other===owner.key))issue('alias',`「${hit.name}」は「${primary.name}」の別名ですか？`,block.lines.join('\n'),[{value:'same',label:'同じ人（あだ名・別名）'},{value:'separate',label:'別の人'}],{primary:primary.key,other:owner.key,alias:hit.name});
          continue;
        }
      }
      const body=(hit?.body||line).trim();
      // A named block supplies the subject for short relationship and membership lines.
      const community=body.match(/^(?:コミュニティ|所属)[:：]\s*(.{1,80})$/)||body.match(/^(.{1,80}?)の(?:人|ひと|友達|友だち|友人|仲間|同僚|メンバー)(?:です|だ|やって)?[．。]?$/);
      const path=gid=>{const parts=[],seen=new Set();let g=communities.find(g=>g.id===gid);while(g&&!seen.has(g.id)){seen.add(g.id);parts.unshift(g.name);g=communities.find(parent=>parent.id===g.parentId);}return parts.join('の');};
      const groupNorm=s=>memoNorm(s).replace(/アルバイト/g,'バイト').replace(/[›＞>/]/g,'の');
      const groupMatches=community?communities.filter(g=>groupNorm(g.name)===groupNorm(community[1])||groupNorm(path(g.id))===groupNorm(community[1])):[];
      const membership=community&&(groupMatches.length||/の(?:人|ひと|メンバー)/.test(body)||/^(コミュニティ|所属)[:：]/.test(body)||/^(会社|バイト|アルバイト|高校|中学|大学|友達)$/.test(community[1]));
      if(owner&&membership){const index=plan.notes.push({targets:[owner.key],text:line,category:'コミュニティ',source:raw,communityName:community[1].trim(),communityId:groupMatches.length===1?groupMatches[0].id:null})-1;if(possible&&!hit&&!entry.forced)contextNotes.push(index);if(groupMatches.length>1)issue('community-pick','どのコミュニティですか？',line,groupMatches.map(g=>({value:g.id,label:path(g.id)})),{noteIndexes:[index]});continue;}
      const relation=body.match(/^(.{1,30}?)の(彼女|かのじょ|彼氏|かれし|恋人|こいびと|友達|友だち|友人|同僚|どうりょう|上司|じょうし|部下|ぶか|親|おや|子|子供|子ども|こども|兄|弟|姉|妹|きょうだい|兄弟|姉妹|夫|妻|配偶者|同期|ユニット仲間|コラボ相手)(?:です|だ|やって|らしい)?[．。]?$/);
      if(owner&&!possible&&relation&&!generic.test(memoBase(relation[1]))){const other=target(relation[1]);const types={彼女:'girlfriend',かのじょ:'girlfriend',彼氏:'boyfriend',かれし:'boyfriend',恋人:'partner',こいびと:'partner',友達:'friend',友だち:'friend',友人:'friend',同僚:'colleague',どうりょう:'colleague',上司:'boss',じょうし:'boss',部下:'subordinate',ぶか:'subordinate',親:'parent',おや:'parent',子:'child',子供:'child',子ども:'child',こども:'child',兄:'sibling',弟:'sibling',姉:'sibling',妹:'sibling',きょうだい:'sibling',兄弟:'sibling',姉妹:'sibling',夫:'spouse',妻:'spouse',配偶者:'spouse',同期:'contemporary',ユニット仲間:'unitmate',コラボ相手:'collab'};if(owner.key!==other.key){plan.relations.push({a:owner.key,b:other.key,type:types[relation[2]],source:raw});continue;}}

      let category=memoCategory(line);
      const previous=plan.notes.at(-1);
      if(/^(?:うそ|嘘|訂正|いや|やっぱ)/.test(line)&&previous&&previous.targets.includes(owner?.key)){
        category=previous.category;
        if(/回/.test(line)&&category==='人間関係・交際'){category='交際回数';previous.category=category;}
      }
      const note={targets:owner?[owner.key]:[],text:line,category,source:raw};const index=plan.notes.push(note)-1;
      if(!owner){
        const q=plan.issues.find(q=>q.kind==='subject-pick'&&q.block===block);
        if(q){q.noteIndexes.push(index);q.excerpt+='\n'+line;}
        else issue('subject-pick','この部分は誰の情報ですか？',line,people.map(p=>({value:p.id,label:p.name})),{noteIndexes:[index],block});
      }
      if(!hit&&!entry.forced&&possible)contextNotes.push(index);
      if(note.category==='期間（意味未確認）')issue('category','この期間は何の期間ですか？',line,[{value:'人間関係・交際',label:'交際している期間'},{value:'知り合ってからの期間',label:'知り合ってからの期間'},{value:'期間',label:'意味は未確定のまま残す'}],{noteIndexes:[index]});
    }
    finishContext();
  }
  return plan;
}
function resolveMemoIssue(plan,id,value){
  const q=plan.issues.find(q=>q.id===id);if(!q||q.resolved||!q.choices.some(c=>c.value===value))throw Error('質問の回答を確認してください');
  const get=k=>plan.targets.find(t=>t.key===k);
  if(q.kind==='alias'&&value==='same'){
    const a=get(q.primary),b=get(q.other);
    if(a.personId&&b.personId&&a.personId!==b.personId)throw Error('別々に登録済みの人物です．人物の統合は自動では行えません');
    if(!a.personId&&b.personId){a.personId=b.personId;a.aliases.push(a.name);a.name=b.name;}
    a.aliases=[...new Set([...a.aliases,b.name,...b.aliases,q.alias])].filter(n=>memoNorm(n)!==memoNorm(a.name));
    b.mergedInto=a.key;
    for(const n of plan.notes)n.targets=[...new Set(n.targets.map(k=>k===b.key?a.key:k))];
    for(const r of plan.relations){if(r.a===b.key)r.a=a.key;if(r.b===b.key)r.b=a.key;}
    for(const other of plan.issues)if(other.kind==='subject'&&other.primary===a.key&&other.other===b.key)other.resolved=true;
  }else if(q.kind==='identity-pick'){get(q.target).personId=value;}
  else if(q.kind==='community-pick'){for(const i of q.noteIndexes)plan.notes[i].communityId=value;}
  else if(q.kind==='category'){for(const i of q.noteIndexes)plan.notes[i].category=value;}
  else if(q.kind==='subject'){for(const i of q.noteIndexes)plan.notes[i].targets=value==='both'?[q.primary,q.other]:[value];}
  else if(q.kind==='subject-pick'){
    let t=plan.targets.find(t=>t.personId===value);if(!t){t={key:'chosen-'+value,name:q.choices.find(c=>c.value===value).label,personId:value,aliases:[]};plan.targets.push(t);}
    for(const i of q.noteIndexes)plan.notes[i].targets=[t.key];
  }
  q.resolved=true;
}
if(typeof module!=='undefined')module.exports={memoCategory,analyzeMemo,resolveMemoIssue};

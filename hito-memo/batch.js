/* このコードは，名前見出し付きの複数行メモを端末内で分割します．本文の意味や人間関係は推測しません． */
'use strict';
function isNonPersonMemoName(name){if(typeof canonicalMemoInfo==='function'&&canonicalMemoInfo(name).key)return true;return /^(?:年|年齢|年次|入社年|性別|男性|女性|役職|部署|職業|居住地|場所|学年|仕事|理由|誕生日|彼女|彼氏|友達|自分|今日|昨日|明日|学生|社会人|同い年|趣味|会社|親|子|就職|進路|転職|勤務|職場|バイト|アルバイト|学校|大学|大学院|高校|中学|小学校|出身|住所|地元|住まい|性格|恋愛|交際|関係|家族|兄弟|姉妹|結婚|資格|免許|卒業|インターン|予定|年収|給料|収入|身長|体重|健康|食事|好み|好き|嫌い|その他|メモ|情報|名前|あだ名|備考|サークル|部活|所属|コミュニティ|概要|プロフィール|要約|まとめ|バンド|映画|音楽|食べ物|料理|旅行|運転|ゲーム|スポーツ|お酒|コーヒー)$/u.test(String(name).trim())||/^(?:就職|進路|仕事|勤務|学校|大学|学年|年齢|性格|恋愛|交際|趣味|資格|職場|バイト)(?:先|時期|予定|活動|について|の話|のこと|関係|場所)$/.test(String(name).trim());}
function splitMemoBlocks(raw, people, defaultPersonId=null) {
  const normalize=s=>String(s).normalize('NFKC').toLowerCase().replace(/\s/g,'');
  const exact=name=>people.filter(p=>[p.name,...p.aliases].some(a=>normalize(a)===normalize(name)));
  const lines=raw.replace(/\r\n?/g,'\n').split('\n');
  const blocks=[];let current=null,afterBlank=true,blankCount=0;
  function addLine(text,forced=false){if(!current){current={name:'',personId:defaultPersonId||'',candidates:[],lines:[],forcedLineIndexes:[]};blocks.push(current);}if(forced)current.forcedLineIndexes.push(current.lines.length);current.lines.push(text);}
  function heading(line){
    const explicit=line.match(/^(?:【(.{1,80})】|\[(.{1,80})\])$/);
    if(explicit){const name=(explicit[1]||explicit[2]).trim();return isNonPersonMemoName(name)?null:{name,body:''};}
    const colon=line.match(/^([^:：]{1,80})[:：](.*)$/);
    if(colon&&!colon[2].trim().startsWith('//')&&(exact(colon[1].trim()).length||/^[\p{L}ー・\s]{1,80}$/u.test(colon[1]))&&!isNonPersonMemoName(colon[1]))return {name:colon[1].trim(),body:colon[2].trim()};
    if(isNonPersonMemoName(line))return null;
    if(afterBlank&&exact(line).length)return {name:line,body:''};
    // A real empty line strongly marks the next short name, including in a person page.
    if(afterBlank&&(!defaultPersonId||blankCount>=1)&&/^[\p{L}ー・]{1,12}$/u.test(line)&&!/(歳|かげつ|ヶ月|学生|社会人|同い年|教諭|インターン|誕生日|職場|就職|友達|彼女|彼氏|つきあ|して|です|ある|ない|いる|いく)/.test(line))return {name:line,body:''};
    return null;
  }
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();if(!line){afterBlank=true;blankCount++;continue;}
    const forced=line.match(/^[:：]\s*(.*)$/),h=forced?null:heading(line),hasFollowing=lines.slice(i+1).some(s=>s.trim());
    if(h&&(h.body||hasFollowing)){
      const candidates=exact(h.name);current={name:h.name,personId:candidates.length===1?candidates[0].id:'',candidates:candidates.map(p=>p.id),lines:[],forcedLineIndexes:[]};blocks.push(current);
      if(h.body)addLine(h.body,true);
    }else if(forced){if(forced[1].trim())addLine(forced[1].trim(),true);}
    else addLine(line);
    afterBlank=false;blankCount=0;
  }
  return blocks.filter(b=>b.lines.length).map(b=>({...b,text:b.lines.join('\n')}));
}
if(typeof module!=='undefined')module.exports={splitMemoBlocks,isNonPersonMemoName};

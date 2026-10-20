(function(root){
'use strict';
// Read cached OOXML values only. This reader never evaluates or exports formulas.
const decode=s=>String(s||'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v)=>v[0]==='#'?String.fromCodePoint(v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):Number(v.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[v.toLowerCase()]);
function tags(xml,name){const re=new RegExp('<(?:[\\w.-]+:)?'+name+'\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?'+name+'\\s*>)','g'),out=[];let m;while((m=re.exec(xml)))out.push({attrs:m[1],body:m[2]||''});return out;}
function attrs(s){const out={};for(const m of s.matchAll(/([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g))out[m[1]]=decode(m[3]);return out;}
const text=xml=>tags(xml.replace(/<(?:[\w.-]+:)?rPh\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?rPh\s*>/g,''),'t').map(t=>decode(t.body)).join('');
function column(s){if(!/^[A-Z]{1,3}$/i.test(s||''))throw Error('列はA，B，AAのように指定してください．');return [...s.toUpperCase()].reduce((v,c)=>v*26+c.charCodeAt(0)-64,0);}
function columnName(n){let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
function parseSheet(xml,strings,name){
 const cells=new Map();let maxRow=0,maxCol=0;
 for(const c of tags(xml,'c')){const a=attrs(c.attrs),m=/^([A-Z]+)(\d+)$/.exec(a.r||'');if(!m)continue;const row=Number(m[2]),col=column(m[1]);if(row>1048576||col>16384)throw Error('セルの位置が不正です．');
  const v=tags(c.body,'v')[0],hasFormula=tags(c.body,'f').length>0;let value=null;
  if(a.t==='inlineStr')value=text(c.body);else if(v){const raw=decode(v.body);if(a.t==='s')value=strings[Number(raw)]??null;else if(a.t==='str'||a.t==='d'||a.t==='e')value=raw;else if(a.t==='b')value=raw==='1';else value=raw.trim()===''?null:Number(raw);}
  cells.set(a.r,{value,missing:hasFormula&&(value===null||value===''),error:a.t==='e'});maxRow=Math.max(maxRow,row);maxCol=Math.max(maxCol,col);
 }
 return {name,maxRow,maxCol,cells};
}
const crcTable=Array.from({length:256},(_,i)=>{for(let k=0;k<8;k++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
function crc32(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
async function unzip(buffer){
 const bytes=new Uint8Array(buffer),v=new DataView(buffer);if(bytes.length>25*1024*1024)throw Error('Excelは25MB以下で選んでください．');let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){end=i;break;}
 if(end<0)throw Error('通常の.xlsxファイルを選んでください．暗号化・旧.xls形式には対応していません．');
 const count=v.getUint16(end+10,true),offset=v.getUint32(end+16,true);if(count>4000||count===65535)throw Error('このExcelの圧縮形式には対応していません．');const files=new Map(),decoder=new TextDecoder();let at=offset,total=0;
 for(let k=0;k<count;k++){
  if(at+46>bytes.length||v.getUint32(at,true)!==0x02014b50)throw Error('Excelの圧縮データが壊れています．');
  const flags=v.getUint16(at+8,true),method=v.getUint16(at+10,true),crc=v.getUint32(at+16,true),size=v.getUint32(at+20,true),expanded=v.getUint32(at+24,true),nl=v.getUint16(at+28,true),el=v.getUint16(at+30,true),cl=v.getUint16(at+32,true),local=v.getUint32(at+42,true),name=decoder.decode(bytes.slice(at+46,at+46+nl));at+=46+nl+el+cl;
  if(flags&1)throw Error('パスワード付きExcelには対応していません．');if(expanded>32*1024*1024)throw Error('展開後のシートが大きすぎます．');
  if(local+30>bytes.length||v.getUint32(local,true)!==0x04034b50)throw Error('Excelのファイル位置が不正です．');
  const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);if(start+size>bytes.length)throw Error('Excelのデータが途中で切れています．');
  if(!/\.xml$|\.rels$/i.test(name))continue;let data;
  if(method===0)data=bytes.slice(start,start+size);
  else if(method===8){
   let stream;try{stream=new Blob([bytes.slice(start,start+size)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch{throw Error('このブラウザではExcelの展開ができません．新しいSafari・Chrome・Braveをお使いください．');}
   const reader=stream.getReader(),parts=[];let length=0;for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>32*1024*1024){await reader.cancel();throw Error('展開後のシートが大きすぎます．');}parts.push(r.value);}data=new Uint8Array(length);let pos=0;for(const part of parts){data.set(part,pos);pos+=part.length;}
  }else throw Error('未対応のExcel圧縮形式です．');
  total+=data.length;if(total>80*1024*1024)throw Error('展開後のExcelが大きすぎます．');if(data.length!==expanded||crc32(data)!==crc)throw Error('Excelのデータ検査に失敗しました．保存し直して選んでください．');
  const xml=decoder.decode(data);if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('このXML形式には対応していません．');files.set(name,xml);
 }
 return files;
}
async function read(buffer){
 const files=await unzip(buffer),book=files.get('xl/workbook.xml'),rels=files.get('xl/_rels/workbook.xml.rels');if(!book||!rels)throw Error('Excelのシート情報が見つかりません．');
 const relations=new Map(tags(rels,'Relationship').map(x=>attrs(x.attrs)).filter(a=>a.TargetMode!=='External').map(a=>[a.Id,a.Target]));
 const strings=tags(files.get('xl/sharedStrings.xml')||'','si').map(x=>text(x.body)),sheets=[];
 for(const s of tags(book,'sheet')){const a=attrs(s.attrs),target=relations.get(a['r:id']);if(!target)continue;const parts=(target.startsWith('/')?target.slice(1):'xl/'+target).split('/'),safe=[];for(const p of parts){if(p==='..')safe.pop();else if(p!=='.'&&p)safe.push(p);}const xml=files.get(safe.join('/'));if(xml)sheets.push(parseSheet(xml,strings,a.name));}
 if(!sheets.length)throw Error('読み込めるシートがありません．');return {sheets,date1904:attrs(tags(book,'workbookPr')[0]?.attrs||'').date1904==='1'};
}
const api={read,parseSheet,column,columnName};root.LocalXlsx=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

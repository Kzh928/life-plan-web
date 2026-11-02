import { z } from "zod";
export const fieldSchema = z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(80),type:z.enum(["text","number","check","select"]),options:z.array(z.string().max(80)).max(50).default([])});
export const accountFieldSchema = fieldSchema.extend({type:z.enum(["text","number","check","select","date","timestamp","points"])});
export const notebookSchema = z.object({layoutVersion:z.number().int().optional(),fields:z.array(accountFieldSchema).max(50),records:z.array(z.object({name:z.string().trim().min(1).max(100),values:z.record(z.string(),z.union([z.string().max(2000),z.number().finite(),z.boolean()])),updatedAt:z.number()})).max(1000)}).refine(n=>new Set(n.fields.map(f=>f.id)).size===n.fields.length&&new Set(n.records.map(r=>r.name)).size===n.records.length);
export type Notebook=z.infer<typeof notebookSchema>;
export type AccountField=z.infer<typeof accountFieldSchema>;
export const settingsSchema = z.object({
 notebook:notebookSchema.optional(),
 accounts:z.array(z.string().trim().min(1).max(100)).max(500),
 fields:z.array(fieldSchema).max(50),
 cards:z.array(z.object({name:z.string().trim().min(1).max(100),watched:z.boolean(),note:z.string().max(4000),values:z.record(z.string(),z.union([z.string().max(2000),z.number().finite(),z.boolean()]))})).max(3000)
}).refine(s=>new Set(s.cards.map(c=>c.name)).size===s.cards.length&&new Set(s.fields.map(f=>f.id)).size===s.fields.length&&new Set(s.accounts).size===s.accounts.length,"名前が重複しています");
export type Settings = z.infer<typeof settingsSchema>;
export type Field = z.infer<typeof fieldSchema>;
export type CardMeta = Settings["cards"][number];
export type Item = {id:string;name:string;secondaryName:string;count:number;memo:string;confirmed:boolean;position:number;createdAt:number};
export const emptySettings:Settings={accounts:[],fields:[],cards:[]};

// The built-in return field is available to existing accounts without changing their values.
export function withReturnField(notebook:Notebook):Notebook{
 const existing=notebook.fields.find(f=>f.id==='account-return-at'||f.name==='復帰');
 if(existing)return {...notebook,fields:notebook.fields.map(f=>f.id===existing.id?{...f,type:'timestamp' as const}:f)};
 return {...notebook,fields:[...notebook.fields,{id:'account-return-at',name:'復帰',type:'timestamp',options:[]}]};
}
export function accountFieldValue(field:AccountField,value:unknown):string{
 if(value===undefined||value==='')return '未入力';
 if(field.type==='points')return packPointSummary(value);
 if(field.type==='timestamp'){
  const date=new Date(String(value));
  if(Number.isFinite(date.getTime()))return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);
 }
 return String(value);
}

export function isGoldFrameField(field:AccountField):boolean{return field.id==='account-gold-frames'||field.name==='金フレーム'}
export const goldManualKey=(field:AccountField)=>`gold-manual:${field.id}`;
export function goldAutomaticEntries(items:Item[],name:string){return Array.from(new Set(items.filter(i=>i.count===12&&i.confirmed&&i.secondaryName===name).map(i=>`${i.name}2`)))}
// Keep manual additions separate from the generated entries.
export function withGoldFrames(notebook:Notebook,items:Item[]):Notebook{
 const found=notebook.fields.find(isGoldFrameField);
 const field:AccountField=found?{...found,type:'text'}:{id:'account-gold-frames',name:'金フレーム',type:'text',options:[]};
 const groups=new Map<string,Set<string>>();
 for(const item of items){
  if(item.count!==12||!item.confirmed||!item.secondaryName.trim())continue;
  const values=groups.get(item.secondaryName)??new Set<string>();values.add(`${item.name}2`);groups.set(item.secondaryName,values);
 }
 const names=Array.from(new Set([...notebook.records.map(r=>r.name),...groups.keys()]));
 return {...notebook,fields:found?notebook.fields.map(f=>f.id===field.id?field:f):[...notebook.fields,field],records:names.map(name=>{
  const record=notebook.records.find(r=>r.name===name)??{name,values:{},updatedAt:0};
  const values={...record.values};const entries=groups.get(name)??new Set<string>();const key=goldManualKey(field);
  const manual=values[key]===undefined?String(values[field.id]??'').split(/[、，,\n]+/).map(s=>s.trim()).filter(s=>s&&!entries.has(s)).join('、'):String(values[key]);
  values[key]=manual;values[field.id]=Array.from(new Set([...entries,...manual.split(/[、，,\n]+/).map(s=>s.trim()).filter(Boolean)])).join('、');
  return {...record,values};
 })};
}

// One entry per expansion (pack artwork variants share a balance).
export const pointPacks = [
 ['C1','デュアルフュージョン'],['B4b','ハイクラスパック MEGA'],['B4a','ロケット団の野望'],['B4','天空の支配者'],['B3b','ミラクルデイズ'],['B3a','進撃パラドックス'],['B3','波動ビート'],['B2b','シャイニングメガ'],['B2a','パルデアワンダー'],['B2','夢幻パレード'],['B1a','紅蓮ブレイズ'],['B1','メガライジング'],['A4b','ハイクラスパックex'],['A4a','未知なる水域'],['A4','空と海の導き'],['A3b','イーブイガーデン'],['A3a','異次元クライシス'],['A3','双天の守護者'],['A2b','シャイニングハイ'],['A2a','超克の光'],['A2','時空の激闘'],['A1a','幻のいる島'],['A1','最強の遺伝子']
] as const;
export function readPackPoints(value:unknown):Record<string,number>{
 try{const raw=JSON.parse(String(value??'{}'));if(!raw||Array.isArray(raw)||typeof raw!=='object')return {};return Object.fromEntries(Object.entries(raw).filter(([id,v])=>pointPacks.some(p=>p[0]===id)&&typeof v==='number'&&Number.isSafeInteger(v)&&v>=0)) as Record<string,number>}catch{return {}}
}
export function sortedPointPacks(value:unknown){const values=readPackPoints(value);return [...pointPacks].sort((a,b)=>Number(values[b[0]]!==undefined)-Number(values[a[0]]!==undefined))}
export function packPointSummary(value:unknown){const values=readPackPoints(value);return sortedPointPacks(value).filter(p=>values[p[0]]!==undefined).map(([id,name])=>`${name}：${values[id]}`).join('\n')||'未入力'}
export function withAccountFeatures(notebook:Notebook):Notebook{
 const fields=[...((notebook.layoutVersion??0)>=1?notebook.fields:notebook.fields.filter(f=>!['ハード','エキスパート'].includes(f.name)))];
 if((notebook.layoutVersion??0)<2){for(const [id,name] of [['account-crown','クラウン'],['account-immersive','イマーシブ']]){if(!fields.some(f=>f.id===id||f.name===name))fields.push({id,name,type:'text',options:[]})}}
 if((notebook.layoutVersion??0)<3){
  const names=['メール','コード','🌈','トレーナー','星2','色違い','⭐️⭐️','クラウン','イマーシブ','以外','ひかりのすな','砂時計','日数','金フレーム','ポイント','復帰','コンプ'];
  const canonical=(name:string)=>name.replace(/\uFE0F/g,'');
  const retained=fields.filter(f=>!['日数メモ','日付'].includes(f.name));
  const ordered:AccountField[]=names.map((name,index)=>{
   const existing=retained.find(f=>canonical(f.name)===canonical(name));if(existing)return {...existing,name};
   const id=name==='金フレーム'?'account-gold-frames':name==='ポイント'?'account-pack-points':name==='復帰'?'account-return-at':`account-field-v3-${index}`;
   return {id,name,type:name==='復帰'?'timestamp':name==='ポイント'?'points':['ひかりのすな','砂時計','日数'].includes(name)?'number':'text',options:[]};
  });
  fields.splice(0,fields.length,...ordered,...retained.filter(f=>!names.some(name=>canonical(name)===canonical(f.name))));
 }
 let records=notebook.records;
 if((notebook.layoutVersion??0)<4){
  const star=fields.find(f=>f.name==='星2'),rainbow=fields.find(f=>f.name==='🌈');
  if(star&&rainbow){const parts=(value:unknown)=>String(value??'').split(/[、，,\n\r]+/).map(s=>s.trim()).filter(Boolean);
   records=records.map(record=>{const original=parts(record.values[star.id]),moved=original.filter(name=>name.includes('🌈'));if(!moved.length)return record;
    const remaining=original.filter(name=>!name.includes('🌈'));const combined=Array.from(new Set([...parts(record.values[rainbow.id]),...moved])).join('、');
    // Never truncate an existing memo if the destination exceeds the field limit.
    if(combined.length>2000)return record;
    return {...record,values:{...record.values,[star.id]:remaining.join('、'),[rainbow.id]:combined},updatedAt:Date.now()};
   });
  }
 }
 if((notebook.layoutVersion??0)<5){
  const existing=fields.find(f=>f.name.replace(/\uFE0F/g,'')==='⭐');
  const star:AccountField=existing??{id:'account-one-star',name:'⭐️',type:'text',options:[]};
  if(existing)fields.splice(fields.indexOf(existing),1);
  const immersive=fields.findIndex(f=>f.name==='イマーシブ');fields.splice(immersive<0?fields.length:immersive+1,0,star);
 }
 const found=fields.find(f=>f.id==='account-pack-points'||f.name==='ポイント');
 return {...notebook,records,layoutVersion:Math.max(5,notebook.layoutVersion??0),fields:found?fields.map(f=>f.id===found.id?{...f,type:'points' as const}:f):[...fields,{id:'account-pack-points',name:'ポイント',type:'points',options:[]}]};
}

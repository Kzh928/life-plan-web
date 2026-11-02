import {z} from 'zod';
import {settingsSchema,emptySettings,withAccountFeatures,withReturnField,withGoldFrames} from '../lib/collection';
export const itemSchema=z.object({id:z.string().min(1).max(200),name:z.string().trim().min(1).max(100),secondaryName:z.string().max(100),count:z.number().int().min(0).max(12),memo:z.string().max(2000),confirmed:z.boolean(),position:z.number().finite(),createdAt:z.number().finite()}).refine(i=>!i.confirmed||i.count===12,'確定済みの枚数が不正です');
export const bundleSchema=z.object({settings:settingsSchema,items:z.array(itemSchema).max(20000),revision:z.number().int().min(0)}).refine(b=>new Set(b.items.map(i=>i.id)).size===b.items.length,'記録IDが重複しています');
export type Bundle=z.infer<typeof bundleSchema>;
export const emptyBundle=():Bundle=>({settings:structuredClone(emptySettings),items:[],revision:0});
export const preferenceKeys=['pokepoke-account-view'];
export function preferences(){return Object.fromEntries(Object.keys(localStorage).filter(k=>preferenceKeys.includes(k)||k.startsWith('pokepoke-input-draft:')).map(k=>[k,localStorage.getItem(k)!]))}
export function normalize(b:Bundle):Bundle{return {...b,settings:{...b.settings,...(b.settings.notebook?{notebook:withGoldFrames(withReturnField(withAccountFeatures(b.settings.notebook)),b.items)}:{})}}}
export function validateBackup(raw:unknown){
 const data=z.object({format:z.enum(['pokepoke-portable','pokepoke-notebook','pokepoke-collection']),version:z.literal(1).optional(),settings:settingsSchema,items:z.array(itemSchema).max(20000),revision:z.number().int().min(0).default(0),preferences:z.record(z.string(),z.string().max(200000)).default({}),attachments:z.array(z.unknown()).max(0).optional()}).parse(raw);
 bundleSchema.parse(data);
 for(const key of Object.keys(data.preferences))if(!preferenceKeys.includes(key)&&!key.startsWith('pokepoke-input-draft:'))throw Error('このアプリ以外の設定が含まれています');
 if(data.preferences['pokepoke-account-view'])JSON.parse(data.preferences['pokepoke-account-view']);
 return {...data,...normalize({settings:data.settings,items:data.items,revision:data.revision})};
}
export function makeBackup(bundle:Bundle){return {format:'pokepoke-portable',version:1,exportedAt:new Date().toISOString(),...bundleSchema.parse(bundle),preferences:preferences(),attachments:[]}}
export function downloadBackup(value:unknown,prefix='pokepoke-backup'){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${prefix}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
export function counts(b:Bundle){return `枚数記録 ${b.items.length}件 ／ アカウント ${new Set([...b.settings.accounts,...(b.settings.notebook?.records.map(r=>r.name)??[]),...b.items.map(i=>i.secondaryName).filter(Boolean)]).size}件 ／ カード設定 ${b.settings.cards.length}件 ／ アカウント項目 ${b.settings.notebook?.fields.length??0}件`}

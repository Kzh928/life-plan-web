"use client";

import { useEffect, useState, type FocusEvent } from "react";
import { Plus, Minus, Pencil, Trash2, Check, Archive, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Item = {id:string;name:string;secondaryName:string;count:number;memo:string;confirmed:boolean;position:number;createdAt:number};
type Draft = {name:string;secondaryName:string;memo:string;count:string};

export default function CounterApp() {
  const [items,setItems] = useState<Item[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState<string | null>(null);
  const [dialog,setDialog] = useState<"new" | string | null>(null);
  const [draft,setDraft] = useState<Draft>({name:"",secondaryName:"",memo:"",count:"0"});
  const [tab,setTab] = useState("pending");
  const [reorderMode,setReorderMode] = useState(false);
  useEffect(()=>{let live=true;fetch("/api/items",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("読み込みに失敗しました．");return (await r.json()) as Item[]}).then(data=>{if(live)setItems(data)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
  useEffect(()=>{
    if(dialog===null)return;
    const viewport=window.visualViewport;
    const adjust=()=>{
      document.documentElement.style.setProperty("--edit-visible-height",`${viewport?.height??window.innerHeight}px`);
      document.documentElement.style.setProperty("--edit-visible-top",`${viewport?.offsetTop??0}px`);
      if(document.activeElement?.matches(".edit-dialog input, .edit-dialog textarea")){
        window.setTimeout(()=>document.activeElement?.scrollIntoView({block:"center",behavior:"smooth"}),80);
      }
    };
    adjust();
    viewport?.addEventListener("resize",adjust);
    viewport?.addEventListener("scroll",adjust);
    window.addEventListener("resize",adjust);
    return()=>{
      viewport?.removeEventListener("resize",adjust);
      viewport?.removeEventListener("scroll",adjust);
      window.removeEventListener("resize",adjust);
      document.documentElement.style.removeProperty("--edit-visible-height");
      document.documentElement.style.removeProperty("--edit-visible-top");
    };
  },[dialog]);
  function keepFieldVisible(event:FocusEvent<HTMLInputElement|HTMLTextAreaElement>){
    const field=event.currentTarget;
    window.setTimeout(()=>field.scrollIntoView({block:"center",behavior:"smooth"}),300);
  }
  const [cardFilter,setCardFilter]=useState(''),[accountFilter,setAccountFilter]=useState('');
  useEffect(()=>{const params=new URLSearchParams(window.location.search);setCardFilter(params.get('card')??'');setAccountFilter(params.get('account')??'');if(params.get('card'))setTab('all')},[]);
  const ordered=[...items].sort((a,b)=>a.position-b.position||a.createdAt-b.createdAt);
  const filtered=ordered.filter(item=>(!cardFilter||item.name===cardFilter)&&(!accountFilter||item.secondaryName===accountFilter));
  const pending=filtered.filter(item=>item.count<12), saved=filtered.filter(item=>item.count>=12);
  function openNew(){setDraft({name:"",secondaryName:"",memo:"",count:"0"});setDialog("new");setError("")}
  function openEdit(item:Item){setDraft({name:item.name,secondaryName:item.secondaryName,memo:item.memo,count:String(item.count)});setDialog(item.id);setError("")}
  async function request(url:string,method:string,body?:unknown){const response=await fetch(url,{method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});const data=await response.json() as {error?:string}&Item;if(!response.ok)throw new Error(data.error||"操作に失敗しました．");return data as Item}
  const titleKey=(name:string)=>name.trim().replace(/\s+/g,' ');
  function changeIdentity(patch:Partial<Draft>){const next={...draft,...patch};if(dialog==='new'){const existing=items.find(i=>titleKey(i.name)===titleKey(next.name)&&i.secondaryName.trim()===next.secondaryName.trim());next.count=String(existing?.count??0);next.memo=existing?.memo??''}setDraft(next)}
  async function saveDraft(){const entered=draft.name.trim(),count=Number(draft.count);if(!entered||draft.count===''||!Number.isInteger(count)||count<0||count>12)return;const target=dialog;setBusy('dialog');setError('');try{
   const name=items.find(i=>titleKey(i.name)===titleKey(entered))?.name??entered,secondaryName=draft.secondaryName.trim();
   const matches=items.filter(i=>titleKey(i.name)===titleKey(name)&&i.secondaryName.trim()===secondaryName&&i.id!==target);
   if(matches.length>1)throw Error('同じカード・アカウントの記録が複数あります．既存の記録を確認してください');
   if(target!=='new'&&matches.length)throw Error('同じカード・アカウントの記録がすでにあります');
   const existing=target==='new'?matches[0]:items.find(i=>i.id===target);
   let item:Item;
   if(existing){item=existing;if(target!=='new'||draft.memo!==existing.memo)item=await request(`/api/items/${existing.id}`,'PATCH',{action:'edit',name,secondaryName,memo:draft.memo});if(item.count!==count)item=await request(`/api/items/${item.id}`,'PATCH',{action:'setCount',count})}
   else item=await request('/api/items','POST',{name,secondaryName,memo:draft.memo,count});
   setItems(previous=>previous.some(i=>i.id===item.id)?previous.map(i=>i.id===item.id?item:i):[...previous,item]);setDialog(null);setCardFilter('');setAccountFilter('');setTab(item.count===12?'saved':'pending');
  }catch(e){setError((e as Error).message)}finally{setBusy(null)}}

  async function update(item:Item,body:unknown){setBusy(item.id);setError("");try{const updated:Item=await request(`/api/items/${item.id}`,"PATCH",body);setItems(previous=>previous.map(value=>value.id===item.id?updated:value))}catch(e){setError((e as Error).message)}finally{setBusy(null)}}
  async function remove(item:Item){if(!window.confirm(`「${item.name}」を削除しますか？`))return;setBusy(item.id);setError("");try{await request(`/api/items/${item.id}`,"DELETE");setItems(previous=>previous.filter(value=>value.id!==item.id))}catch(e){setError((e as Error).message)}finally{setBusy(null)}}
  async function move(list:Item[],index:number,direction:-1|1){
    const next=[...list];
    [next[index],next[index+direction]]=[next[index+direction],next[index]];
    setBusy("order");setError("");
    try {
      const response=await fetch("/api/items/reorder",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category:tab,ids:next.map(item=>item.id)})});
      const data=await response.json() as Item[] & {error?:string};
      if(!response.ok)throw new Error(data.error||"並び順を保存できませんでした．");
      setItems(data);
    } catch(error){setError((error as Error).message)}
    finally{setBusy(null)}
  }
  const card=(item:Item,index:number,list:Item[])=><article className="item-card" key={item.id}>
    <div className="item-top"><div className="item-name-area"><span className="card-field-label">カード名</span><h3>{item.name}</h3>{item.secondaryName&&<p className="secondary-name"><span>アカウント</span>{item.secondaryName}</p>}{item.confirmed&&<span className="confirmed-tag"><Check size={14}/> 確定済み</span>}</div>{reorderMode?<div className="order-actions"><button type="button" aria-label={`${item.name}を上へ`} disabled={index===0||busy!==null} onClick={()=>move(list,index,-1)}><ArrowUp size={20}/></button><button type="button" aria-label={`${item.name}を下へ`} disabled={index===list.length-1||busy!==null} onClick={()=>move(list,index,1)}><ArrowDown size={20}/></button></div>:<div className="item-actions"><Button variant="ghost" size="icon" aria-label={`${item.name}を編集`} onClick={()=>openEdit(item)}><Pencil size={19}/></Button><Button variant="ghost" size="icon" aria-label={`${item.name}を削除`} onClick={()=>remove(item)} disabled={busy===item.id}><Trash2 size={19}/></Button></div>}</div>
    {item.memo&&<p className="item-memo">{item.memo}</p>}
    <div className="card-bottom"><div className="counter" aria-label={`${item.name}の数 ${item.count}`}><button type="button" className="count-button" aria-label={`${item.name}を1減らす`} disabled={reorderMode||busy===item.id||item.count===0} onClick={()=>update(item,{action:"step",delta:-1})}><Minus size={21}/></button><div className="count-readout"><strong>{item.count}</strong><span>/ 12</span></div><button type="button" className="count-button increase" aria-label={`${item.name}を1増やす`} disabled={reorderMode||busy===item.id||item.count===12} onClick={()=>update(item,{action:"step",delta:1})}><Plus size={22}/></button></div>
    {item.count===12&&<Button className={item.confirmed?"confirm-button done":"confirm-button"} variant={item.confirmed?"outline":"default"} disabled={reorderMode||busy===item.id} onClick={()=>update(item,{action:"confirm",confirmed:!item.confirmed})}>{item.confirmed?"確定を解除":"確定する"}</Button>}</div>
  </article>;
  function groupedCards(list:Item[]){
    return Array.from(new Set(list.map(i=>i.name))).map(name=>{const rows=filtered.filter(i=>i.name===name);const total=rows.reduce((sum,i)=>sum+i.count,0);return <section className="stock-group" key={name}><header><h2>{name}</h2><strong>合計 {total}枚</strong></header><p className="stock-summary">{total<12?`合計であと${12-total}枚`:'合計で12枚分あり'}<span>各アカウントの枚数は下で確認</span></p><div className="group-stock">{rows.map((item,index)=>card(item,index,rows))}</div></section>})
  }
  const listContent=(list:Item[],category:"pending"|"saved")=>loading?<p className="empty">読み込み中…</p>:list.length?<><div className="list-toolbar"><span>{tab==="all"?"該当カード":category==="pending"?"未完了":"保存"} {list.length}件</span>{list.length>1&&!cardFilter&&!accountFilter&&<Button type="button" variant="outline" onClick={()=>setReorderMode(!reorderMode)} disabled={busy==="order"}>{reorderMode?"並び替えを終了":"並び替え"}</Button>}</div><div className={`item-grid ${reorderMode?"reordering":""}`}>{reorderMode?list.map((item,index)=>card(item,index,list)):groupedCards(list)}</div></>:<div className="empty">{category==="pending"?<><p>未完了のカードはありません</p><Button variant="outline" onClick={openNew}>カードを追加</Button></>:<><Archive size={29}/><p>12になったカードがここに入ります</p></>}</div>;
  return <main className="app-shell"><nav className="simple-tabs"><a href="/" aria-current="page">カード</a><a href="/accounts">アカウント</a><a href="/collection">おすそわけ</a><a href="/gold-frames">金フレーム</a></nav>{(cardFilter||accountFilter)&&<div className="filter-context"><a href={accountFilter?`/accounts?account=${encodeURIComponent(accountFilter)}`:"/collection"}>‹ 戻る</a><span>{cardFilter} {accountFilter}</span><button onClick={()=>{setCardFilter('');setAccountFilter('');setTab('pending')}}>絞り込み解除</button></div>}<header className="app-header"><div className="heading"><span className="eyebrow">COUNT TO TWELVE</span><h1>12カウント メモ</h1><p className="stock-intro">同じカードをまとめて，アカウントごとの枚数を確認</p></div><Button className="add-button" onClick={openNew}><Plus size={19}/>追加</Button></header>
  {error&&<div className="error" role="alert">{error}<button onClick={()=>setError("")} aria-label="閉じる">×</button></div>}
  <a className="collection-entry" href="/collection">▦ カード別のおすそわけを見る <span>→</span></a>
  <a className="collection-entry" href="/accounts">▦ アカウント管理表を見る →</a><Tabs value={tab} onValueChange={value=>{setTab(value);setReorderMode(false)}} className="tabs"><TabsList className="tab-list">{(cardFilter||accountFilter)&&<TabsTrigger value="all">該当カード</TabsTrigger>}<TabsTrigger value="pending">未完了 <span className="tab-count">{pending.length}</span></TabsTrigger><TabsTrigger value="saved">保存 <span className="tab-count">{saved.length}</span></TabsTrigger></TabsList>
  <TabsContent value="all" className="tab-content">{listContent(filtered,"pending")}</TabsContent><TabsContent value="pending" className="tab-content">{listContent(pending,"pending")}</TabsContent>
  <TabsContent value="saved" className="tab-content">{listContent(saved,"saved")}</TabsContent></Tabs>
  <Dialog open={dialog!==null} onOpenChange={open=>{if(!open&&busy!=="dialog")setDialog(null)}}><DialogContent className="edit-dialog" onOpenAutoFocus={event=>{event.preventDefault();requestAnimationFrame(()=>document.querySelector<HTMLElement>(".edit-dialog")?.focus())}}><DialogHeader><DialogTitle>{dialog==="new"?"カードを追加":"カードを編集"}</DialogTitle></DialogHeader><form onSubmit={event=>{event.preventDefault();saveDraft()}}><label className="form-label" htmlFor="item-name">カード名</label><Input list="known-card-names" id="item-name" maxLength={100} required value={draft.name} onFocus={keepFieldVisible} onChange={event=>changeIdentity({name:event.target.value})} placeholder="カード名を入力"/><label className="form-label memo-label" htmlFor="secondary-name">アカウント</label><datalist id="known-card-names">{Array.from(new Set(items.map(i=>i.name))).map(name=><option key={name} value={name}/>)}</datalist><Input list="known-account-names" id="secondary-name" maxLength={100} value={draft.secondaryName} onFocus={keepFieldVisible} onChange={event=>changeIdentity({secondaryName:event.target.value})} placeholder="アカウントを入力"/><datalist id="known-account-names">{Array.from(new Set(items.map(i=>i.secondaryName))).filter(Boolean).map(name=><option key={name} value={name}/>)}</datalist><label className="form-label memo-label" htmlFor="item-count">現在の所持枚数</label><Input id="item-count" type="number" inputMode="numeric" min="0" max="12" step="1" required value={draft.count} onFocus={keepFieldVisible} onChange={event=>setDraft({...draft,count:event.target.value})}/><p className="stock-intro">同じカード名は同じまとまりに入ります．同じアカウントも登録済みなら，現在の枚数を更新します．</p><label className="form-label memo-label" htmlFor="item-memo">メモ</label><Textarea id="item-memo" maxLength={2000} rows={4} value={draft.memo} onFocus={keepFieldVisible} onChange={event=>setDraft({...draft,memo:event.target.value})} placeholder="メモを入力（任意）"/>{error&&<p className="error" role="alert">{error}</p>}<DialogFooter className="form-footer"><Button type="button" variant="outline" onClick={()=>setDialog(null)}>キャンセル</Button><Button type="submit" disabled={busy==="dialog"||!draft.name.trim()}>{busy==="dialog"?"保存中…":"保存"}</Button></DialogFooter></form></DialogContent></Dialog>
  </main>
}

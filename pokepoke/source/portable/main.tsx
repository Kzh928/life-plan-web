import React from 'react';import {createRoot} from 'react-dom/client';
import Counter from '../app/counter-app';import Accounts from '../app/accounts/accounts-app';import Collection from '../app/collection/collection-app';import Transfer from './transfer';import {installLocalApi} from './api';import '../app/globals.css';
installLocalApi();
const base=location.pathname.replace(/index\.html$/,'').replace(/\/$/,'')+'/';
function destination(path:string){const u=new URL(path,location.origin);const screen=u.pathname.startsWith('/gold-frames')?'gold':u.pathname.startsWith('/accounts')?'accounts':u.pathname.startsWith('/collection')?'collection':'cards';u.searchParams.set('screen',screen);return base+'?'+u.searchParams.toString()}
const replace=history.replaceState.bind(history);history.replaceState=(data,title,url)=>replace(data,title,typeof url==='string'&&url.startsWith('/')?destination(url):url);
document.addEventListener('click',e=>{const a=(e.target as Element).closest?.('a');if(a&&a.getAttribute('href')?.startsWith('/')&&!a.getAttribute('href')?.startsWith('//')&&!e.ctrlKey&&!e.metaKey){e.preventDefault();location.assign(destination(a.getAttribute('href')!))}},true);
const screen=new URLSearchParams(location.search).get('screen');
function GoldFrames(){return <main className="gold-frame-workspace"><nav className="simple-tabs"><a href="/">カード</a><a href="/accounts">アカウント</a><a href="/collection">おすそわけ</a><a href="/gold-frames" aria-current="page">金フレーム</a></nav><iframe title="ポケポケ 金フレーム" src="./gold-frame.html" className="gold-frame-embed"/></main>}
createRoot(document.getElementById('root')!).render(<>{screen==='gold'?<GoldFrames/>:<><Transfer local/>{screen==='accounts'?<Accounts/>:screen==='collection'?<Collection/>:<Counter/>}</>}</>);
if('serviceWorker' in navigator)window.addEventListener('load',()=>{void navigator.serviceWorker.register('./sw.js').catch(()=>{})});

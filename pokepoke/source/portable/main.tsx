import React from 'react';import {createRoot} from 'react-dom/client';
import Counter from '../app/counter-app';import Accounts from '../app/accounts/accounts-app';import Collection from '../app/collection/collection-app';import Transfer from './transfer';import {installLocalApi} from './api';import '../app/globals.css';
installLocalApi();
const base=location.pathname.replace(/index\.html$/,'').replace(/\/$/,'')+'/';
function destination(path:string){const u=new URL(path,location.origin);const screen=u.pathname.startsWith('/accounts')?'accounts':u.pathname.startsWith('/collection')?'collection':'cards';u.searchParams.set('screen',screen);return base+'?'+u.searchParams.toString()}
const replace=history.replaceState.bind(history);history.replaceState=(data,title,url)=>replace(data,title,typeof url==='string'&&url.startsWith('/')?destination(url):url);
document.addEventListener('click',e=>{const a=(e.target as Element).closest?.('a');if(a&&a.getAttribute('href')?.startsWith('/')&&!a.getAttribute('href')?.startsWith('//')&&!e.ctrlKey&&!e.metaKey){e.preventDefault();location.assign(destination(a.getAttribute('href')!))}},true);
const screen=new URLSearchParams(location.search).get('screen');
createRoot(document.getElementById('root')!).render(<><Transfer local/>{screen==='accounts'?<Accounts/>:screen==='collection'?<Collection/>:<Counter/>}</>);
if('serviceWorker' in navigator)window.addEventListener('load',()=>{void navigator.serviceWorker.register('./sw.js').catch(()=>{})});

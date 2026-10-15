// Regression tests for full legacy storage, transaction failure and durable v3 recovery.
const assert=require('node:assert/strict');
const {createStore}=require('../storage.js');
const memory=entries=>{const map=new Map(entries);return {map,get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const driver=(map=new Map())=>({mode:'IndexedDB',readAll:async()=>new Map(map),write:async batch=>{for(const [k,v]of batch)v===null?map.delete(k):map.set(k,v)},map});
(async()=>{
 const native=memory([['lifeplan-v2','original actual plan'],['household-book-v1','original household'],['finance-v3-life','previous v3']]);
 native.setItem=()=>{const e=Error('full');e.name='QuotaExceededError';throw e;};
 const before=[...native.map],db=driver(),s=createStore({native,driver:async()=>db});await s.ready;
 assert.equal(db.map.get('finance-v3-life'),'previous v3');
 s.storage.setItem('finance-v3-book','x'.repeat(6*1024*1024));await s.flush();assert.equal(db.map.get('finance-v3-book').length,6*1024*1024);assert.deepEqual([...native.map],before);
 assert.throws(()=>s.storage.setItem('lifeplan-v2','overwrite'));
 s.storage.removeItem('finance-v3-life');await s.flush();const once=createStore({native,driver:async()=>db});await once.ready;assert.equal(once.storage.getItem('finance-v3-life'),null,'deleted v3 data must not be resurrected from the old localStorage copy');
 await s.verify();assert(![...db.map.keys()].some(k=>k.startsWith('finance-v3-check-')));
 const newer=driver(new Map([['finance-v3-life','database newer version']]));const reloaded=createStore({native,driver:async()=>newer});await reloaded.ready;assert.equal(reloaded.storage.getItem('finance-v3-life'),'database newer version');
 let fail=false;const statuses=[],failing=driver();const write=failing.write;failing.write=async batch=>{if(fail)throw Error('transaction aborted');return write(batch)};const recovery=createStore({native:memory(),driver:async()=>failing,onState:s=>statuses.push(s.phase)});await recovery.ready;
 recovery.storage.setItem('finance-v3-life','durable');await recovery.flush();fail=true;recovery.storage.setItem('finance-v3-life','unsaved user input');await assert.rejects(recovery.flush());assert.equal(failing.map.get('finance-v3-life'),'durable');assert.equal(recovery.storage.getItem('finance-v3-life'),'unsaved user input');assert.equal(statuses.at(-1),'error');
 fail=false;await recovery.flush();assert.equal(failing.map.get('finance-v3-life'),'unsaved user input');assert.equal(statuses.at(-1),'saved');
 recovery.storage.setItem('finance-v3-life','first');recovery.storage.setItem('finance-v3-book','second');recovery.storage.setItem('finance-v3-life','latest');await recovery.flush();assert.equal(failing.map.get('finance-v3-life'),'latest');assert.equal(failing.map.get('finance-v3-book'),'second');
 const diskReload=createStore({native:memory(),driver:async()=>failing});await diskReload.ready;assert.equal(diskReload.storage.getItem('finance-v3-life'),'latest');
 let originalReads=0;const fast=createStore({native:()=>{originalReads++;return native;},driver:async()=>driver(new Map([['finance-v3-storage-migrated','1'],['finance-v3-life','saved v3']]))});await fast.ready;assert.equal(originalReads,0,'normal startup must not scan the old v1/v2 storage');
 let redundantWrites=0;const unchangedDriver=driver(new Map([['finance-v3-storage-migrated','1'],['finance-v3-life','same']])),originalWrite=unchangedDriver.write;unchangedDriver.write=async batch=>{redundantWrites++;return originalWrite(batch);};const unchanged=createStore({native:memory(),driver:async()=>unchangedDriver});await unchanged.ready;unchanged.storage.setItem('finance-v3-life','same');await unchanged.flush();assert.equal(redundantWrites,0,'identical data should not cause another database write');
 const retryDriver=driver(new Map([['finance-v3-storage-migrated','1']]));let retryFail=true;const retryWrite=retryDriver.write;retryDriver.write=async batch=>{if(retryFail)throw Error('temporary');return retryWrite(batch);};const retrySame=createStore({native:memory(),driver:async()=>retryDriver});await retrySame.ready;retrySame.storage.setItem('finance-v3-life','pending');await assert.rejects(retrySame.flush());retryFail=false;retrySame.storage.setItem('finance-v3-life','pending');await retrySame.flush();assert.equal(retryDriver.map.get('finance-v3-life'),'pending','identical unsaved data must retry after failure');
 console.log('PASS: full original localStorage, 6MB v3 save, original keys unchanged, old v3 migration, durable precedence, read-back, transaction failure recovery, unsaved backup data and reload');
})();

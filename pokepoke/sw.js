const cacheName='pokepoke-offline-v1-'+self.registration.scope;
self.addEventListener('install',e=>{e.waitUntil(caches.open(cacheName).then(c=>c.add('./')))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'&&new URL(e.request.url).href.startsWith(self.registration.scope)){e.respondWith(fetch(e.request).catch(()=>caches.open(cacheName).then(c=>c.match('./'))))}});

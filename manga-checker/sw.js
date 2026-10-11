const CACHE="komanohito-shell-v5";
const ASSETS=["./","./index.html","./manifest.webmanifest","./icon.svg","./roster.json"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET"||new URL(request.url).origin!==self.location.origin)return;
  const url=new URL(request.url);
  const isRoster=url.pathname.endsWith("/manga-checker/roster.json");
  if(request.mode==="navigate"||isRoster){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));
      return response;
    }).catch(()=>caches.match(request).then(result=>result||caches.match("./index.html"))));
  } else {
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
  }
});
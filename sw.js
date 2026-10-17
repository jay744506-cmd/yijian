const CACHE='yijian-shell-v20';
const SHARE_CACHE='yijian-share-inbox-v1';
const SHELL=['./','./index.html','./styles.css','./app.css?v=2.0','./app.js?v=1.4.1','./pwa.js?v=1.4.1','./core.js?v=1.7','./storage.js?v=1.4','./merge.js?v=1.5','./artwork.js?v=1.4','./vendor/lucide.js','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('yijian-shell-')&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method==='POST'&&url.origin===self.location.origin&&url.pathname===new URL('./share-target',self.registration.scope).pathname){
  event.respondWith((async()=>{
   let error='missing',id;
   try{
    const form=await event.request.formData(),file=form.get('image');
    if(file&&typeof file.size==='number'){
     error=file.type.startsWith('image/')?(file.size?'large':'invalid'):'invalid';
     if(file.type.startsWith('image/')&&file.size>0&&file.size<=15*1024*1024){
      const inbox=await caches.open(SHARE_CACHE);
      id=self.crypto.randomUUID();
      const key=new URL('./__shared-image__/'+id,self.registration.scope).href;
      await inbox.put(key,new Response(file,{headers:{'Content-Type':file.type}}));
      // One pending import at a time; an abandoned share must not fill device storage.
      for(const request of await inbox.keys())if(request.url!==key)await inbox.delete(request);
      error=null;
     }
    }
   }catch{error='storage'}
   const target=new URL('./',self.registration.scope);
   target.searchParams.set(error?'share-error':'shared-image',error||id);
   target.hash='closet';
   return Response.redirect(target.href,303);
  })());return;
 }
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(event.request.mode==='navigate'){event.respondWith(caches.open(CACHE).then(async cache=>await cache.match(new URL('./index.html',self.registration.scope).href)||fetch(event.request)));return}
 event.respondWith(caches.open(CACHE).then(async cache=>await cache.match(event.request)||fetch(event.request)));
});

/* Суфлёр — офлайн-кэш v5
   Стратегии:
   - index.html / sborshik.html / навигация → СНАЧАЛА СЕТЬ, офлайн — из кэша.
     Обновления приложения теперь доезжают сами, без смены версии кэша.
   - songs.json → сначала сеть (свежий каталог), офлайн — из кэша.
   - иконки/манифест → сначала кэш (не меняются).
*/
var CACHE='souffleur-v5';
var PRECACHE=['./','./index.html','./manifest.json','./icon-180.png','./icon-512.png','./sborshik.html','./songs.json'];

self.addEventListener('install',function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      /* каждый файл отдельно: отсутствие одного (например, songs.json ещё не залит)
         не должно ломать установку всего приложения */
      return Promise.all(PRECACHE.map(function(u){
        return c.add(u).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function networkFirst(req){
  return fetch(req).then(function(res){
    if(res && res.ok){
      var copy=res.clone();
      caches.open(CACHE).then(function(c){ c.put(req,copy); });
    }
    return res;
  }).catch(function(){
    return caches.match(req,{ignoreSearch:true}).then(function(hit){
      if(hit) return hit;
      /* офлайн-навигация без точного совпадения — отдать оболочку приложения */
      if(req.mode==='navigate') return caches.match('./index.html');
      throw new Error('offline');
    });
  });
}

self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET') return;
  var url=e.request.url.split('?')[0];
  /* не трогаем чужие домены (GitHub API публикации и т.п.) */
  if(url.indexOf(self.location.origin)!==0) return;

  if(url.indexOf('songs.json')!==-1 || e.request.mode==='navigate' ||
     /\/(index\.html|sborshik\.html)$/.test(url) || /\/$/.test(url)){
    e.respondWith(networkFirst(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request,{ignoreSearch:true}).then(function(hit){
      if(hit) return hit;
      return fetch(e.request).then(function(res){
        if(res && res.ok){
          var copy=res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request,copy); });
        }
        return res;
      });
    })
  );
});

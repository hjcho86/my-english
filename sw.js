/* 오프라인 지원: 온라인이면 항상 서버에서 최신 파일을 확인하고(없으면 저장본 사용),
   오프라인이면 마지막으로 받아 둔 파일로 앱을 연다. GitHub API 같은 외부 요청은 건드리지 않는다. */
const CACHE = 'my-english-v3';
const FILES = [
 "./",
 "index.html",
 "style.css",
 "manifest.json",
 "icon-192.png",
 "icon-512.png",
 "apple-touch-icon.png",
 "data.js",
 "merge.js",
 "content/lv1a.js",
 "content/lv1b.js",
 "content/lv2a.js",
 "content/lv2b.js",
 "content/lv3a.js",
 "content/lv3b.js",
 "content/lv4a.js",
 "content/lv4b.js",
 "content/lv5a.js",
 "content/lv5b.js",
 "content/exp/base.js",
 "content/tr/base.js",
 "content/exp/lv1a.js",
 "content/exp/lv1b.js",
 "content/exp/lv2a.js",
 "content/exp/lv2b.js",
 "content/exp/lv3a.js",
 "content/exp/lv3b.js",
 "content/exp/lv4a.js",
 "content/exp/lv4b.js",
 "content/exp/lv5a.js",
 "content/exp/lv5b.js",
 "content/tr/lv1a.js",
 "content/tr/lv1b.js",
 "content/tr/lv2a.js",
 "content/tr/lv2b.js",
 "content/tr/lv3a.js",
 "content/tr/lv3b.js",
 "content/tr/lv4a.js",
 "content/tr/lv4b.js",
 "content/tr/lv5a.js",
 "content/tr/lv5b.js",
 "app.js"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const key = url.origin + url.pathname; // ?v=숫자 같은 쿼리는 저장 키에서 뺀다
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' }); // 매번 서버에 최신 여부를 확인
      if (res.ok && res.status === 200) { const c = await caches.open(CACHE); c.put(key, res.clone()).catch(() => {}); }
      return res;
    } catch (err) {
      const c = await caches.open(CACHE);
      return (await c.match(key)) || (url.pathname.endsWith('/') ? await c.match(new URL('index.html', location.href).href) : null) || Response.error();
    }
  })());
});

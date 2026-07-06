// Naxin Player Service Worker v3 — 音频缓存 + 离线可用
const CACHE_STATIC = 'naxin-static-v3';
const CACHE_AUDIO = 'naxin-audio-v3';
const CACHE_API   = 'naxin-api-v3';

// 预缓存 App Shell（安装时立即缓存）
const STATIC_FILES = [
  '/',
  '/index.html',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(k => {
          if (k.startsWith('naxin-') && k !== CACHE_STATIC && k !== CACHE_AUDIO && k !== CACHE_API) {
            return caches.delete(k);
          }
          return Promise.resolve();
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 音频文件 — CacheFirst（上传后不变，缓存永不过期）
  if (url.pathname.match(/^\/api\/(ambient|music)\/\w+\/\d+$/) ||
      url.pathname.match(/^\/api\/ambient\/\w+$/)) {
    event.respondWith(cacheFirst(event.request, CACHE_AUDIO));
    return;
  }

  // API 列表/元数据 — NetworkFirst（新增曲目需要实时）
  if (url.pathname.match(/^\/api\/(ambient|music|usage)/)) {
    event.respondWith(networkFirst(event.request, CACHE_API));
    return;
  }

  // 静态资源 — StaleWhileRevalidate（快 + 后台更新）
  if (event.request.method === 'GET') {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_STATIC));
    return;
  }
});

// CacheFirst：命中缓存直接返回，否则下载并缓存
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    return new Response('', { status: 503 });
  }
}

// NetworkFirst：先网络，失败回退缓存
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    return cached || new Response('', { status: 503 });
  }
}

// StaleWhileRevalidate：立即返回缓存，后台更新
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fetchPromise || new Response('', { status: 503 });
}

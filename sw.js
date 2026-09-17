/* 爬宠管家 Service Worker
   策略：
   - 导航请求（打开页面）：网络优先，拿不到再用缓存 —— 保证你更新后能马上看到新版本
   - 静态资源：缓存优先 —— 断网也能秒开
   更新方式：修改下面的 VERSION 即可强制全量刷新缓存
*/
var VERSION = 'pc-v1.6.0';
var CACHE = 'reptile-care-' + VERSION;

/* 需要预缓存的文件（注意是相对路径，适配 GitHub Pages 的 /仓库名/ 子目录） */
var PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        // 逐个添加，单个文件缺失不影响整体安装
        return Promise.all(PRECACHE.map(function (u) {
          return c.add(u).catch(function () { return null; });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          if (k !== CACHE) return caches.delete(k);   // 清理旧版本缓存
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* 收到页面发来的 SKIP_WAITING 消息时立即接管，让新版本马上生效 */
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // 只处理同源请求，外部资源直接放行
  if (url.origin !== self.location.origin) return;

  // 页面导航：网络优先
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (r) {
            return r || caches.match('./');
          });
        })
    );
    return;
  }

  // 其它资源：缓存优先
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        // 后台顺带更新一下
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return res; });
    })
  );
});

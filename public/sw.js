// Service Worker for PWA - Disaster Response System
const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const MAP_CACHE = `map-tiles-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Resources to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('static-') || 
                   name.startsWith('dynamic-') || 
                   name.startsWith('map-tiles-') ||
                   name.startsWith('api-');
          })
          .filter((name) => name !== STATIC_CACHE && 
                           name !== DYNAMIC_CACHE && 
                           name !== MAP_CACHE &&
                           name !== API_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful GET responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached API response if available
          return caches.match(request).then((cached) => {
            if (cached) {
              return cached;
            }
            // Return offline response for API
            return new Response(
              JSON.stringify({ 
                error: 'Offline', 
                message: 'Không có kết nối Internet' 
              }),
              {
                headers: { 'Content-Type': 'application/json' },
                status: 503
              }
            );
          });
        })
    );
    return;
  }

  // Handle map tiles with cache-first strategy
  if (url.hostname.includes('vietmap.vn') || 
      url.pathname.includes('tiles') || 
      url.pathname.includes('sprites') ||
      url.pathname.includes('fonts')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(MAP_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Handle static assets with cache-first strategy
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            return new Response('Offline', { status: 503 });
          });
      })
    );
    return;
  }

  // Default: network only for external resources
  event.respondWith(fetch(request));
});

// Background sync for offline reports
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncOfflineReports());
  }
});

async function syncOfflineReports() {
  try {
    const db = await openDB();
    const reports = await getOfflineReports(db);
    
    for (const report of reports) {
      try {
        const response = await fetch('/api/user-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report.data)
        });
        
        if (response.ok) {
          await deleteOfflineReport(db, report.id);
          console.log('[SW] Synced offline report:', report.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync report:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// IndexedDB helpers for offline storage
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DisasterReportsDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline-reports')) {
        db.createObjectStore('offline-reports', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getOfflineReports(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline-reports'], 'readonly');
    const store = transaction.objectStore('offline-reports');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deleteOfflineReport(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline-reports'], 'readwrite');
    const store = transaction.objectStore('offline-reports');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Handle push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Cảnh báo thiên tai';
  const options = {
    body: data.body || 'Có thông báo mới',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'notification',
    data: data.url || '/',
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'view',
        title: 'Xem chi tiết'
      },
      {
        action: 'close',
        title: 'Đóng'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    const url = event.notification.data || '/';
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
    );
  }
});

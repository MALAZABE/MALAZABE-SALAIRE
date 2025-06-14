// Service Worker pour MALAZA BE PWA
const CACHE_NAME = 'malaza-v1';
const urlsToCache = [
  '/malazabe-salaire/',
  '/malazabe-salaire/index.html',
  '/malazabe-salaire/manifest.json',
  '/malazabe-salaire/css/styles.css',
  '/malazabe-salaire/css/theme.css',
  '/malazabe-salaire/js/config.js',
  '/malazabe-salaire/js/utils.js',
  '/malazabe-salaire/js/database.js',
  '/malazabe-salaire/js/auth.js',
  '/malazabe-salaire/js/employees.js',
  '/malazabe-salaire/js/attendance.js',
  '/malazabe-salaire/js/salary.js',
  '/malazabe-salaire/js/payments.js',
  '/malazabe-salaire/js/leaves.js',
  '/malazabe-salaire/js/ui.js',
  '/malazabe-salaire/js/app.js'
];

// ... reste du fichier sw.js sans changement
// Installation du Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Mise en cache des fichiers');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Installation terminée');
      })
      .catch(err => {
        console.error('[SW] Erreur installation:', err);
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('[SW] Suppression ancien cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Interception des requêtes
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;
  
  // Ignorer les requêtes CouchDB
  if (event.request.url.includes('5984')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache d'abord
        if (response) {
          return response;
        }
        
        // Sinon réseau
        return fetch(event.request).then(response => {
          // Ne pas mettre en cache les réponses non-ok
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Cloner la réponse
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        });
      })
      .catch(() => {
        // Page offline si nécessaire
        console.log('[SW] Mode hors ligne pour:', event.request.url);
      })
  );
});
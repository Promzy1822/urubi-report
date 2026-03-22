// Service Worker — Urubi Group Report System
const CACHE_NAME = 'urubi-v1'
const OFFLINE_URLS = [
  '/',
  '/dashboard',
  '/entry',
  '/report',
  '/analytics',
]

// Install — cache core pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch — network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET and Supabase API calls (let them fail naturally when offline)
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('supabase.co')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for app pages
        if (response.ok && event.request.url.includes(self.location.origin)) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached
          // For navigation requests, serve the app shell
          if (event.request.mode === 'navigate') {
            return caches.match('/') 
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})

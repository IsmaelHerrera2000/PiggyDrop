// public/sw.js

const CACHE_NAME = 'piggydrop-v2'
const STATIC_ASSETS = ['/', '/dashboard']

// ── Install & Cache ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Network First ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// ── Push notifications ────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { data = { title: 'PiggyDrop', body: event.data.text() } }

  const { title = 'PiggyDrop 🐷', body = '', tag = 'piggydrop', icon, badge, data: notifData } = data

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: icon || '/icons/icon-192.png',
      badge: badge || '/icons/icon-96.png',
      vibrate: [200, 100, 200],
      data: notifData || { url: '/dashboard' },
      actions: [
        { action: 'open', title: 'Ver metas' },
        { action: 'close', title: 'Ignorar' },
      ],
    })
  )
})

// ── Notification click ────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'close') return

  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})

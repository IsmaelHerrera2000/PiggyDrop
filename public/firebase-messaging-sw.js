// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyCpGsjEq70uy7j5CKKDByZDrwxL7gzUSVw',
  authDomain:        'piggydrop-896a7.firebaseapp.com',
  projectId:         'piggydrop-896a7',
  storageBucket:     'piggydrop-896a7.firebasestorage.app',
  messagingSenderId: '283373354019',
  appId:             '1:283373354019:web:1349df8613c4f292628596',
})

const messaging = firebase.messaging()

// Background messages (app cerrada o en segundo plano)
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message:', payload)

  const notification = payload.notification ?? {}
  const title = notification.title ?? 'PiggyDrop 🐷'
  const body  = notification.body  ?? '¡Tienes novedades en tus metas!'
  const data  = payload.data       ?? {}

  self.registration.showNotification(title, {
    body,
    icon:    '/icons/icon-192x192.png',
    badge:   '/icons/icon-96x96.png',
    data:    { url: data.url ?? '/dashboard' },
    vibrate: [200, 100, 200],
    tag:     'piggydrop-notification',
    renotify: true,
  })
})

// Clic en notificación → abre la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})

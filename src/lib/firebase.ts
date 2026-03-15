// src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

export function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp(firebaseConfig)
}

export async function getFCMToken(
  swRegistration?: ServiceWorkerRegistration
): Promise<string | null> {
  try {
    const supported = await isSupported()
    if (!supported) return null

    const app = getFirebaseApp()
    const messaging = getMessaging(app)

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
      ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
    })

    return token || null
  } catch (e) {
    console.error('FCM token error:', e)
    return null
  }
}

export async function onForegroundMessage(callback: (payload: any) => void) {
  try {
    const supported = await isSupported()
    if (!supported) return
    const app = getFirebaseApp()
    const messaging = getMessaging(app)
    onMessage(messaging, callback)
  } catch (e) {
    console.error('FCM foreground message error:', e)
  }
}
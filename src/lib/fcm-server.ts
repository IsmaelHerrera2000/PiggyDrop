// src/lib/fcm-server.ts
// Helper para enviar notificaciones FCM desde Server Actions o API routes

let adminInitialized = false

async function initAdmin() {
  if (adminInitialized) return
  const admin = await import('firebase-admin')
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    })
  }
  adminInitialized = true
}

export async function sendNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    await initAdmin()
    const admin = await import('firebase-admin')
    const { createClient } = await import('@supabase/supabase-js')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all FCM tokens for this user
    const { data: tokenRows } = await supabase
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', userId)

    if (!tokenRows || tokenRows.length === 0) return

    const tokens = tokenRows.map(r => r.token)

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#FF6B35',
          channelId: 'piggydrop_savings',
        },
        priority: 'high',
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png',
        },
        fcmOptions: { link: 'https://piggy-drop-fvof.vercel.app/dashboard' },
      },
      data: data ?? {},
    })

    // Clean up stale tokens
    const stale: string[] = []
    response.responses.forEach((r, i) => {
      if (!r.success && (
        r.error?.code === 'messaging/registration-token-not-registered' ||
        r.error?.code === 'messaging/invalid-registration-token'
      )) stale.push(tokens[i])
    })
    if (stale.length > 0) {
      await supabase.from('fcm_tokens').delete().in('token', stale)
    }
  } catch (e) {
    // Never throw — notifications are non-critical
    console.error('FCM sendNotificationToUser error:', e)
  }
}

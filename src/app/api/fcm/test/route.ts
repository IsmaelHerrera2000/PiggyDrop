// src/app/api/fcm/test/route.ts
// Endpoint temporal para probar que FCM funciona end-to-end
// Envía una notificación directa a todos los tokens del usuario autenticado
// ELIMINAR en producción o proteger con CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

let adminInitialized = false

async function getAdmin() {
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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await getAdmin()
    const admin = await import('firebase-admin')

    const { data: tokenRows } = await supabase
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', user.id)

    if (!tokenRows || tokenRows.length === 0) {
      return NextResponse.json({ error: 'No tokens found for this user' }, { status: 404 })
    }

    const tokens = tokenRows.map(r => r.token)
    console.log(`[FCM test] Sending to ${tokens.length} token(s) for user ${user.id}`)

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: '🐷 PiggyDrop — Test',
        body: '¡Las notificaciones funcionan correctamente!',
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png',
          requireInteraction: true,
        },
        fcmOptions: {
          link: 'https://piggy-drop-fvof.vercel.app/dashboard',
        },
      },
    })

    const results = response.responses.map((r, i) => ({
      token: tokens[i].slice(0, 20) + '...',
      success: r.success,
      error: r.error?.code ?? null,
    }))

    // Limpiar tokens caducados
    const stale = response.responses
      .map((r, i) => (!r.success && (
        r.error?.code === 'messaging/registration-token-not-registered' ||
        r.error?.code === 'messaging/invalid-registration-token'
      )) ? tokens[i] : null)
      .filter(Boolean) as string[]

    if (stale.length > 0) {
      await supabase.from('fcm_tokens').delete().in('token', stale)
    }

    return NextResponse.json({
      ok: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      staleRemoved: stale.length,
      results,
    })
  } catch (e: any) {
    console.error('[FCM test] Error:', e)
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}

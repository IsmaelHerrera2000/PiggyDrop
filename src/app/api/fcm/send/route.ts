// src/app/api/fcm/send/route.ts
// Cron job diario — reemplaza /api/push/send con Firebase Admin SDK
// Configura en vercel.json: { "path": "/api/fcm/send", "schedule": "0 10 * * *" }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Goal, Deposit } from '@/types/database'

// ── Firebase Admin (inicialización lazy) ─────────────────────
let adminApp: any = null

async function getAdmin() {
  if (adminApp) return adminApp
  const admin = await import('firebase-admin')
  if (!admin.apps.length) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    })
  } else {
    adminApp = admin.apps[0]
  }
  return adminApp
}

async function sendFCM(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  const admin = await import('firebase-admin')
  await getAdmin()

  if (tokens.length === 0) return { successCount: 0, failedTokens: [] }

  const targetUrl = data?.url
    ? `https://piggy-drop-fvof.vercel.app${data.url}`
    : 'https://piggy-drop-fvof.vercel.app/dashboard'

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    android: {
      notification: {
        icon: 'ic_notification',
        color: '#FF6B35',
        channelId: 'piggydrop_savings',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
      priority: 'high',
    },
    webpush: {
      notification: {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        requireInteraction: false,
      },
      fcmOptions: { link: targetUrl },
    },
    data: data ?? {},
  })

  const failedTokens: string[] = []
  response.responses.forEach((r, i) => {
    if (
      !r.success &&
      (r.error?.code === 'messaging/registration-token-not-registered' ||
        r.error?.code === 'messaging/invalid-registration-token')
    ) {
      failedTokens.push(tokens[i])
    }
  })

  return { successCount: response.successCount, failedTokens }
}

// ── Helpers ───────────────────────────────────────────────────
function calcStreak(deposits: Deposit[]): number {
  if (!deposits || deposits.length === 0) return 0
  const days = new Set(deposits.map(d => d.created_at.slice(0, 10)))
  let streak = 0
  const check = new Date()
  if (!days.has(check.toISOString().slice(0, 10))) check.setDate(check.getDate() - 1)
  while (days.has(check.toISOString().slice(0, 10))) {
    streak++
    check.setDate(check.getDate() - 1)
  }
  return streak
}

function daysSinceLastDeposit(deposits: Deposit[]): number {
  if (!deposits || deposits.length === 0) return 999
  const sorted = [...deposits].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  return Math.floor(
    (Date.now() - new Date(sorted[0].created_at).getTime()) / 86400000
  )
}

function thisWeekSaved(deposits: Deposit[]): number {
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)
  return deposits
    .filter(d => new Date(d.created_at) >= weekStart)
    .reduce((s, d) => s + d.amount, 0)
}

function thisMonthSaved(deposits: Deposit[]): number {
  const now = new Date()
  return deposits
    .filter(d => {
      const dd = new Date(d.created_at)
      return (
        dd.getFullYear() === now.getFullYear() &&
        dd.getMonth() === now.getMonth()
      )
    })
    .reduce((s, d) => s + d.amount, 0)
}

// ── Main handler ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const cronHeader = req.headers.get('x-vercel-cron')
  const authHeader = req.headers.get('authorization')
  if (!cronHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tokenRows, error: tokErr } = await supabase
    .from('fcm_tokens')
    .select('user_id, token, locale')

  if (tokErr || !tokenRows || tokenRows.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no tokens' })
  }

  const userIds = [...new Set(tokenRows.map(t => t.user_id))]
  const { data: goals } = await supabase
    .from('goals')
    .select('*, deposits(*)')
    .in('user_id', userIds)

  if (!goals) return NextResponse.json({ ok: true, sent: 0 })

  const now = new Date()
  const dayOfWeek  = now.getDay()
  const isMonday   = dayOfWeek === 1
  const isThuOrFri = dayOfWeek === 4 || dayOfWeek === 5

  let totalSent = 0
  const allFailedTokens: string[] = []

  for (const tokenRow of tokenRows) {
    const { user_id, token, locale } = tokenRow
    const isEN = locale === 'en'
    const userGoals = (goals as any[]).filter(
      g => g.user_id === user_id && g.saved_amount < g.target_price
    )

    if (userGoals.length === 0) continue

    const notifications: { title: string; body: string }[] = []

    for (const goal of userGoals) {
      const deposits: Deposit[] = goal.deposits ?? []
      const streak = calcStreak(deposits)
      const days   = daysSinceLastDeposit(deposits)
      const pct    = Math.round((goal.saved_amount / goal.target_price) * 100)

      // 1. Inactividad 7+ días — solo si hay depósitos previos (evita mostrar 999 días)
      if (days >= 7 && deposits.length > 0) {
        notifications.push({
          title: `⏰ ${goal.name}`,
          body: isEN
            ? `${days} days without saving! You're ${pct}% there.`
            : `¡${days} días sin ahorrar! Llevas un ${pct}% de tu meta.`,
        })
      }

      // 2. Hitos de racha
      const streakMilestones = [3, 7, 14, 21, 30, 60, 100]
      if (streakMilestones.includes(streak)) {
        notifications.push({
          title: isEN ? `🔥 ${streak}-day streak!` : `🔥 ¡Racha de ${streak} días!`,
          body: isEN
            ? `Keep it up on "${goal.name}"!`
            : `¡Sigue así con "${goal.name}"!`,
        })
      }

      // 3. Meta semanal
      if (goal.monthly_target && goal.savings_period === 'weekly') {
        const weekSaved = thisWeekSaved(deposits)
        if (isThuOrFri && weekSaved < goal.monthly_target) {
          notifications.push({
            title: isEN
              ? `📅 Weekly goal: ${goal.name}`
              : `📅 Meta semanal: ${goal.name}`,
            body: isEN
              ? `${goal.currency}${weekSaved.toFixed(0)} of ${goal.currency}${goal.monthly_target} this week. ${dayOfWeek === 4 ? '2 days left!' : '1 day left!'}`
              : `${goal.currency}${weekSaved.toFixed(0)} de ${goal.currency}${goal.monthly_target} esta semana. ${dayOfWeek === 4 ? '¡Quedan 2 días!' : '¡Queda 1 día!'}`,
          })
        }
        if (isMonday && weekSaved >= goal.monthly_target) {
          notifications.push({
            title: isEN ? `✅ Weekly goal done!` : `✅ ¡Meta semanal completada!`,
            body: isEN
              ? `You hit your weekly target for "${goal.name}". Great job!`
              : `Lograste tu meta semanal de "${goal.name}". ¡Bien hecho!`,
          })
        }
      }

      // 4. Meta mensual
      if (goal.monthly_target && goal.savings_period === 'monthly') {
        const monthSaved = thisMonthSaved(deposits)
        const daysInMonth = new Date(
          now.getFullYear(), now.getMonth() + 1, 0
        ).getDate()
        const daysLeft = daysInMonth - now.getDate()

        if (daysLeft <= 5 && monthSaved < goal.monthly_target) {
          notifications.push({
            title: isEN
              ? `📅 Monthly goal: ${goal.name}`
              : `📅 Meta mensual: ${goal.name}`,
            body: isEN
              ? `${goal.currency}${monthSaved.toFixed(0)} of ${goal.currency}${goal.monthly_target}. Only ${daysLeft} days left this month!`
              : `${goal.currency}${monthSaved.toFixed(0)} de ${goal.currency}${goal.monthly_target}. ¡Solo quedan ${daysLeft} días este mes!`,
          })
        }
      }
    }

    // Máximo 1 notificación por usuario por día (la más relevante)
    if (notifications.length > 0) {
      const notif = notifications[0]
      const { successCount, failedTokens } = await sendFCM(
        [token], notif.title, notif.body, { url: '/dashboard' }
      )
      totalSent += successCount
      allFailedTokens.push(...failedTokens)
    }
  }

  // Limpiar tokens caducados
  if (allFailedTokens.length > 0) {
    await supabase.from('fcm_tokens').delete().in('token', allFailedTokens)
    console.log(`Removed ${allFailedTokens.length} stale FCM tokens`)
  }

  return NextResponse.json({
    ok: true,
    sent: totalSent,
    staleRemoved: allFailedTokens.length,
  })
}
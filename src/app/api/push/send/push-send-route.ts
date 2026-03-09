// src/app/api/push/send/route.ts
//
// Vercel Cron: se ejecuta diariamente a las 10:00
// En vercel.json: { "crons": [{ "path": "/api/push/send", "schedule": "0 10 * * *" }] }
//
// Requiere en .env.local:
//   CRON_SECRET=<una cadena aleatoria tuya>
//   VAPID_PUBLIC_KEY=<generado con web-push>
//   VAPID_PRIVATE_KEY=<generado con web-push>
//   VAPID_EMAIL=mailto:tu@email.com

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getAllSubscriptionsWithGoals } from '@/lib/goals'
import type { Goal } from '@/types/database'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

function daysSinceLastDeposit(goal: Goal): number | null {
  if (!goal.deposits || goal.deposits.length === 0) return null
  const sorted = [...goal.deposits].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const last = new Date(sorted[0].created_at).getTime()
  return Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24))
}

function thisMonthSaved(goal: Goal): number {
  if (!goal.deposits) return 0
  const now = new Date()
  return goal.deposits
    .filter(d => {
      const d_ = new Date(d.created_at)
      return d_.getFullYear() === now.getFullYear() && d_.getMonth() === now.getMonth()
    })
    .reduce((s, d) => s + d.amount, 0)
}

export async function GET(req: NextRequest) {
  // Protect the cron endpoint
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const subs = await getAllSubscriptionsWithGoals()
  const results: { user: string; sent: number; errors: number }[] = []

  for (const sub of subs) {
    const notifications: { title: string; body: string; tag: string }[] = []
    const activeGoals = sub.goals.filter(g => g.saved_amount < g.target_price)

    for (const goal of activeGoals) {
      // Recordatorio: lleva N días sin ahorrar
      const days = daysSinceLastDeposit(goal)
      if (days !== null && days >= 7) {
        notifications.push({
          title: `¿Sigues ahorrando para ${goal.emoji} ${goal.name}?`,
          body: `Llevas ${days} días sin registrar un ahorro. ¡Pequeños pasos cuentan!`,
          tag: `reminder-${goal.id}`,
        })
      }

      // Meta periódica: avisa si no has llegado al objetivo mensual
      if (goal.monthly_target && goal.monthly_target > 0) {
        const saved = thisMonthSaved(goal)
        const today = new Date().getDate()
        // Avisar a partir del día 20 si llevas menos del 50% del objetivo mensual
        if (today >= 20 && saved < goal.monthly_target * 0.5) {
          notifications.push({
            title: `⚠️ Meta mensual de ${goal.emoji} ${goal.name}`,
            body: `Llevas €${saved.toFixed(0)} de €${goal.monthly_target} este mes. ¡Aún estás a tiempo!`,
            tag: `monthly-${goal.id}`,
          })
        }
      }
    }

    let sent = 0
    let errors = 0

    for (const notif of notifications) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: notif.title,
            body: notif.body,
            tag: notif.tag,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-96.png',
            data: { url: '/dashboard' },
          })
        )
        sent++
      } catch (e: unknown) {
        errors++
        // Si el endpoint ya no existe, podríamos borrarlo aquí
        console.error('Push error:', e)
      }
    }

    results.push({ user: sub.user_id.slice(0, 8), sent, errors })
  }

  return NextResponse.json({ ok: true, results })
}

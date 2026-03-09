// src/app/api/push/send/route.ts
//
// Vercel Cron: se ejecuta diariamente a las 10:00
// En vercel.json: { "crons": [{ "path": "/api/push/send", "schedule": "0 10 * * *" }] }
//
// Requiere en .env:
//   CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getAllSubscriptionsWithGoals } from '@/lib/goals'
import type { Goal } from '@/types/database'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

// ── Helpers ───────────────────────────────────────────────────

function daysSinceLastDeposit(goal: Goal): number | null {
  if (!goal.deposits || goal.deposits.length === 0) return null
  const sorted = [...goal.deposits].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  return Math.floor((Date.now() - new Date(sorted[0].created_at).getTime()) / 86400000)
}

function thisMonthSaved(goal: Goal): number {
  if (!goal.deposits) return 0
  const now = new Date()
  return goal.deposits
    .filter(d => {
      const dd = new Date(d.created_at)
      return dd.getFullYear() === now.getFullYear() && dd.getMonth() === now.getMonth()
    })
    .reduce((s, d) => s + d.amount, 0)
}

function percentage(goal: Goal): number {
  return Math.min(100, (goal.saved_amount / goal.target_price) * 100)
}

function avgDepositAmount(goal: Goal): number {
  if (!goal.deposits || goal.deposits.length === 0) return 0
  return goal.deposits.reduce((s, d) => s + d.amount, 0) / goal.deposits.length
}

function estimatedDaysLeft(goal: Goal): number | null {
  if (!goal.deposits || goal.deposits.length < 2) return null
  const sorted = [...goal.deposits].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const firstDate = new Date(sorted[0].created_at).getTime()
  const lastDate = new Date(sorted[sorted.length - 1].created_at).getTime()
  const totalDays = (lastDate - firstDate) / 86400000
  if (totalDays === 0) return null
  const dailyRate = goal.saved_amount / totalDays
  if (dailyRate <= 0) return null
  const remaining = goal.target_price - goal.saved_amount
  return Math.ceil(remaining / dailyRate)
}

// ── Notification builders ─────────────────────────────────────

type Notif = { title: string; body: string; tag: string }

// 1. Inactividad: 7+ días sin ahorrar
function checkInactivity(goal: Goal): Notif | null {
  const days = daysSinceLastDeposit(goal)
  if (days === null || days < 7) return null
  const msgs = [
    `Llevas ${days} días sin registrar un ahorro. ¡Pequeños pasos cuentan!`,
    `Tu ${goal.name} te está esperando. ¿Qué tal un aporte hoy?`,
    `${days} días es mucho tiempo. ¡Vuelve al ritmo!`,
  ]
  return {
    title: `¿Sigues ahorrando para ${goal.emoji} ${goal.name}?`,
    body: msgs[days % msgs.length],
    tag: `inactivity-${goal.id}`,
  }
}

// 2. Meta mensual: día 20+ y llevas < 50% del objetivo mensual
function checkMonthlyTarget(goal: Goal): Notif | null {
  if (!goal.monthly_target || goal.monthly_target <= 0) return null
  const saved = thisMonthSaved(goal)
  if (new Date().getDate() < 20 || saved >= goal.monthly_target * 0.5) return null
  const remaining = (goal.monthly_target - saved).toFixed(0)
  return {
    title: `⚠️ Meta mensual de ${goal.emoji} ${goal.name}`,
    body: `Llevas €${saved.toFixed(0)} de €${goal.monthly_target}. Te faltan €${remaining} y quedan ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} días.`,
    tag: `monthly-${goal.id}`,
  }
}

// 3. Hito: acabas de superar 25%, 50%, 75%, 90%
function checkMilestone(goal: Goal): Notif | null {
  const pct = percentage(goal)
  const milestones = [
    { threshold: 90, emoji: '🏁', msg: '¡Ya casi! Solo te queda un 10%.' },
    { threshold: 75, emoji: '🔥', msg: '¡Tres cuartas partes conseguidas!' },
    { threshold: 50, emoji: '⚡', msg: '¡Llevas la mitad! Sigue así.' },
    { threshold: 25, emoji: '🌱', msg: 'Buen comienzo, ¡ya tienes un cuarto!' },
  ]
  for (const m of milestones) {
    // Solo avisar el día exacto que se cruza (dentro de ±1%)
    if (pct >= m.threshold && pct < m.threshold + 1) {
      return {
        title: `${m.emoji} ${m.threshold}% de ${goal.emoji} ${goal.name}`,
        body: m.msg,
        tag: `milestone-${goal.id}-${m.threshold}`,
      }
    }
  }
  return null
}

// 4. Cerca del objetivo: menos de 50€ o menos del 5% para terminar
function checkAlmostDone(goal: Goal): Notif | null {
  const remaining = goal.target_price - goal.saved_amount
  const pct = percentage(goal)
  if (pct < 85 || remaining <= 0) return null
  if (remaining > 50 && pct < 95) return null
  return {
    title: `🎯 ¡Casi lo tienes! ${goal.emoji} ${goal.name}`,
    body: `Solo te faltan €${remaining.toFixed(0)} para completar tu meta. ¡Un último esfuerzo!`,
    tag: `almostdone-${goal.id}`,
  }
}

// 5. Meta recién creada sin depósitos (recordatorio a los 3 días)
function checkNewGoalNeverDeposited(goal: Goal): Notif | null {
  if (goal.deposits && goal.deposits.length > 0) return null
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(goal.created_at).getTime()) / 86400000
  )
  if (daysSinceCreated !== 3) return null
  return {
    title: `💡 ¿Empezamos? ${goal.emoji} ${goal.name}`,
    body: `Creaste esta meta hace 3 días pero aún no has hecho tu primer aporte. ¡El primero es el más importante!`,
    tag: `firstdeposit-${goal.id}`,
  }
}

// 6. Racha semanal: has ahorrado todos los últimos 7 días
function checkWeeklyStreak(goal: Goal): Notif | null {
  if (!goal.deposits || goal.deposits.length < 7) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    const day = new Date(today)
    day.setDate(day.getDate() - i)
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)
    const hasDeposit = goal.deposits.some(d => {
      const dd = new Date(d.created_at)
      return dd >= day && dd < nextDay
    })
    if (!hasDeposit) return null
  }
  return {
    title: `🔥 ¡7 días seguidos! ${goal.emoji} ${goal.name}`,
    body: `Llevas una semana ahorrando cada día. ¡Eso es constancia de verdad!`,
    tag: `streak-${goal.id}-${today.toISOString().slice(0, 10)}`,
  }
}

// 7. Estimación optimista: vas a llegar antes de lo esperado
function checkAheadOfSchedule(goal: Goal): Notif | null {
  const daysLeft = estimatedDaysLeft(goal)
  if (!daysLeft || daysLeft > 30) return null
  const avg = avgDepositAmount(goal)
  if (avg <= 0) return null
  // Solo avisar los lunes (día 1 de la semana)
  if (new Date().getDay() !== 1) return null
  return {
    title: `📈 ¡Vas muy bien! ${goal.emoji} ${goal.name}`,
    body: `A este ritmo, completarás tu meta en unos ${daysLeft} días. ¡Sigue así!`,
    tag: `schedule-${goal.id}-${new Date().toISOString().slice(0, 10)}`,
  }
}

// 8. Fin de mes: resumen de lo ahorrado este mes
function checkMonthlyRecap(goal: Goal): Notif | null {
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  // Solo el último día del mes
  if (today.getDate() !== daysInMonth) return null
  const saved = thisMonthSaved(goal)
  if (saved <= 0) return null
  const pct = Math.round(percentage(goal))
  return {
    title: `📊 Resumen de ${today.toLocaleString('es-ES', { month: 'long' })} — ${goal.emoji} ${goal.name}`,
    body: `Este mes ahorraste €${saved.toFixed(0)}. Llevas un ${pct}% del total. ¡Gran trabajo!`,
    tag: `recap-${goal.id}-${today.toISOString().slice(0, 7)}`,
  }
}

// ── Main handler ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const subs = await getAllSubscriptionsWithGoals()
  const results: { user: string; sent: number; errors: number }[] = []

  for (const sub of subs) {
    const notifications: Notif[] = []
    const activeGoals = sub.goals.filter(g => g.saved_amount < g.target_price)
    const allGoals = sub.goals

    for (const goal of activeGoals) {
      const checks = [
        checkInactivity(goal),
        checkMonthlyTarget(goal),
        checkMilestone(goal),
        checkAlmostDone(goal),
        checkNewGoalNeverDeposited(goal),
        checkWeeklyStreak(goal),
        checkAheadOfSchedule(goal),
      ]
      checks.forEach(n => n && notifications.push(n))
    }

    // Recap aplica a todas las metas (activas y completadas)
    for (const goal of allGoals) {
      const recap = checkMonthlyRecap(goal)
      if (recap) notifications.push(recap)
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
        console.error('Push error for', sub.user_id.slice(0, 8), ':', e)
      }
    }

    results.push({ user: sub.user_id.slice(0, 8), sent, errors })
  }

  return NextResponse.json({ ok: true, results })
}
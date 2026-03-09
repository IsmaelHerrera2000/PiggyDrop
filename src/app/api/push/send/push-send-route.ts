// src/app/api/push/send/route.ts
//
// Vercel Cron: se ejecuta diariamente a las 10:00
// vercel.json: { "crons": [{ "path": "/api/push/send", "schedule": "0 10 * * *" }] }
//
// Requiere en .env:
//   CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getAllSubscriptionsWithGoals } from '@/lib/goals'
import { getT } from '@/lib/i18n'
import type { Goal } from '@/types/database'
import type { Locale } from '@/lib/i18n'

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

function estimatedDaysLeft(goal: Goal): number | null {
  if (!goal.deposits || goal.deposits.length < 2) return null
  const sorted = [...goal.deposits].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const totalDays = (new Date(sorted[sorted.length - 1].created_at).getTime() - new Date(sorted[0].created_at).getTime()) / 86400000
  if (totalDays === 0) return null
  const dailyRate = goal.saved_amount / totalDays
  if (dailyRate <= 0) return null
  return Math.ceil((goal.target_price - goal.saved_amount) / dailyRate)
}

// ── Notification builders (locale-aware) ──────────────────────

type Notif = { title: string; body: string; tag: string }

function checkInactivity(goal: Goal, locale: Locale): Notif | null {
  const days = daysSinceLastDeposit(goal)
  if (days === null || days < 7) return null
  const t = getT(locale)
  return {
    title: t.push_inactivity_title(goal.name, goal.emoji),
    body:  t.push_inactivity_body(days),
    tag:   `inactivity-${goal.id}`,
  }
}

function checkMonthlyTarget(goal: Goal, locale: Locale): Notif | null {
  if (!goal.monthly_target || goal.monthly_target <= 0) return null
  const saved = thisMonthSaved(goal)
  const today = new Date()
  if (today.getDate() < 20 || saved >= goal.monthly_target * 0.5) return null
  const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate()
  const t = getT(locale)
  return {
    title: t.push_monthly_title(goal.name, goal.emoji),
    body:  t.push_monthly_body(Math.round(saved), goal.monthly_target, daysLeft),
    tag:   `monthly-${goal.id}`,
  }
}

function checkMilestone(goal: Goal, locale: Locale): Notif | null {
  const pct = percentage(goal)
  const milestones = [
    { threshold: 90, emoji: '🏁', msgKey: '¡Ya casi! Solo te queda un 10%.' },
    { threshold: 75, emoji: '🔥', msgKey: '¡Tres cuartas partes conseguidas!' },
    { threshold: 50, emoji: '⚡', msgKey: '¡Llevas la mitad! Sigue así.' },
    { threshold: 25, emoji: '🌱', msgKey: 'Buen comienzo, ¡ya tienes un cuarto!' },
  ]
  const enMsgs: Record<number, string> = {
    90: "Almost there! Only 10% to go.",
    75: "Three quarters done!",
    50: "Halfway there! Keep it up.",
    25: "Great start — you're a quarter of the way!",
  }
  for (const m of milestones) {
    if (pct >= m.threshold && pct < m.threshold + 1) {
      const t = getT(locale)
      return {
        title: t.push_milestone_title(m.threshold, goal.name, goal.emoji, m.emoji),
        body:  locale === 'en' ? enMsgs[m.threshold] : m.msgKey,
        tag:   `milestone-${goal.id}-${m.threshold}`,
      }
    }
  }
  return null
}

function checkAlmostDone(goal: Goal, locale: Locale): Notif | null {
  const remaining = goal.target_price - goal.saved_amount
  const pct = percentage(goal)
  if (pct < 85 || remaining <= 0) return null
  if (remaining > 50 && pct < 95) return null
  const t = getT(locale)
  return {
    title: t.push_almost_title(goal.name, goal.emoji),
    body:  t.push_almost_body(Math.round(remaining)),
    tag:   `almostdone-${goal.id}`,
  }
}

function checkNewGoalNeverDeposited(goal: Goal, locale: Locale): Notif | null {
  if (goal.deposits && goal.deposits.length > 0) return null
  const daysSince = Math.floor((Date.now() - new Date(goal.created_at).getTime()) / 86400000)
  if (daysSince !== 3) return null
  const t = getT(locale)
  return {
    title: t.push_first_title(goal.name, goal.emoji),
    body:  t.push_first_body,
    tag:   `firstdeposit-${goal.id}`,
  }
}

function checkWeeklyStreak(goal: Goal, locale: Locale): Notif | null {
  if (!goal.deposits || goal.deposits.length < 7) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    const day = new Date(today); day.setDate(day.getDate() - i)
    const next = new Date(day); next.setDate(next.getDate() + 1)
    if (!goal.deposits.some(d => { const dd = new Date(d.created_at); return dd >= day && dd < next })) return null
  }
  const t = getT(locale)
  return {
    title: t.push_streak_title(goal.name, goal.emoji),
    body:  t.push_streak_body,
    tag:   `streak-${goal.id}-${today.toISOString().slice(0, 10)}`,
  }
}

function checkAheadOfSchedule(goal: Goal, locale: Locale): Notif | null {
  const daysLeft = estimatedDaysLeft(goal)
  if (!daysLeft || daysLeft > 30 || new Date().getDay() !== 1) return null
  const t = getT(locale)
  return {
    title: t.push_ahead_title(goal.name, goal.emoji),
    body:  t.push_ahead_body(daysLeft),
    tag:   `schedule-${goal.id}-${new Date().toISOString().slice(0, 10)}`,
  }
}

function checkMonthlyRecap(goal: Goal, locale: Locale): Notif | null {
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  if (today.getDate() !== daysInMonth) return null
  const saved = thisMonthSaved(goal)
  if (saved <= 0) return null
  const t = getT(locale)
  const month = today.toLocaleString(locale === 'en' ? 'en-GB' : 'es-ES', { month: 'long' })
  return {
    title: t.push_recap_title(month, goal.name, goal.emoji),
    body:  t.push_recap_body(Math.round(saved), Math.round(percentage(goal))),
    tag:   `recap-${goal.id}-${today.toISOString().slice(0, 7)}`,
  }
}

// ── Main handler ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const subs = await getAllSubscriptionsWithGoals()
  const results: { user: string; locale: string; sent: number; errors: number }[] = []

  for (const sub of subs) {
    const locale = (sub.locale === 'en' ? 'en' : 'es') as Locale
    const t = getT(locale)
    const notifications: Notif[] = []
    const activeGoals = sub.goals.filter(g => g.saved_amount < g.target_price)

    for (const goal of activeGoals) {
      ;[
        checkInactivity(goal, locale),
        checkMonthlyTarget(goal, locale),
        checkMilestone(goal, locale),
        checkAlmostDone(goal, locale),
        checkNewGoalNeverDeposited(goal, locale),
        checkWeeklyStreak(goal, locale),
        checkAheadOfSchedule(goal, locale),
      ].forEach(n => n && notifications.push(n))
    }

    for (const goal of sub.goals) {
      const recap = checkMonthlyRecap(goal, locale)
      if (recap) notifications.push(recap)
    }

    let sent = 0, errors = 0
    for (const notif of notifications) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: notif.title,
            body:  notif.body,
            tag:   notif.tag,
            icon:  '/icons/icon-192.png',
            badge: '/icons/icon-96.png',
            data:  { url: '/dashboard' },
            actions: [
              { action: 'open',  title: t.push_view_goals },
              { action: 'close', title: t.push_dismiss },
            ],
          })
        )
        sent++
      } catch (e) {
        errors++
        console.error('Push error:', e)
      }
    }

    results.push({ user: sub.user_id.slice(0, 8), locale, sent, errors })
  }

  return NextResponse.json({ ok: true, results })
}

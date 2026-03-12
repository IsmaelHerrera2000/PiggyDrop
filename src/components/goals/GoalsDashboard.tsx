'use client'
// src/components/goals/GoalsDashboard.tsx

import { useState, useTransition, useEffect, useRef, useCallback } from 'react'
import type { Goal, Deposit } from '@/types/database'
import { createGoalAction, addDepositAction, deleteGoalAction, updateGoalAction, deleteDepositAction, subscribePushAction, unsubscribePushAction, toggleGoalPublicAction, toggleGoalShowAmountsAction } from '@/app/dashboard/actions'
import ProgressChart from '@/components/goals/ProgressChart'
import { detectLocale, getT } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'

type Filter = 'all' | 'active' | 'completed' | 'history'
type Category =
  | 'todas' | 'tecnología' | 'viajes' | 'moda' | 'hogar' | 'ocio' | 'otro'
  | 'belleza' | 'salud' | 'deporte' | 'mascotas' | 'educación'
  | 'coche' | 'música' | 'fotografía' | 'coleccionismo' | 'regalo'

const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: 'todas',         label: 'Todas',          emoji: '✨' },
  { key: 'tecnología',    label: 'Tecnología',     emoji: '💻' },
  { key: 'viajes',        label: 'Viajes',         emoji: '✈️' },
  { key: 'moda',          label: 'Moda',           emoji: '👟' },
  { key: 'belleza',       label: 'Belleza',        emoji: '💅' },
  { key: 'salud',         label: 'Salud',          emoji: '🏥' },
  { key: 'deporte',       label: 'Deporte',        emoji: '🏋️' },
  { key: 'hogar',         label: 'Hogar',          emoji: '🏠' },
  { key: 'mascotas',      label: 'Mascotas',       emoji: '🐾' },
  { key: 'educación',     label: 'Educación',      emoji: '📚' },
  { key: 'coche',         label: 'Coche',          emoji: '🚗' },
  { key: 'música',        label: 'Música',         emoji: '🎵' },
  { key: 'fotografía',    label: 'Fotografía',     emoji: '📷' },
  { key: 'coleccionismo', label: 'Coleccionismo',  emoji: '🪆' },
  { key: 'regalo',        label: 'Regalo',         emoji: '🎁' },
  { key: 'ocio',          label: 'Ocio',           emoji: '🎮' },
  { key: 'otro',          label: 'Otro',           emoji: '🎯' },
]

function getEstimatedDate(goal: Goal, locale: Locale): string | null {
  if (!goal.deposits || goal.deposits.length < 2) return null
  const remaining = goal.target_price - goal.saved_amount
  if (remaining <= 0) return null
  const sorted = [...goal.deposits].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const first = new Date(sorted[0].created_at).getTime()
  const last = new Date(sorted[sorted.length - 1].created_at).getTime()
  const totalDays = (last - first) / (1000 * 60 * 60 * 24)
  if (totalDays < 1) return null
  const totalSavedInPeriod = sorted.reduce((s, d) => s + d.amount, 0)
  const ratePerDay = totalSavedInPeriod / totalDays
  if (ratePerDay <= 0) return null
  const daysLeft = Math.ceil(remaining / ratePerDay)
  const isEN = locale === 'en'
  if (daysLeft < 30) return `~${daysLeft} ${isEN ? 'days' : 'días'}`
  if (daysLeft < 365) return `~${Math.round(daysLeft / 30)} ${isEN ? 'months' : 'meses'}`
  return `~${(daysLeft / 365).toFixed(1)} ${isEN ? 'years' : 'años'}`
}

// ── Monthly target helpers ───────────────────────────────────
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

function thisWeekSaved(goal: Goal): number {
  if (!goal.deposits) return 0
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek); weekStart.setHours(0,0,0,0)
  return goal.deposits.filter(d => new Date(d.created_at) >= weekStart).reduce((s, d) => s + d.amount, 0)
}

function calcStreak(goal: Goal): number {
  if (!goal.deposits || goal.deposits.length === 0) return 0
  // Build set of unique deposit days (YYYY-MM-DD)
  const days = new Set(goal.deposits.map(d => d.created_at.slice(0, 10)))
  let streak = 0
  const today = new Date()
  // Start from today and walk backwards; allow today OR yesterday as "current"
  let check = new Date(today)
  // If no deposit today, start from yesterday (streak not broken yet today)
  if (!days.has(check.toISOString().slice(0, 10))) check.setDate(check.getDate() - 1)
  while (days.has(check.toISOString().slice(0, 10))) {
    streak++
    check.setDate(check.getDate() - 1)
  }
  return streak
}

function periodStatus(goal: Goal): { saved: number; target: number; ok: boolean; daysLeft: number; period: 'monthly' | 'weekly' } | null {
  if (!goal.monthly_target || goal.monthly_target <= 0) return null
  const period = (goal.savings_period === 'weekly' ? 'weekly' : 'monthly') as 'monthly' | 'weekly'
  const now = new Date()
  if (period === 'weekly') {
    const saved = thisWeekSaved(goal)
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
    const daysLeft = 6 - dayOfWeek
    return { saved, target: goal.monthly_target, ok: saved >= goal.monthly_target, daysLeft, period }
  } else {
    const saved = thisMonthSaved(goal)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysLeft = daysInMonth - now.getDate()
    return { saved, target: goal.monthly_target, ok: saved >= goal.monthly_target, daysLeft, period }
  }
}
const monthlyStatus = periodStatus

// ── Push notifications hook ───────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission)
    }
    // Check if already subscribed
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setSubscribed(!!sub)
        })
      }).catch(() => {})
    }
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') { setLoading(false); return false }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) { setSubscribed(true); setLoading(false); return true }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { console.error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY'); setLoading(false); return false }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      })

      const json = sub.toJSON()
      await subscribePushAction({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        locale: detectLocale(),
      })

      setSubscribed(true)
      setLoading(false)
      return true
    } catch (e) {
      console.error('Push subscribe error:', e)
      setLoading(false)
      return false
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await unsubscribePushAction(sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (e) {
      console.error('Push unsubscribe error:', e)
    }
    setLoading(false)
  }, [])

  return { permission, subscribed, loading, subscribe, unsubscribe }
}


// ── Confetti ─────────────────────────────────────────────────
function Confetti({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const colors = ['#FF6B35', '#4ECDC4', '#FFE66D', '#A78BFA', '#FF8FAB', '#6BCB77', '#fff']
    const pieces = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 100,
      r: 4 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      angle: Math.random() * 360,
      spin: (Math.random() - 0.5) * 8,
      shape: (Math.random() > 0.5 ? 'rect' : 'circle') as 'rect' | 'circle',
    }))
    let frame = 0
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pieces.forEach((p) => {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.angle * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.globalAlpha = Math.max(0, 1 - frame / 120)
        if (p.shape === 'rect') ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6)
        else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill() }
        ctx.restore()
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.angle += p.spin
      })
      frame++
      if (frame < 140) requestAnimationFrame(animate)
      else onDone()
    }
    animate()
  }, [onDone])
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }} />
}

// ── ErrorMsg ─────────────────────────────────────────────────
function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ fontSize: '12px', color: '#ff8080', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
      ⚠️ {msg}
    </div>
  )
}

// ── CircularProgress ─────────────────────────────────────────
function CircularProgress({ percentage, color, size = 120, strokeWidth = 10 }: {
  percentage: number; color: string; size?: number; strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth}/>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  )
}



// ── Skeleton ─────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '24px', animation: 'shimmer 1.5s linear infinite', backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%)', backgroundSize: '200% auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.08)' }}/>
        <div style={{ flex: 1 }}>
          <div style={{ height: '16px', width: '60%', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', marginBottom: '8px' }}/>
          <div style={{ height: '12px', width: '40%', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}/>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}/>
        <div style={{ flex: 1 }}>
          <div style={{ height: '22px', width: '50%', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', marginBottom: '12px' }}/>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px' }}/>
        </div>
      </div>
    </div>
  )
}

// ── EditDepositModal ──────────────────────────────────────────
function EditDepositModal({ deposit, onClose, onSave, isPending, locale }: {
  deposit: { id: string; amount: number; note: string; goalId: string }
  onClose: () => void
  onSave: (id: string, goalId: string, amount: number, note: string) => void
  isPending: boolean
  locale: Locale
}) {
  const t = getT(locale)
  const [amount, setAmount] = useState(String(deposit.amount))
  const [note, setNote] = useState(deposit.note || '')
  const [err, setErr] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '28px', width: '100%', maxWidth: '380px', animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '18px', color: '#f0f0f5', marginBottom: '20px' }}>{t.editDeposit}</div>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.newAmountLabel}</label>
          <input type="text" inputMode="decimal" value={amount}
            onChange={e => { if (/^\d*\.?\d{0,2}$/.test(e.target.value) || e.target.value === '') { setAmount(e.target.value); setErr('') } }}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${err ? '#ff6060' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '18px', fontFamily: "'Nunito', sans-serif", fontWeight: '800', outline: 'none', boxSizing: 'border-box' as const }}/>
          {err && <div style={{ fontSize: '12px', color: '#ff8080', marginTop: '4px' }}>⚠️ {err}</div>}
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.newNoteLabel}</label>
          <input type="text" value={note} onChange={e => { if (e.target.value.length <= 60) setNote(e.target.value) }}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}/>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>{t.cancel}</button>
          <button onClick={() => {
            const v = parseFloat(amount)
            if (!amount || isNaN(v) || v <= 0) { setErr(t.errorAmountZero); return }
            onSave(deposit.id, deposit.goalId, v, note.trim())
          }} disabled={isPending} style={{ flex: 2, padding: '13px', borderRadius: '12px', background: 'linear-gradient(135deg, #FF6B35, #FF8FAB)', border: 'none', color: '#fff', fontSize: '14px', fontFamily: "'Nunito', sans-serif", fontWeight: '800', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? '...' : t.saveDeposit}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ShareButton ──────────────────────────────────────────────
function ShareButton({ goal, t, menuStyle }: { goal: Goal; t: ReturnType<typeof getT>; menuStyle?: boolean }) {
  const [copied, setCopied] = useState(false)
  const pct = Math.min(100, Math.round((goal.saved_amount / goal.target_price) * 100))
  const handleShare = async () => {
    const text = t.shareText(goal.name, goal.emoji, pct, Math.round(goal.saved_amount), goal.target_price)
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {}
  }
  if (menuStyle) return (
    <button onClick={handleShare} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 12px', borderRadius: '10px',
      background: copied ? 'rgba(78,205,196,0.1)' : 'transparent',
      border: 'none', color: copied ? '#4ECDC4' : 'rgba(255,255,255,0.6)',
      fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' as const,
    }}>
      <span>📤</span><span>{copied ? t.shareCopied : t.shareGoal}</span>
    </button>
  )
  return (
    <button onClick={handleShare} style={{
      background: copied ? 'rgba(78,205,196,0.15)' : 'rgba(255,255,255,0.06)',
      border: `1px solid ${copied ? 'rgba(78,205,196,0.4)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: '10px', padding: '8px 14px', color: copied ? '#4ECDC4' : 'rgba(255,255,255,0.6)',
      fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
      transition: 'all 0.2s',
    }}>
      {copied ? t.shareCopied : t.shareGoal}
    </button>
  )
}

// ── GoalCard ─────────────────────────────────────────────────
function GoalCard({ goal, onClick, locale, pinned, onPin, hideAmounts, deleting }: {
  goal: Goal & { category?: string }; onClick: (g: Goal) => void; locale: Locale
  pinned?: boolean; onPin?: () => void; hideAmounts?: boolean; deleting?: boolean
}) {
  const t = getT(locale)
  const percentage = Math.min(100, Math.round((goal.saved_amount / goal.target_price) * 100))
  const remaining = goal.target_price - goal.saved_amount
  const isComplete = percentage >= 100
  const eta = getEstimatedDate(goal, locale)
  const catInfo = CATEGORIES.find(c => c.key === (goal.category ?? 'otro'))
  const monthly = monthlyStatus(goal)
  const showMonthlyWarn = !isComplete && monthly && !monthly.ok && new Date().getDate() >= 15
  const daysSinceLast = (() => {
    if (!goal.deposits || goal.deposits.length === 0 || isComplete) return null
    const sorted = [...goal.deposits].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const days = Math.floor((Date.now() - new Date(sorted[0].created_at).getTime()) / 86400000)
    return days >= 7 ? days : null
  })()
  const almostDone = !isComplete && percentage >= 90
  const streak = calcStreak(goal)
  const hasBadgeTop = isComplete || almostDone || daysSinceLast !== null || pinned || streak >= 3

  return (
    <div onClick={() => onClick(goal)} style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${pinned ? goal.color + '50' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '20px', padding: '24px', cursor: 'pointer',
      transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)', position: 'relative', overflow: 'hidden',
      boxShadow: pinned ? `0 0 24px ${goal.color}18` : 'none',
      opacity: deleting ? 0 : 1,
      transform: deleting ? 'scale(0.94) translateY(8px)' : 'scale(1)',
    }}
      onMouseEnter={(e) => { if (!deleting) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = goal.color + '60'; e.currentTarget.style.boxShadow = `0 20px 40px ${goal.color}20` } }}
      onMouseLeave={(e) => { if (!deleting) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = pinned ? goal.color + '50' : 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = pinned ? `0 0 24px ${goal.color}18` : 'none' } }}
    >
      {/* Top-right badge cluster */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', maxWidth: '60%', justifyContent: 'flex-end' }}>
        {streak >= 3 && <span style={{
          background: streak >= 7 ? 'rgba(255,107,53,0.18)' : 'rgba(255,160,50,0.13)',
          border: `1px solid ${streak >= 7 ? 'rgba(255,107,53,0.5)' : 'rgba(255,160,50,0.35)'}`,
          color: streak >= 7 ? '#FF6B35' : '#FFB347',
          fontSize: '9px', fontWeight: '800', padding: '2px 7px', borderRadius: '20px',
          animation: streak >= 7 ? 'pulse 1.8s ease-in-out infinite' : 'none',
        }}>🔥 {streak}{locale === 'en' ? 'd' : 'd'}</span>}
        {almostDone && <span style={{ background: 'rgba(255,230,50,0.13)', border: '1px solid rgba(255,230,50,0.35)', color: '#FFE066', fontSize: '9px', fontWeight: '800', padding: '2px 7px', borderRadius: '20px' }}>🏁 {t.almostDone}</span>}
        {daysSinceLast && <span style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: 'rgba(255,130,130,0.9)', fontSize: '9px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px' }}>⏰ {t.daysInactive(daysSinceLast)}</span>}
        {isComplete && <span style={{ background: '#4ECDC4', color: '#0a0a0f', fontSize: '9px', fontWeight: '800', padding: '2px 8px', borderRadius: '20px', letterSpacing: '0.5px' }}>✓ LISTO</span>}
        {onPin && (
          <button onClick={(e) => { e.stopPropagation(); onPin() }} title={pinned ? t.unpinGoal : t.pinGoal}
            style={{ background: pinned ? goal.color + '22' : 'rgba(255,255,255,0.07)', border: `1px solid ${pinned ? goal.color + '50' : 'rgba(255,255,255,0.12)'}`, borderRadius: '8px', padding: '3px 6px', fontSize: '10px', cursor: 'pointer', color: pinned ? goal.color : 'rgba(255,255,255,0.3)', lineHeight: 1, transition: 'all 0.2s' }}>
            📌
          </button>
        )}
      </div>

      {/* Category badge — shown inline above the name, not overlapping icon */}

      {showMonthlyWarn && (
        <div style={{ background: 'rgba(255,200,50,0.1)', border: '1px solid rgba(255,200,50,0.3)', borderRadius: '8px', padding: '6px 10px', marginBottom: '10px', fontSize: '11px', color: '#FFE066', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ⚠️ {monthly!.period === 'weekly' ? (locale === 'en' ? 'This week' : 'Esta semana') : t.monthThisLabel} {hideAmounts ? '•••• / ••••' : `€${monthly!.saved.toFixed(0)} / €${monthly!.target}`} — {locale === 'en' ? `${monthly!.daysLeft} days left` : `faltan ${monthly!.daysLeft} días`}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', marginTop: hasBadgeTop ? '26px' : '4px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: goal.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: `1px solid ${goal.color}30`, flexShrink: 0 }}>{goal.emoji}</div>
        <div style={{ minWidth: 0 }}>
          {!isComplete && catInfo && catInfo.key !== 'todas' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '9px', fontWeight: '600', padding: '1px 7px', borderRadius: '20px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>{catInfo.emoji} {catInfo.label}</div>
          )}
          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '16px', color: '#f0f0f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.name}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
            {isComplete ? t.goalReached : (hideAmounts ? '••••' : t.remainingShort(remaining, goal.currency))}
            {!isComplete && eta && <span style={{ color: goal.color + 'aa', marginLeft: '6px' }}>· {eta}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <CircularProgress percentage={percentage} color={goal.color} size={72} strokeWidth={7}/>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '14px', color: goal.color }}>{percentage}%</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '22px', color: '#f0f0f5' }}>{hideAmounts ? '••••' : `${goal.currency}${goal.saved_amount.toLocaleString()}`}</span>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', alignSelf: 'flex-end', marginBottom: '2px', whiteSpace: 'nowrap' }}>{t.of} {hideAmounts ? '••••' : `${goal.currency}${goal.target_price.toLocaleString()}`}</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: `linear-gradient(90deg, ${goal.color}88, ${goal.color})`, borderRadius: '100px', width: `${percentage}%`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)', boxShadow: `0 0 10px ${goal.color}80` }}/>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── TotalPill ────────────────────────────────────────────────
function TotalPill({ totalSaved, currentFilter, onFilterClick, locale, hideAmounts }: { totalSaved: number; currentFilter: Filter; onFilterClick: (f: Filter) => void; locale: Locale; hideAmounts?: boolean }) {
  const t = getT(locale)
  const isActive = currentFilter === 'history'
  return (
    <div onClick={() => onFilterClick('history')} style={{ background: isActive ? 'rgba(255,107,53,0.18)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isActive ? 'rgba(255,107,53,0.5)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '16px', padding: '16px 14px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', transform: isActive ? 'translateY(-2px)' : 'none', boxShadow: isActive ? '0 0 20px rgba(255,107,53,0.2)' : 'none', position: 'relative' as const }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,107,53,0.3)' }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
    >
      {isActive && <div style={{ position: 'absolute', top: '6px', right: '8px', fontSize: '8px', color: '#FF6B35', fontWeight: '800' }}>● FILTRO</div>}
      <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '18px', color: '#FF6B35', marginBottom: '4px' }}>{hideAmounts ? '••••' : `€${totalSaved.toLocaleString()}`}</div>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '600' }}>{t.totalSavedSmall}</div>
    </div>
  )
}

// ── StatPill ─────────────────────────────────────────────────
function StatPill({ label, value, color, filterKey, currentFilter, onFilterClick }: { label: string; value: number | string; color: string; filterKey: Filter; currentFilter: Filter; onFilterClick: (f: Filter) => void }) {
  const isActive = currentFilter === filterKey
  return (
    <div onClick={() => onFilterClick(filterKey)} style={{ background: isActive ? color + '18' : 'rgba(255,255,255,0.04)', border: `1px solid ${isActive ? color + '50' : 'rgba(255,255,255,0.07)'}`, borderRadius: '16px', padding: '16px 14px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isActive ? `0 0 20px ${color}20` : 'none', transform: isActive ? 'translateY(-2px)' : 'none', position: 'relative' as const }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = color + '30' }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
    >
      {isActive && <div style={{ position: 'absolute', top: '6px', right: '8px', fontSize: '8px', color, fontWeight: '800' }}>● FILTRO</div>}
      <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '18px', color, marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '600' }}>{label}</div>
    </div>
  )
}

// ── EditGoalModal ─────────────────────────────────────────────
function EditGoalModal({ goal, onClose, onSave, isPending, locale }: {
  goal: Goal & { category?: string }
  onClose: () => void
  onSave: (goalId: string, updates: { name: string; emoji: string; color: string; target_price: number; category: string; monthly_target: number | null; savings_period: 'monthly' | 'weekly' | null; description: string | null; target_date: string | null }) => void
  isPending: boolean
  locale: Locale
}) {
  const t = getT(locale)
  const [name, setName] = useState(goal.name)
  const [emoji, setEmoji] = useState(goal.emoji)
  const [color, setColor] = useState(goal.color)
  const [price, setPrice] = useState(String(goal.target_price))
  const [category, setCategory] = useState<Category>((goal.category as Category) ?? 'otro')
  const [monthlyTarget, setMonthlyTarget] = useState(goal.monthly_target ? String(goal.monthly_target) : '')
  const [savingsPeriod, setSavingsPeriod] = useState<'none'|'monthly'|'weekly'>(goal.monthly_target ? ((goal.savings_period === 'weekly' ? 'weekly' : 'monthly')) : 'none')
  const [description, setDescription] = useState((goal as Goal & { description?: string | null }).description ?? '')
  const [targetDate, setTargetDate] = useState((goal as Goal & { target_date?: string | null }).target_date ?? '')
  const [errors, setErrors] = useState<{ name?: string; price?: string; monthly?: string }>({})
  const [submitted, setSubmitted] = useState(false)

  const colors = ['#FF6B35', '#4ECDC4', '#FFE66D', '#A78BFA', '#FF8FAB', '#6BCB77', '#38BDF8', '#FB923C']
  const emojis = ['🎯', '💻', '📱', '🎧', '⌚', '🎮', '✈️', '🏖️', '🗺️', '👟', '👜', '🧣', '💅', '💄', '🧴', '💊', '🏋️', '🧘', '🏠', '🛋️', '🪴', '🔑', '🐶', '🐱', '🦜', '📚', '🎓', '🔬', '🚗', '🔧', '🎵', '🎸', '🎹', '📷', '🪆', '🎁', '💰', '🐷']

  const validate = (n = name, p = price) => {
    const e: { name?: string; price?: string } = {}
    if (!n.trim()) e.name = t.errorNameRequired
    else if (n.trim().length < 2) e.name = t.errorNameShort
    if (!p || isNaN(parseFloat(p)) || parseFloat(p) <= 0) e.price = t.errorPriceInvalid
    else if (parseFloat(p) < goal.saved_amount) e.price = `Debe ser ≥ lo ya ahorrado (€${goal.saved_amount})`
    return e
  }

  const handleSubmit = () => {
    setSubmitted(true)
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    const mt = savingsPeriod !== 'none' && monthlyTarget && parseFloat(monthlyTarget) > 0 ? parseFloat(monthlyTarget) : null
    const sp = savingsPeriod !== 'none' && mt ? savingsPeriod : null
    onSave(goal.id, { name: name.trim(), emoji, color, target_price: parseFloat(price), category, monthly_target: mt, savings_period: sp, description: description.trim() || null, target_date: targetDate || null })
  }

  const handlePriceChange = (val: string) => {
    if (val !== '' && !/^\d*\.?\d{0,2}$/.test(val)) return
    setPrice(val)
    if (submitted) setErrors(prev => ({ ...prev, price: validate(name, val).price }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '440px', animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '90vh', overflowY: 'auto' as const }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '22px', color: '#f0f0f5', marginBottom: '24px' }}>
          {t.editGoalTitle}
        </div>

        {/* Categoría */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.categoryLabel}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {CATEGORIES.filter(c => c.key !== 'todas').map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: category === c.key ? color + '25' : 'rgba(255,255,255,0.05)', border: `1px solid ${category === c.key ? color + '60' : 'rgba(255,255,255,0.1)'}`, color: category === c.key ? color : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>{c.emoji} {({todas: t.cat_todas, 'tecnología': t.cat_tecnología, viajes: t.cat_viajes, moda: t.cat_moda, belleza: t.cat_belleza, salud: t.cat_salud, deporte: t.cat_deporte, hogar: t.cat_hogar, mascotas: t.cat_mascotas, 'educación': t.cat_educación, coche: t.cat_coche, 'música': t.cat_música, 'fotografía': t.cat_fotografía, coleccionismo: t.cat_coleccionismo, regalo: t.cat_regalo, ocio: t.cat_ocio, otro: t.cat_otro} as Record<string,string>)[c.key] ?? c.label}</button>
            ))}
          </div>
        </div>

        {/* Emoji */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.emojiLabel}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {emojis.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} style={{ width: '40px', height: '40px', borderRadius: '10px', fontSize: '20px', background: emoji === e ? color + '30' : 'rgba(255,255,255,0.05)', border: `1px solid ${emoji === e ? color + '60' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer' }}>{e}</button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.colorLabel}</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {colors.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: c, border: `3px solid ${color === c ? '#fff' : 'transparent'}`, cursor: 'pointer', boxShadow: color === c ? `0 0 12px ${c}80` : 'none' }}/>
            ))}
          </div>
        </div>

        {/* Nombre */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.nameLabel}</label>
          <input type="text" value={name}
            onChange={(e) => { if (e.target.value.length <= 40) { setName(e.target.value); if (submitted) setErrors(prev => ({ ...prev, name: validate(e.target.value, price).name })) } }}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${errors.name ? '#ff6060' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <ErrorMsg msg={errors.name || ''} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>{name.length}/40</span>
          </div>
        </div>

        {/* Precio */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.targetPriceLabel}</label>
          <input type="text" inputMode="decimal" value={price}
            onChange={(e) => handlePriceChange(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${errors.price ? '#ff6060' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
          <ErrorMsg msg={errors.price || ''} />
          {goal.saved_amount > 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>
              {t.alreadySavedNote(goal.saved_amount)}
            </div>
          )}
        </div>

        {/* Descripción */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
            {t.descriptionLabel} <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>{t.descriptionHint}</span>
          </label>
          <input type="text" value={description} onChange={(e) => { if (e.target.value.length <= 120) setDescription(e.target.value) }}
            placeholder={t.descriptionPlaceholder}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}/>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '4px', textAlign: 'right' }}>{description.length}/120</div>
        </div>

        {/* Fecha objetivo */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
            {t.targetDateLabel} <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>{t.targetDateHint}</span>
          </label>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 16px', color: targetDate ? '#f0f0f5' : 'rgba(255,255,255,0.25)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, colorScheme: 'dark' }}/>
          {targetDate && (() => {
            const daysLeft = Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000)
            const monthsLeft = daysLeft / 30
            const needed = monthsLeft > 0 ? Math.ceil((goal.target_price - goal.saved_amount) / monthsLeft) : 0
            if (daysLeft < 0) return <div style={{ fontSize: '11px', color: '#FF6B35', marginTop: '6px' }}>{t.targetDatePassed}</div>
            return needed > 0 ? <div style={{ fontSize: '11px', color: '#4ECDC4', marginTop: '6px' }}>💡 {t.needPerMonth(needed)}</div> : null
          })()}
        </div>

        {/* Objetivo de ahorro periódico */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
            {locale === 'en' ? 'SAVINGS TARGET' : 'OBJETIVO DE AHORRO'} <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>{locale === 'en' ? '(optional)' : '(opcional)'}</span>
          </label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            {(['none', 'monthly', 'weekly'] as const).map(p => (
              <button key={p} onClick={() => setSavingsPeriod(p)}
                style={{ flex: 1, padding: '8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700',
                  background: savingsPeriod === p ? 'rgba(255,107,53,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${savingsPeriod === p ? 'rgba(255,107,53,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: savingsPeriod === p ? '#FF6B35' : 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                {p === 'none' ? (locale === 'en' ? 'None' : 'Ninguno') : p === 'monthly' ? (locale === 'en' ? '📅 Monthly' : '📅 Mensual') : (locale === 'en' ? '📆 Weekly' : '📆 Semanal')}
              </button>
            ))}
          </div>
          {savingsPeriod !== 'none' && (
            <input type="text" inputMode="decimal" value={monthlyTarget}
              onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setMonthlyTarget(e.target.value) }}
              placeholder={locale === 'en' ? `Target per ${savingsPeriod === 'weekly' ? 'week' : 'month'} (e.g. 50)` : `Meta por ${savingsPeriod === 'weekly' ? 'semana' : 'mes'} (ej: 50)`}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>{t.cancel}</button>
          <button onClick={handleSubmit} disabled={isPending} style={{ flex: 2, padding: '14px', borderRadius: '12px', background: `linear-gradient(135deg, ${color}, ${color}cc)`, border: 'none', color: '#fff', fontSize: '14px', fontFamily: "'Nunito', sans-serif", fontWeight: '800', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? t.saving : t.saveChanges}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AddDepositModal ──────────────────────────────────────────
function AddDepositModal({ goal, onClose, onDeposit, isPending, locale }: {
  goal: Goal; onClose: () => void
  onDeposit: (goalId: string, amount: number, note: string) => void
  isPending: boolean
  locale: Locale
}) {
  const t = getT(locale)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [amountError, setAmountError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const remaining = goal.target_price - goal.saved_amount

  const validateAmount = (val: string) => {
    if (!val) return t.errorAmountRequired
    if (isNaN(parseFloat(val))) return t.errorAmountNaN
    if (parseFloat(val) <= 0) return t.errorAmountZero
    if (parseFloat(val) > 999999) return t.errorAmountTooHigh
    return ''
  }

  const handleAmountChange = (val: string) => {
    if (val !== '' && !/^\d*\.?\d{0,2}$/.test(val)) return
    setAmount(val)
    if (submitted) setAmountError(validateAmount(val))
  }

  const handleSubmit = () => {
    setSubmitted(true)
    const err = validateAmount(amount)
    if (err) { setAmountError(err); return }
    onDeposit(goal.id, parseFloat(amount), note.trim() || t.depositFallback)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '400px', animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: goal.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{goal.emoji}</div>
          <div>
            <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '18px', color: '#f0f0f5' }}>{t.addSavingTitle}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{goal.name}</div>
          </div>
        </div>
        <div style={{ background: goal.color + '12', border: `1px solid ${goal.color}25`, borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{t.remainingForGoal}</span>
          <span style={{ color: goal.color, fontWeight: '700' }}>{goal.currency}{remaining.toLocaleString()}</span>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.amountLabel} ({goal.currency})</label>
          <input type="text" inputMode="decimal" value={amount} onChange={(e) => handleAmountChange(e.target.value)} onBlur={() => { if (amount) setAmountError(validateAmount(amount)) }} placeholder="0.00" autoFocus
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${amountError ? '#ff6060' : amount ? goal.color + '60' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '16px', color: '#f0f0f5', fontSize: '20px', fontFamily: "'Nunito', sans-serif", fontWeight: '800', outline: 'none', boxSizing: 'border-box' as const }}/>
          <ErrorMsg msg={amountError} />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>NOTA <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>(opcional)</span></label>
          <input type="text" value={note} onChange={(e) => { if (e.target.value.length <= 60) setNote(e.target.value) }} {...{placeholder: t.placeholderNote}}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}/>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '4px', textAlign: 'right' }}>{note.length}/60</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>{t.cancel}</button>
          <button onClick={handleSubmit} disabled={isPending} style={{ flex: 2, padding: '14px', borderRadius: '12px', background: `linear-gradient(135deg, ${goal.color}, ${goal.color}cc)`, border: 'none', color: '#fff', fontSize: '14px', fontFamily: "'Nunito', sans-serif", fontWeight: '800', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? '...' : t.addSaving}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── NewGoalModal ─────────────────────────────────────────────
function NewGoalModal({ onClose, onCreate, isPending, locale }: {
  onClose: () => void
  onCreate: (goal: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deposits' | 'is_public' | 'public_show_amounts'> & { category: Category; monthly_target: number | null; savings_period: 'monthly' | 'weekly' | null; is_public?: boolean; public_show_amounts?: boolean; description: string | null; target_date: string | null }) => void
  isPending: boolean
  locale: Locale
}) {
  const t = getT(locale)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [price, setPrice] = useState('')
  const [initial, setInitial] = useState('')
  const [category, setCategory] = useState<Category>('otro')
  const [monthlyTarget, setMonthlyTarget] = useState('')
  const [savingsPeriod, setSavingsPeriod] = useState<'none'|'monthly'|'weekly'>('none')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [currency, setCurrency] = useState('€')
  const [errors, setErrors] = useState<{ name?: string; price?: string; initial?: string }>({})
  const [submitted, setSubmitted] = useState(false)
  const colors = ['#FF6B35', '#4ECDC4', '#FFE66D', '#A78BFA', '#FF8FAB', '#6BCB77', '#38BDF8', '#FB923C']
  const [color, setColor] = useState(colors[0])
  const emojis = ['🎯', '💻', '📱', '🎧', '⌚', '🎮', '✈️', '🏖️', '🗺️', '👟', '👜', '🧣', '💅', '💄', '🧴', '💊', '🏋️', '🧘', '🏠', '🛋️', '🪴', '🔑', '🐶', '🐱', '🦜', '📚', '🎓', '🔬', '🚗', '🔧', '🎵', '🎸', '🎹', '📷', '🪆', '🎁', '💰', '🐷']

  const validate = (n = name, p = price, i = initial) => {
    const e: { name?: string; price?: string; initial?: string } = {}
    if (!n.trim()) e.name = t.errorNameRequired
    else if (n.trim().length < 2) e.name = t.errorNameShort
    if (!p) e.price = t.errorPriceRequired
    else if (isNaN(parseFloat(p)) || parseFloat(p) <= 0) e.price = t.errorPriceInvalid
    else if (parseFloat(p) > 9999999) e.price = t.errorPriceTooHigh
    if (i && (isNaN(parseFloat(i)) || parseFloat(i) < 0)) e.initial = t.errorInitialInvalid
    if (i && p && parseFloat(i) >= parseFloat(p)) e.initial = t.errorInitialTooHigh
    return e
  }

  const handleSubmit = () => {
    setSubmitted(true)
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    const mt = savingsPeriod !== 'none' && monthlyTarget && parseFloat(monthlyTarget) > 0 ? parseFloat(monthlyTarget) : null
    const sp = savingsPeriod !== 'none' && mt ? savingsPeriod : null
    onCreate({ name: name.trim(), emoji, color, target_price: parseFloat(price), saved_amount: parseFloat(initial) || 0, currency, category, monthly_target: mt, savings_period: sp, description: description.trim() || null, target_date: targetDate || null })
  }

  const handleNumericChange = (val: string, setter: (v: string) => void, field: 'price' | 'initial') => {
    if (val !== '' && !/^\d*\.?\d{0,2}$/.test(val)) return
    setter(val)
    if (submitted) setErrors(validate(name, field === 'price' ? val : price, field === 'initial' ? val : initial))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '440px', animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '90vh', overflowY: 'auto' as const }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '22px', color: '#f0f0f5', marginBottom: '24px' }}>{t.newGoalTitle}</div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.categoryLabel}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {CATEGORIES.filter(c => c.key !== 'todas').map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: category === c.key ? color + '25' : 'rgba(255,255,255,0.05)', border: `1px solid ${category === c.key ? color + '60' : 'rgba(255,255,255,0.1)'}`, color: category === c.key ? color : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>{c.emoji} {({todas: t.cat_todas, 'tecnología': t.cat_tecnología, viajes: t.cat_viajes, moda: t.cat_moda, belleza: t.cat_belleza, salud: t.cat_salud, deporte: t.cat_deporte, hogar: t.cat_hogar, mascotas: t.cat_mascotas, 'educación': t.cat_educación, coche: t.cat_coche, 'música': t.cat_música, 'fotografía': t.cat_fotografía, coleccionismo: t.cat_coleccionismo, regalo: t.cat_regalo, ocio: t.cat_ocio, otro: t.cat_otro} as Record<string,string>)[c.key] ?? c.label}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.emojiLabel}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {emojis.map((e) => (<button key={e} onClick={() => setEmoji(e)} style={{ width: '40px', height: '40px', borderRadius: '10px', fontSize: '20px', background: emoji === e ? color + '30' : 'rgba(255,255,255,0.05)', border: `1px solid ${emoji === e ? color + '60' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer' }}>{e}</button>))}
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.colorLabel}</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {colors.map((c) => (<button key={c} onClick={() => setColor(c)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: c, border: `3px solid ${color === c ? '#fff' : 'transparent'}`, cursor: 'pointer', boxShadow: color === c ? `0 0 12px ${c}80` : 'none' }}/>))}
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.nameLabelProduct}</label>
          <input type="text" value={name} onChange={(e) => { if (e.target.value.length <= 40) { setName(e.target.value); if (submitted) setErrors(prev => ({ ...prev, name: validate(e.target.value, price, initial).name })) } }} {...{placeholder: t.placeholderPrice}} autoFocus
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${errors.name ? '#ff6060' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <ErrorMsg msg={errors.name || ''} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>{name.length}/40</span>
          </div>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.currencyLabel}</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['€', '$', '£', '¥'].map(c => (
              <button key={c} onClick={() => setCurrency(c)} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: currency === c ? 'rgba(255,107,53,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${currency === c ? 'rgba(255,107,53,0.5)' : 'rgba(255,255,255,0.1)'}`, color: currency === c ? '#FF6B35' : 'rgba(255,255,255,0.5)', fontSize: '16px', cursor: 'pointer', fontWeight: '700' }}>{c}</button>
            )))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.targetPriceLabel}</label>
            <input type="text" inputMode="decimal" value={price} onChange={(e) => handleNumericChange(e.target.value, setPrice, 'price')} placeholder="0.00"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${errors.price ? '#ff6060' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
            <ErrorMsg msg={errors.price || ''} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>{t.initialLabel}</label>
            <input type="text" inputMode="decimal" value={initial} onChange={(e) => handleNumericChange(e.target.value, setInitial, 'initial')} placeholder="0.00"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${errors.initial ? '#ff6060' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
            <ErrorMsg msg={errors.initial || ''} />
          </div>
        </div>
        {/* Descripción */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
            {t.descriptionLabel} <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>{t.descriptionHint}</span>
          </label>
          <input type="text" value={description} onChange={(e) => { if (e.target.value.length <= 120) setDescription(e.target.value) }}
            placeholder={t.descriptionPlaceholder}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}/>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '4px', textAlign: 'right' }}>{description.length}/120</div>
        </div>

        {/* Fecha objetivo */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
            {t.targetDateLabel} <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>{t.targetDateHint}</span>
          </label>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 16px', color: targetDate ? '#f0f0f5' : 'rgba(255,255,255,0.25)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, colorScheme: 'dark' }}/>
          {targetDate && parseFloat(price) > 0 && (() => {
            const daysLeft = Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000)
            const monthsLeft = daysLeft / 30
            const needed = monthsLeft > 0 ? Math.ceil((parseFloat(price) - (parseFloat(initial) || 0)) / monthsLeft) : 0
            return needed > 0 ? <div style={{ fontSize: '11px', color: '#4ECDC4', marginTop: '6px' }}>💡 {t.needPerMonth(needed)}</div> : null
          })()}
        </div>

        {/* Objetivo de ahorro periódico */}
        <div style={{ marginBottom: '16px', marginTop: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
            {locale === 'en' ? 'SAVINGS TARGET' : 'OBJETIVO DE AHORRO'} <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>{locale === 'en' ? '(optional)' : '(opcional)'}</span>
          </label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            {(['none', 'monthly', 'weekly'] as const).map(p => (
              <button key={p} onClick={() => setSavingsPeriod(p)}
                style={{ flex: 1, padding: '8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700',
                  background: savingsPeriod === p ? 'rgba(255,107,53,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${savingsPeriod === p ? 'rgba(255,107,53,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: savingsPeriod === p ? '#FF6B35' : 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                {p === 'none' ? (locale === 'en' ? 'None' : 'Ninguno') : p === 'monthly' ? (locale === 'en' ? '📅 Monthly' : '📅 Mensual') : (locale === 'en' ? '📆 Weekly' : '📆 Semanal')}
              </button>
            ))}
          </div>
          {savingsPeriod !== 'none' && (
            <input type="text" inputMode="decimal" value={monthlyTarget}
              onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setMonthlyTarget(e.target.value) }}
              placeholder={locale === 'en' ? `Target per ${savingsPeriod === 'weekly' ? 'week' : 'month'} (e.g. 50)` : `Meta por ${savingsPeriod === 'weekly' ? 'semana' : 'mes'} (ej: 50)`}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>{t.cancel}</button>
          <button onClick={handleSubmit} disabled={isPending} style={{ flex: 2, padding: '14px', borderRadius: '12px', background: `linear-gradient(135deg, ${color}, ${color}cc)`, border: 'none', color: '#fff', fontSize: '14px', fontFamily: "'Nunito', sans-serif", fontWeight: '800', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? t.creating : t.createGoal}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── GlobalHistory ────────────────────────────────────────────
function GlobalHistory({ goals, onBack, onDeleteDeposit, onEditDeposit, isPending, locale, hideAmounts }: {
  goals: Goal[]; onBack: () => void
  onDeleteDeposit: (depositId: string, amount: number, goalId: string) => void
  onEditDeposit: (deposit: { id: string; amount: number; note: string; goalId: string }) => void
  isPending: boolean; hideAmounts?: boolean
  locale: Locale
}) {
  const t = getT(locale)
  const allDeposits: (Deposit & { goalName: string; goalEmoji: string; goalColor: string; currency: string; goalId: string })[] = []
  goals.forEach((g) => {
    if (g.deposits) {
      g.deposits.forEach((d) => {
        allDeposits.push({ ...d, goalName: g.name, goalEmoji: g.emoji, goalColor: g.color, currency: g.currency, goalId: g.id })
      })
    }
  })
  allDeposits.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const totalDeposited = allDeposits.reduce((s, d) => s + d.amount, 0)
  const grouped: Record<string, typeof allDeposits> = {}
  allDeposits.forEach((d) => {
    const key = new Date(d.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(d)
  })

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 16px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer', marginBottom: '24px' }}>{t.back}</button>
      <div style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,143,171,0.06))', border: '1px solid rgba(255,107,53,0.2)', borderRadius: '24px', padding: '28px', marginBottom: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>💰</div>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '900', fontSize: '32px', color: '#FF6B35', marginBottom: '4px' }}>{hideAmounts ? '••••' : `€${totalDeposited.toLocaleString()}`}</div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{t.totalSavedSummary(allDeposits.length)}</div>
      </div>
      {allDeposits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '16px' }}>{t.noDeposits}</div>
        </div>
      ) : (
        Object.entries(grouped).map(([month, deposits]) => (
          <div key={month} style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '4px' }}>
              {month} · {hideAmounts ? '••••' : `€${deposits.reduce((s, d) => s + d.amount, 0).toLocaleString()}`}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', overflow: 'hidden' }}>
              {deposits.map((d, i) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < deposits.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: d.goalColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{d.goalEmoji}</div>
                    <div>
                      <div style={{ fontSize: '13px', color: '#f0f0f5', fontWeight: '600' }}>{d.note || t.depositFallback}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', display: 'flex', gap: '6px' }}>
                        <span>{d.goalName}</span><span>·</span>
                        <span>{new Date(d.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '16px', color: d.goalColor }}>{hideAmounts ? '••••' : `+${d.currency}${d.amount.toLocaleString()}`}</div>
                    <button onClick={() => onEditDeposit({ id: d.id, amount: d.amount, note: d.note || '', goalId: d.goalId })} disabled={isPending}
                      style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(100,160,255,0.1)', border: '1px solid rgba(100,160,255,0.2)', color: 'rgba(120,180,255,0.8)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: isPending ? 0.5 : 1 }}>✏️</button>
                    <button onClick={() => { if (confirm(t.deleteDepositConfirm(d.amount))) onDeleteDeposit(d.id, d.amount, d.goalId) }} disabled={isPending}
                      style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)', color: 'rgba(255,100,100,0.7)', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: isPending ? 0.5 : 1 }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────
export default function GoalsDashboard({ initialGoals, userId }: {
  initialGoals: Goal[]
  userId: string
}) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals)
  const [filter, setFilter] = useState<Filter>('all')
  const [categoryFilter, setCategoryFilter] = useState<Category>('todas')
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [showNewGoal, setShowNewGoal] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showEditGoal, setShowEditGoal] = useState(false)
  const [showDetailMenu, setShowDetailMenu] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [sort, setSort] = useState<'recent' | 'pct' | 'name' | 'amount'>('recent')
  const [hideAmounts, setHideAmounts] = useState(false)
  const [pinnedGoals, setPinnedGoals] = useState<Set<string>>(new Set())
  const [deletingGoals, setDeletingGoals] = useState<Set<string>>(new Set())
  const [editingDeposit, setEditingDeposit] = useState<{ id: string; amount: number; note: string; goalId: string } | null>(null)
  const { permission, subscribed, loading: pushLoading, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications()
  const [mounted, setMounted] = useState(false)
  const [locale, setLocale] = useState<Locale>('es')
  useEffect(() => {
    setMounted(true)
    setLocale(detectLocale())
  }, [])
  const t = getT(locale)

  const totalSaved = goals.reduce((s, g) => s + g.saved_amount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_price, 0)
  const activeGoals = goals.filter((g) => g.saved_amount < g.target_price)
  const completedGoals = goals.filter((g) => g.saved_amount >= g.target_price)

  const baseFiltered = (filter === 'active' ? activeGoals : filter === 'completed' ? completedGoals : goals) as (Goal & { category?: string })[]
  const filteredGoals = (categoryFilter === 'todas'
    ? baseFiltered
    : baseFiltered.filter((g) => (g.category ?? 'otro') === categoryFilter)
  ).slice().sort((a, b) => {
    if (sort === 'pct') return (b.saved_amount / b.target_price) - (a.saved_amount / a.target_price)
    if (sort === 'name') return a.name.localeCompare(b.name)
    if (sort === 'amount') return b.saved_amount - a.saved_amount
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() // recent
  }).sort((a, b) => {
    const ap = pinnedGoals.has(a.id) ? 0 : 1
    const bp = pinnedGoals.has(b.id) ? 0 : 1
    return ap - bp
  })

  const handleFilterClick = (f: Filter) => setFilter((prev: Filter) => prev === f ? 'all' : f)

  const handlePinGoal = (goalId: string) => {
    setPinnedGoals(prev => {
      const next = new Set(prev)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return next
    })
  }

  const handleEditDeposit = (depositId: string, goalId: string, newAmount: number, newNote: string) => {
    if (!editingDeposit) return
    const oldAmount = editingDeposit.amount
    startTransition(async () => {
      await deleteDepositAction(depositId, oldAmount, goalId)
      await addDepositAction(goalId, newAmount, newNote || t.depositFallback)
      const updater = (g: Goal): Goal => {
        if (g.id !== goalId) return g
        const deps = (g.deposits ?? []).filter(d => d.id !== depositId)
        const newDep: Deposit = { id: crypto.randomUUID(), goal_id: goalId, user_id: g.user_id, amount: newAmount, note: newNote, created_at: new Date().toISOString() }
        return { ...g, saved_amount: Math.max(0, g.saved_amount - oldAmount + newAmount), deposits: [...deps, newDep] }
      }
      setGoals(prev => prev.map(updater))
      setSelectedGoal(prev => prev ? updater(prev) : null)
      setEditingDeposit(null)
    })
  }

  const handleCreateGoal = (goalData: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deposits' | 'is_public' | 'public_show_amounts'> & { category: Category; monthly_target: number | null; savings_period: 'monthly' | 'weekly' | null; is_public?: boolean; public_show_amounts?: boolean; description: string | null; target_date: string | null }) => {
    startTransition(async () => {
      const newGoal = await createGoalAction(goalData)
      if (newGoal) {
        // El trigger de Supabase ya actualizó saved_amount — usamos goalData.saved_amount
        // para el depósito local optimista, y corregimos saved_amount en el estado local
        const initialAmount = goalData.saved_amount
        const initialDeposit: Deposit | null = initialAmount > 0 ? {
          id: Date.now().toString(), goal_id: newGoal.id, user_id: userId,
          amount: initialAmount, note: 'Ahorro inicial', created_at: new Date().toISOString(),
        } : null
        setGoals((prev) => [{
          ...newGoal,
          saved_amount: initialAmount, // corrige el 0 que devuelve el server
          category: goalData.category,
          deposits: initialDeposit ? [initialDeposit] : [],
        }, ...prev])
      }
      setShowNewGoal(false)
    })
  }

  const handleEditGoal = (goalId: string, updates: { name: string; emoji: string; color: string; target_price: number; category: string; monthly_target: number | null; savings_period: 'monthly' | 'weekly' | null; description: string | null; target_date: string | null }) => {
    startTransition(async () => {
      const updated = await updateGoalAction(goalId, updates)
      if (updated) {
        setGoals(prev => prev.map(g => g.id === goalId ? { ...g, ...updates } : g))
        setSelectedGoal(prev => prev ? { ...prev, ...updates } : null)
      }
      setShowEditGoal(false)
    })
  }

  const handleDeposit = (goalId: string, amount: number, note: string) => {
    startTransition(async () => {
      await addDepositAction(goalId, amount, note)
      const newDeposit: Deposit = {
        id: Date.now().toString(), goal_id: goalId, user_id: userId,
        amount, note, created_at: new Date().toISOString(),
      }
      // Calculamos ANTES del setGoals para no depender del updater async
      const targetGoal = goals.find(g => g.id === goalId)
      const justCompleted = targetGoal
        ? (targetGoal.saved_amount + amount >= targetGoal.target_price && targetGoal.saved_amount < targetGoal.target_price)
        : false

      setGoals((prev) => prev.map((g) => {
        if (g.id !== goalId) return g
        const newSaved = g.saved_amount + amount
        return { ...g, saved_amount: newSaved, deposits: [...(g.deposits ?? []), newDeposit] }
      }))
      if (justCompleted) setShowConfetti(true)
      // Milestone confetti at 25/50/75%
      if (!justCompleted && targetGoal) {
        const prevPct = Math.floor((targetGoal.saved_amount / targetGoal.target_price) * 100)
        const newPct = Math.floor(((targetGoal.saved_amount + amount) / targetGoal.target_price) * 100)
        const milestones = [25, 50, 75]
        if (milestones.some(m => prevPct < m && newPct >= m)) setShowConfetti(true)
      }
      if (selectedGoal?.id === goalId) {
        setSelectedGoal(prev => prev ? { ...prev, saved_amount: prev.saved_amount + amount, deposits: [...(prev.deposits ?? []), newDeposit] } : null)
      }
      setShowDeposit(false)
    })
  }

  const handleDeleteDeposit = (depositId: string, amount: number, goalId: string) => {
    startTransition(async () => {
      await deleteDepositAction(depositId, amount, goalId)
      setGoals(prev => prev.map(g => {
        if (g.id !== goalId) return g
        return {
          ...g,
          saved_amount: Math.max(0, g.saved_amount - amount),
          deposits: (g.deposits ?? []).filter(d => d.id !== depositId),
        }
      }))
      if (selectedGoal?.id === goalId) {
        setSelectedGoal(prev => prev ? {
          ...prev,
          saved_amount: Math.max(0, prev.saved_amount - amount),
          deposits: (prev.deposits ?? []).filter(d => d.id !== depositId),
        } : null)
      }
    })
  }

  const handleToggleShowAmounts = (goalId: string, current: boolean) => {
    startTransition(async () => {
      const ok = await toggleGoalShowAmountsAction(goalId, !current)
      if (ok) {
        setGoals(prev => prev.map(g => g.id === goalId ? { ...g, public_show_amounts: !current } : g))
        setSelectedGoal(prev => prev ? { ...prev, public_show_amounts: !current } : null)
      }
    })
  }

  const handleTogglePublic = (goalId: string, current: boolean) => {
    startTransition(async () => {
      const ok = await toggleGoalPublicAction(goalId, !current)
      if (ok) {
        setGoals(prev => prev.map(g => g.id === goalId ? { ...g, is_public: !current } : g))
        setSelectedGoal(prev => prev ? { ...prev, is_public: !current } : null)
      }
    })
  }

  const handleDelete = (goalId: string) => {
    if (!confirm(t.deleteGoalConfirm)) return
    // Animate out first, then delete
    setDeletingGoals(prev => new Set(prev).add(goalId))
    setTimeout(() => {
      startTransition(async () => {
        await deleteGoalAction(goalId)
        setGoals((prev) => prev.filter((g) => g.id !== goalId))
        setDeletingGoals(prev => { const s = new Set(prev); s.delete(goalId); return s })
        setSelectedGoal(null)
      })
    }, 350)
  }

  const presentCategories = ['todas', ...Array.from(new Set(
    (goals as (Goal & { category?: string })[]).map(g => g.category ?? 'otro')
  ))] as Category[]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        @keyframes modalIn { from { transform: scale(0.85) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes fadeUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideInCard { from { transform: translateX(-16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes barFill { from { width: 0%; } to { width: var(--target-w); } }
        @keyframes pulse { 0%,100% { box-shadow: 0 12px 32px var(--btn-shadow); } 50% { box-shadow: 0 16px 40px var(--btn-shadow), 0 0 0 6px var(--btn-glow); } }
        @keyframes countUp { from { opacity: 0; transform: translateY(8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes depositPop { 0% { transform: scale(0.8) translateY(-8px); opacity: 0; } 70% { transform: scale(1.04); } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        input::placeholder { color: rgba(255,255,255,0.25); }
        .goal-card:hover { transform: translateY(-2px); }
        .goal-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
      `}</style>

      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      {showNewGoal && <NewGoalModal onClose={() => setShowNewGoal(false)} onCreate={handleCreateGoal} isPending={isPending} locale={locale}/>}
      {showDeposit && selectedGoal && <AddDepositModal goal={selectedGoal} onClose={() => setShowDeposit(false)} onDeposit={handleDeposit} isPending={isPending} locale={locale}/>}
      {showEditGoal && selectedGoal && <EditGoalModal goal={selectedGoal as Goal & { category?: string }} onClose={() => setShowEditGoal(false)} onSave={handleEditGoal} isPending={isPending} locale={locale}/>}
      {editingDeposit && <EditDepositModal deposit={editingDeposit} onClose={() => setEditingDeposit(null)} onSave={handleEditDeposit} isPending={isPending} locale={locale}/>}

      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '32px 20px 60px' }}>
        {filter === 'history' ? (
          <GlobalHistory goals={goals} onBack={() => setFilter('all')} onDeleteDeposit={handleDeleteDeposit} onEditDeposit={setEditingDeposit} isPending={isPending} locale={locale} hideAmounts={hideAmounts}/>
        ) : selectedGoal ? (
          <div style={{ animation: 'fadeUp 0.3s ease' }} onClick={() => setShowDetailMenu(false)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              {/* ← Volver */}
              <button onClick={() => { setSelectedGoal(null); setShowDetailMenu(false) }}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 14px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {t.back}
              </button>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
                {/* ✏️ Editar — siempre visible */}
                <button onClick={() => { setShowEditGoal(true); setShowDetailMenu(false) }}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 14px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                  ✏️ {t.edit}
                </button>

                {/* ⋯ Menú de opciones adicionales */}
                <button onClick={() => setShowDetailMenu(m => !m)}
                  style={{ background: showDetailMenu ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 12px', color: 'rgba(255,255,255,0.6)', fontSize: '16px', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>
                  ···
                </button>

                {/* Dropdown */}
                {showDetailMenu && (
                  <div onClick={e => e.stopPropagation()}
                    style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#1a1a25', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '8px', zIndex: 200, minWidth: '220px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', animation: 'modalIn 0.15s ease' }}>

                    {/* Compartir */}
                    <ShareButton goal={selectedGoal} t={t} menuStyle />

                    {/* Separador */}
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }}/>

                    {/* Público/Privado */}
                    <button onClick={() => { handleTogglePublic(selectedGoal.id, !!selectedGoal.is_public); setShowDetailMenu(false) }} disabled={isPending}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: selectedGoal.is_public ? 'rgba(78,205,196,0.1)' : 'transparent', border: 'none', color: selectedGoal.is_public ? '#4ECDC4' : 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' as const }}>
                      <span>🌐</span>
                      <span style={{ flex: 1 }}>{selectedGoal.is_public ? (locale === 'en' ? 'Make private' : 'Hacer privada') : (locale === 'en' ? 'Make public' : 'Hacer pública')}</span>
                      {selectedGoal.is_public && <span style={{ fontSize: '10px', background: 'rgba(78,205,196,0.2)', color: '#4ECDC4', padding: '2px 6px', borderRadius: '6px' }}>{locale === 'en' ? 'PUBLIC' : 'PÚBLICA'}</span>}
                    </button>

                    {/* Copiar enlace — solo si es pública */}
                    {selectedGoal.is_public && (
                      <button onClick={async () => { const url = `${window.location.origin}/goal/${selectedGoal.id}`; if (navigator.share) { await navigator.share({ title: selectedGoal.name, url }) } else { await navigator.clipboard.writeText(url) }; setShowDetailMenu(false) }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' as const }}>
                        <span>🔗</span><span>{locale === 'en' ? 'Copy public link' : 'Copiar enlace'}</span>
                      </button>
                    )}

                    {/* Mostrar/ocultar importes en página pública */}
                    {selectedGoal.is_public && (
                      <button onClick={() => { handleToggleShowAmounts(selectedGoal.id, !!selectedGoal.public_show_amounts); setShowDetailMenu(false) }} disabled={isPending}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: selectedGoal.public_show_amounts ? 'rgba(255,230,50,0.08)' : 'transparent', border: 'none', color: selectedGoal.public_show_amounts ? '#FFE066' : 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' as const }}>
                        <span>{selectedGoal.public_show_amounts ? '💰' : '🙈'}</span>
                        <span>{selectedGoal.public_show_amounts ? (locale === 'en' ? 'Hide amounts publicly' : 'Ocultar importes') : (locale === 'en' ? 'Show amounts publicly' : 'Mostrar importes')}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* ── Detail hero card ── */}
            {(() => {
              const g = selectedGoal
              const pct = Math.min(100, Math.round((g.saved_amount / g.target_price) * 100))
              const deps = g.deposits ?? []
              const maxDep = deps.length ? Math.max(...deps.map(d => d.amount)) : 0
              const avgDep = deps.length ? deps.reduce((s,d) => s+d.amount, 0) / deps.length : 0
              const daysSinceStart = deps.length
                ? Math.floor((Date.now() - new Date(deps.reduce((a,b) => new Date(a.created_at) < new Date(b.created_at) ? a : b).created_at).getTime()) / 86400000)
                : 0
              const eta = getEstimatedDate(g, locale)

              return (
                <div style={{ background: `linear-gradient(145deg, ${g.color}18, ${g.color}06)`, border: `1px solid ${g.color}30`, borderRadius: '28px', padding: '28px', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
                  {/* bg glow */}
                  <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '200px', height: '200px', background: `radial-gradient(circle, ${g.color}20 0%, transparent 70%)`, pointerEvents: 'none' }}/>

                  {/* Emoji + name */}
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ fontSize: '56px', marginBottom: '10px', filter: `drop-shadow(0 4px 16px ${g.color}60)`, animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>{g.emoji}</div>
                    <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '900', fontSize: '26px', color: '#f0f0f5', marginBottom: '4px' }}>{g.name}</div>
                    {(g as Goal & { description?: string | null }).description && (
                      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginBottom: '4px', fontStyle: 'italic' }}>
                        {(g as Goal & { description?: string | null }).description}
                      </div>
                    )}
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                      {g.saved_amount >= g.target_price ? t.goalCompleted : (hideAmounts ? t.remainingDetail : `${t.remainingDetail} €${(g.target_price - g.saved_amount).toLocaleString()}`)}
                    </div>
                    {g.saved_amount < g.target_price && eta && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: g.color + '18', border: `1px solid ${g.color}30`, borderRadius: '20px', padding: '5px 14px', marginTop: '10px', fontSize: '12px', color: g.color, fontWeight: '700', animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
                        {t.estimatedLabel} {eta}
                      </div>
                    )}
                    {(g as Goal & { target_date?: string | null }).target_date && (() => {
                      const td = (g as Goal & { target_date?: string | null }).target_date!
                      const daysLeft = Math.ceil((new Date(td).getTime() - Date.now()) / 86400000)
                      const isPast = daysLeft < 0
                      const monthsLeft = daysLeft / 30
                      const needed = !isPast && monthsLeft > 0 && g.saved_amount < g.target_price
                        ? Math.ceil((g.target_price - g.saved_amount) / monthsLeft) : 0
                      return (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: isPast ? 'rgba(255,107,53,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isPast ? 'rgba(255,107,53,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius: '20px', padding: '5px 14px', marginTop: '8px', fontSize: '12px', color: isPast ? '#FF6B35' : 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
                          📅 {new Date(td).toLocaleDateString(locale === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {needed > 0 && <span style={{ color: '#4ECDC4' }}> · {t.needPerMonth(needed)}</span>}
                          {isPast && <span> · {t.targetDatePassed}</span>}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Circular progress */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', position: 'relative' }}>
                    <CircularProgress percentage={pct} color={g.color} size={160} strokeWidth={14}/>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '900', fontSize: '36px', color: g.color, animation: 'countUp 0.4s ease' }}>{pct}%</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>{t.completedCircle}</div>
                    </div>
                  </div>

                  {/* Main amounts */}
                  <div style={{ display: 'flex', gap: '1px', background: 'rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
                    {[
                      { label: t.savedLabel, value: hideAmounts ? '••••' : `€${g.saved_amount.toLocaleString()}`, accent: g.color },
                      { label: t.remainingLabel, value: hideAmounts ? '••••' : `€${Math.max(0, g.target_price - g.saved_amount).toLocaleString()}`, accent: 'rgba(255,255,255,0.4)' },
                      { label: t.targetLabel, value: hideAmounts ? '••••' : `€${g.target_price.toLocaleString()}`, accent: 'rgba(255,255,255,0.25)' },
                    ].map((s, i) => (
                      <div key={i} style={{ flex: 1, textAlign: 'center', padding: '14px 8px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '16px', color: s.accent, animation: 'countUp 0.5s ease' }}>{s.value}</div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Stats grid */}
                  {deps.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {[
                        { icon: '💸', label: t.stat_deposits, value: deps.length },
                        { icon: '🔥', label: locale === 'en' ? 'STREAK' : 'RACHA', value: (() => { const s = calcStreak(selectedGoal); return s > 0 ? `${s}d` : '-' })() },
                        { icon: '⬆️', label: t.stat_max, value: hideAmounts ? '••••' : `€${maxDep.toLocaleString()}` },
                        { icon: '📊', label: t.stat_avg, value: hideAmounts ? '••••' : `€${avgDep.toFixed(2)}` },
                      ].map((s, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', animation: `fadeIn 0.4s ease ${i * 0.06}s both` }}>
                          <span style={{ fontSize: '18px' }}>{s.icon}</span>
                          <div>
                            <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '14px', color: '#f0f0f5' }}>{s.value}</div>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>{s.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
            {selectedGoal.saved_amount < selectedGoal.target_price && (
              <button onClick={() => setShowDeposit(true)} style={{
                width: '100%', padding: '18px', borderRadius: '16px',
                background: `linear-gradient(135deg, ${selectedGoal.color}, ${selectedGoal.color}bb)`,
                border: 'none', color: '#fff', fontFamily: "'Nunito', sans-serif",
                fontWeight: '800', fontSize: '16px', cursor: 'pointer', marginBottom: '12px',
                '--btn-shadow': `${selectedGoal.color}50`,
                '--btn-glow': `${selectedGoal.color}20`,
                animation: 'pulse 2.5s ease-in-out infinite',
                boxShadow: `0 12px 32px ${selectedGoal.color}40`,
              } as React.CSSProperties}>{t.addSaving}</button>
            )}
            <button onClick={() => handleDelete(selectedGoal.id)} disabled={isPending} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: 'rgba(255,100,100,0.8)', fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginBottom: '20px', transition: 'all 0.2s', opacity: isPending ? 0.6 : 1 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,80,80,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,80,80,0.4)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,80,80,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,80,80,0.2)' }}
            >{t.deleteGoal}</button>

            {/* Gráfico de progreso */}
            {selectedGoal.deposits && selectedGoal.deposits.length >= 1 && (
              <div style={{ marginBottom: '16px' }}>
                <ProgressChart goal={selectedGoal} locale={locale}/>
              </div>
            )}

            {/* Meta mensual en detalle */}
            {(() => {
              const ms = monthlyStatus(selectedGoal)
              if (!ms) return null
              const pct = Math.min(100, Math.round((ms.saved / ms.target) * 100))
              return (
                <div style={{
                  background: ms.ok ? 'rgba(78,205,196,0.1)' : 'rgba(255,200,50,0.08)',
                  border: `1px solid ${ms.ok ? 'rgba(78,205,196,0.3)' : 'rgba(255,200,50,0.25)'}`,
                  borderRadius: '16px', padding: '16px 20px', marginBottom: '16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>{ms.period === 'weekly' ? (locale === 'en' ? '📅 THIS WEEK' : '📅 ESTA SEMANA') : t.monthlySection}</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: ms.ok ? '#4ECDC4' : '#FFE066' }}>
                      {ms.ok ? (ms.period === 'weekly' ? (locale === 'en' ? '✅ Week done!' : '✅ ¡Semana completada!') : t.monthCompleted) : (hideAmounts ? `•••• · ${t.daysRemaining(ms.daysLeft)}` : `€${ms.saved.toFixed(0)} / €${ms.target} · ${t.daysRemaining(ms.daysLeft)}`)}
                    </span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: ms.ok ? '#4ECDC4' : 'linear-gradient(90deg, #FFE066, #FF9F1C)',
                      borderRadius: '100px', transition: 'width 0.8s ease',
                      boxShadow: ms.ok ? '0 0 8px rgba(78,205,196,0.5)' : '0 0 8px rgba(255,200,50,0.4)',
                    }}/>
                  </div>
                </div>
              )
            })()}

            {/* Streak widget */}
            {(() => {
              const s = calcStreak(selectedGoal)
              if (s < 2) return null
              const isHot = s >= 7
              const flames = Math.min(s, 14) // cap visual flames at 14
              return (
                <div style={{
                  background: isHot ? 'rgba(255,107,53,0.08)' : 'rgba(255,160,50,0.06)',
                  border: `1px solid ${isHot ? 'rgba(255,107,53,0.25)' : 'rgba(255,160,50,0.2)'}`,
                  borderRadius: '16px', padding: '16px 20px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '16px',
                }}>
                  <div style={{ textAlign: 'center', minWidth: '56px' }}>
                    <div style={{ fontSize: '32px', animation: isHot ? 'pulse 1.5s ease-in-out infinite' : 'none', lineHeight: 1 }}>🔥</div>
                    <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '900', fontSize: '22px', color: isHot ? '#FF6B35' : '#FFB347', lineHeight: 1, marginTop: '4px' }}>{s}</div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: '0.5px' }}>{locale === 'en' ? 'DAYS' : 'DÍAS'}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '13px', color: isHot ? '#FF6B35' : '#FFB347', marginBottom: '6px' }}>
                      {locale === 'en'
                        ? (isHot ? `🏆 ${s}-day streak! You're on fire!` : `🔥 ${s}-day saving streak`)
                        : (isHot ? `🏆 ¡${s} días seguidos! ¡Eres un crack!` : `🔥 Racha de ${s} días ahorrando`)}
                    </div>
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' as const }}>
                      {Array.from({ length: flames }).map((_, i) => (
                        <span key={i} style={{ fontSize: '12px', opacity: 0.6 + (i / flames) * 0.4 }}>🔥</span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Historial mejorado con barras relativas */}
            {selectedGoal.deposits && selectedGoal.deposits.length > 0 && (() => {
              const deps = [...selectedGoal.deposits].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              const maxAmt = Math.max(...deps.map(d => d.amount))
              return (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>{t.depositHistory}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>{deps.length} {t.entries}</div>
                  </div>
                  {deps.map((d, i) => {
                    const barPct = maxAmt > 0 ? (d.amount / maxAmt) * 100 : 0
                    return (
                      <div key={d.id} style={{ marginBottom: i < deps.length - 1 ? '12px' : '0', animation: `depositPop 0.35s ease ${Math.min(i,5) * 0.05}s both` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: selectedGoal.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>💸</div>
                            <div>
                              <div style={{ fontSize: '13px', color: '#f0f0f5', fontWeight: '600' }}>{d.note || t.depositFallback}</div>
                              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>{new Date(d.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '15px', color: selectedGoal.color }}>{hideAmounts ? '••••' : `+${selectedGoal.currency}${d.amount.toLocaleString()}`}</div>
                            <button onClick={(e) => { e.stopPropagation(); setEditingDeposit({ id: d.id, amount: d.amount, note: d.note || '', goalId: selectedGoal.id }) }} disabled={isPending}
                              style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(100,160,255,0.1)', border: '1px solid rgba(100,160,255,0.2)', color: 'rgba(120,180,255,0.8)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPending ? 0.5 : 1, flexShrink: 0 }}>✏️</button>
                            <button onClick={() => { if (confirm(t.deleteDepositConfirm(d.amount))) handleDeleteDeposit(d.id, d.amount, selectedGoal.id) }} disabled={isPending}
                              style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)', color: 'rgba(255,100,100,0.7)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPending ? 0.5 : 1, flexShrink: 0 }}>×</button>
                          </div>
                        </div>
                        {/* Relative bar */}
                        <div style={{ marginLeft: '42px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '100px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${barPct}%`, background: `linear-gradient(90deg, ${selectedGoal.color}90, ${selectedGoal.color})`, borderRadius: '100px', transition: 'width 0.8s cubic-bezier(0.34,1.1,0.64,1)' }}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        ) : (
          <>
            {/* ── Rich header banner ── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,107,53,0.12) 0%, rgba(255,143,171,0.08) 50%, rgba(167,139,250,0.06) 100%)',
              border: '1px solid rgba(255,107,53,0.2)',
              borderRadius: '28px', padding: '28px 28px 24px', marginBottom: '20px',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Background glow orbs */}
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', background: 'radial-gradient(circle, rgba(255,107,53,0.15) 0%, transparent 70%)', pointerEvents: 'none' }}/>
              <div style={{ position: 'absolute', bottom: '-30px', left: '20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)', pointerEvents: 'none' }}/>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', marginBottom: '6px' }}>{t.totalSaved}</div>
                  <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '900', fontSize: '38px', color: '#f0f0f5', lineHeight: 1, animation: 'countUp 0.5s ease', letterSpacing: '-1px' }}>
                    {hideAmounts ? '••••' : `€${totalSaved.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>
                    {t.of} {hideAmounts ? '••••' : `€${totalTarget.toLocaleString('es-ES')}`} · {goals.length} {goals.length === 1 ? t.goal : t.goals}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {mounted && 'Notification' in window && (
                    <button
                      onClick={() => subscribed ? unsubscribePush() : subscribePush()}
                      disabled={pushLoading}
                      title={subscribed ? t.disableNotifs : t.enableNotifs}
                      style={{
                        background: subscribed ? 'rgba(78,205,196,0.15)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${subscribed ? 'rgba(78,205,196,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '12px', padding: '10px 12px', color: subscribed ? '#4ECDC4' : 'rgba(255,255,255,0.5)',
                        fontSize: '16px', cursor: pushLoading ? 'wait' : 'pointer', opacity: pushLoading ? 0.6 : 1,
                      }}
                    >{pushLoading ? '⏳' : subscribed ? '🔔' : '🔕'}</button>
                  )}
                  <button onClick={() => setHideAmounts(h => !h)} title={hideAmounts ? t.showAmounts : t.hideAmounts} style={{ background: hideAmounts ? 'rgba(255,107,53,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${hideAmounts ? 'rgba(255,107,53,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '10px 12px', color: hideAmounts ? '#FF6B35' : 'rgba(255,255,255,0.5)', fontSize: '16px', cursor: 'pointer' }}>👁️</button>
                  <button onClick={() => setShowNewGoal(true)} style={{ background: 'linear-gradient(135deg, #FF6B35, #FF8FAB)', border: 'none', borderRadius: '12px', padding: '10px 18px', color: '#fff', fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '13px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(255,107,53,0.35)' }}>{t.newGoal}</button>
                </div>
              </div>

              {/* Global progress bar */}
              {goals.length > 0 && (() => {
                const globalPct = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0
                return (
                  <div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '100px', height: '8px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{
                        height: '100%', width: `${globalPct}%`,
                        background: 'linear-gradient(90deg, #FF6B35, #FF8FAB, #A78BFA)',
                        borderRadius: '100px',
                        backgroundSize: '200% auto',
                        animation: globalPct > 0 ? 'shimmer 3s linear infinite' : 'none',
                        transition: 'width 1s cubic-bezier(0.34,1.1,0.64,1)',
                        boxShadow: '0 0 12px rgba(255,107,53,0.5)',
                      }}/>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ECDC4' }}/>
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{activeGoals.length} {t.activeGoals}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#A78BFA' }}/>
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{completedGoals.length} {t.completed}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#FF8FAB' }}>{globalPct.toFixed(0)}% {t.globalPct}</span>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <TotalPill totalSaved={totalSaved} currentFilter={filter} onFilterClick={handleFilterClick} locale={locale} hideAmounts={hideAmounts}/>
              <StatPill label={t.activeGoals} value={activeGoals.length} color="#4ECDC4" filterKey="active" currentFilter={filter} onFilterClick={handleFilterClick} />
              <StatPill label={t.completed} value={completedGoals.length} color="#A78BFA" filterKey="completed" currentFilter={filter} onFilterClick={handleFilterClick} />
            </div>

            {goals.length > 0 && presentCategories.length > 2 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '4px' }}>
                {presentCategories.map((key) => {
                  const cat = CATEGORIES.find(c => c.key === key)
                  if (!cat) return null
                  const isActive = categoryFilter === key
                  return (
                    <button key={key} onClick={() => setCategoryFilter(key)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: isActive ? 'rgba(255,107,53,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isActive ? 'rgba(255,107,53,0.5)' : 'rgba(255,255,255,0.1)'}`, color: isActive ? '#FF6B35' : 'rgba(255,255,255,0.45)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0 }}>{cat.emoji} {({todas: t.cat_todas, 'tecnología': t.cat_tecnología, viajes: t.cat_viajes, moda: t.cat_moda, belleza: t.cat_belleza, salud: t.cat_salud, deporte: t.cat_deporte, hogar: t.cat_hogar, mascotas: t.cat_mascotas, 'educación': t.cat_educación, coche: t.cat_coche, 'música': t.cat_música, 'fotografía': t.cat_fotografía, coleccionismo: t.cat_coleccionismo, regalo: t.cat_regalo, ocio: t.cat_ocio, otro: t.cat_otro} as Record<string,string>)[cat.key] ?? cat.label}</button>
                  )
                })}
              </div>
            )}

            {/* Sort selector */}
            {filteredGoals.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: '600' }}>{t.sortLabel}</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                  {(['recent', 'pct', 'name', 'amount'] as const).map((s) => {
                    const labels = { recent: t.sortRecent, pct: t.sortPct, name: t.sortName, amount: t.sortAmount }
                    return (
                      <button key={s} onClick={() => setSort(s)} style={{
                        padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                        background: sort === s ? 'rgba(255,107,53,0.2)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${sort === s ? 'rgba(255,107,53,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        color: sort === s ? '#FF6B35' : 'rgba(255,255,255,0.4)', cursor: 'pointer',
                      }}>{labels[s]}</button>
                    )
                  })}
                </div>
              </div>
            )}

            {(filter === 'active' || filter === 'completed') && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', animation: 'fadeIn 0.2s ease' }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>
                  {t.showingFilter} <span style={{ color: filter === 'active' ? '#4ECDC4' : '#A78BFA', fontWeight: '700' }}>{filter === 'active' ? t.filterActive : t.filterCompleted}</span>
                </div>
                <button onClick={() => setFilter('all')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px 10px', color: 'rgba(255,255,255,0.5)', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>{t.clearFilter}</button>
              </div>
            )}

            {goals.length > 0 && filter === 'all' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>{t.globalProgress}</span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>{hideAmounts ? '•••• / ••••' : `€${totalSaved.toLocaleString()} / €${totalTarget.toLocaleString()}`}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #FF6B35, #FF8FAB, #A78BFA)', borderRadius: '100px', width: `${Math.min(100, (totalSaved / totalTarget) * 100)}%`, boxShadow: '0 0 12px rgba(255,107,53,0.5)' }}/>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!mounted ? (
                // Skeleton loading
                Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
              ) : filteredGoals.map((goal, idx) => (
                <div key={goal.id} style={{ animation: `slideInCard 0.35s ease ${Math.min(idx, 6) * 0.06}s both` }}>
                  <GoalCard
                    goal={goal}
                    onClick={setSelectedGoal}
                    locale={locale}
                    pinned={pinnedGoals.has(goal.id)}
                    onPin={() => handlePinGoal(goal.id)}
                    hideAmounts={hideAmounts}
                    deleting={deletingGoals.has(goal.id)}
                  />
                </div>
              ))}
            </div>

            {filteredGoals.length === 0 && goals.length > 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.25)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>{filter === 'completed' ? '🏆' : categoryFilter !== 'todas' ? '🔍' : '⏳'}</div>
                <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '16px', color: 'rgba(255,255,255,0.35)' }}>
                  {filter === 'completed' ? t.noCompletedGoals : categoryFilter !== 'todas' ? t.noCategoryGoals : t.noActiveGoals}
                </div>
              </div>
            )}

            {goals.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.25)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🐷</div>
                <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '18px', marginBottom: '8px', color: 'rgba(255,255,255,0.4)' }}>{t.noGoalsTitle}</div>
                <div style={{ fontSize: '14px' }}>{t.noGoalsBody}</div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
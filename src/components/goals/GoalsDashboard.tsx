'use client'
// src/components/goals/GoalsDashboard.tsx

import { useState, useTransition, useEffect, useRef } from 'react'
import type { Goal, Deposit } from '@/types/database'
import { createGoalAction, addDepositAction, deleteGoalAction, updateGoalAction, deleteDepositAction } from '@/app/dashboard/actions'

type Filter = 'all' | 'active' | 'completed' | 'history'
type Category = 'todas' | 'tecnología' | 'viajes' | 'moda' | 'hogar' | 'ocio' | 'otro'

const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: 'todas',      label: 'Todas',      emoji: '✨' },
  { key: 'tecnología', label: 'Tecnología', emoji: '💻' },
  { key: 'viajes',     label: 'Viajes',     emoji: '✈️' },
  { key: 'moda',       label: 'Moda',       emoji: '👟' },
  { key: 'hogar',      label: 'Hogar',      emoji: '🏠' },
  { key: 'ocio',       label: 'Ocio',       emoji: '🎮' },
  { key: 'otro',       label: 'Otro',       emoji: '🎯' },
]

function getEstimatedDate(goal: Goal): string | null {
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
  if (daysLeft < 30) return `~${daysLeft} días`
  if (daysLeft < 365) return `~${Math.round(daysLeft / 30)} meses`
  return `~${(daysLeft / 365).toFixed(1)} años`
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

// ── GoalCard ─────────────────────────────────────────────────
function GoalCard({ goal, onClick }: { goal: Goal & { category?: string }; onClick: (g: Goal) => void }) {
  const percentage = Math.min(100, Math.round((goal.saved_amount / goal.target_price) * 100))
  const remaining = goal.target_price - goal.saved_amount
  const isComplete = percentage >= 100
  const eta = getEstimatedDate(goal)
  const catInfo = CATEGORIES.find(c => c.key === (goal.category ?? 'otro'))

  return (
    <div onClick={() => onClick(goal)} style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '20px', padding: '24px', cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = goal.color + '60'; e.currentTarget.style.boxShadow = `0 20px 40px ${goal.color}20` }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {isComplete && (
        <div style={{ position: 'absolute', top: '12px', right: '12px', background: '#4ECDC4', color: '#0a0a0f', fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '20px', letterSpacing: '1px' }}>✓ LISTO</div>
      )}
      {!isComplete && catInfo && catInfo.key !== 'todas' && (
        <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}>{catInfo.emoji} {catInfo.label}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', marginTop: (!isComplete && catInfo && catInfo.key !== 'todas') ? '20px' : '0' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: goal.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: `1px solid ${goal.color}30` }}>{goal.emoji}</div>
        <div>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '16px', color: '#f0f0f5' }}>{goal.name}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
            {isComplete ? '¡Meta alcanzada! 🎉' : `Faltan ${goal.currency}${remaining.toLocaleString()}`}
            {!isComplete && eta && <span style={{ color: goal.color + 'aa', marginLeft: '6px' }}>· {eta}</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ position: 'relative' }}>
          <CircularProgress percentage={percentage} color={goal.color} size={72} strokeWidth={7}/>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '14px', color: goal.color }}>{percentage}%</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '22px', color: '#f0f0f5' }}>{goal.currency}{goal.saved_amount.toLocaleString()}</span>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', alignSelf: 'flex-end', marginBottom: '2px' }}>de {goal.currency}{goal.target_price.toLocaleString()}</span>
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
function TotalPill({ totalSaved, currentFilter, onFilterClick }: { totalSaved: number; currentFilter: Filter; onFilterClick: (f: Filter) => void }) {
  const isActive = currentFilter === 'history'
  return (
    <div onClick={() => onFilterClick('history')} style={{ background: isActive ? 'rgba(255,107,53,0.18)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isActive ? 'rgba(255,107,53,0.5)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '16px', padding: '16px 14px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', transform: isActive ? 'translateY(-2px)' : 'none', boxShadow: isActive ? '0 0 20px rgba(255,107,53,0.2)' : 'none', position: 'relative' as const }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,107,53,0.3)' }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
    >
      {isActive && <div style={{ position: 'absolute', top: '6px', right: '8px', fontSize: '8px', color: '#FF6B35', fontWeight: '800' }}>● FILTRO</div>}
      <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '18px', color: '#FF6B35', marginBottom: '4px' }}>€{totalSaved.toLocaleString()}</div>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '600' }}>Total ahorrado</div>
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
function EditGoalModal({ goal, onClose, onSave, isPending }: {
  goal: Goal & { category?: string }
  onClose: () => void
  onSave: (goalId: string, updates: { name: string; emoji: string; color: string; target_price: number; category: string }) => void
  isPending: boolean
}) {
  const [name, setName] = useState(goal.name)
  const [emoji, setEmoji] = useState(goal.emoji)
  const [color, setColor] = useState(goal.color)
  const [price, setPrice] = useState(String(goal.target_price))
  const [category, setCategory] = useState<Category>((goal.category as Category) ?? 'otro')
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({})
  const [submitted, setSubmitted] = useState(false)

  const colors = ['#FF6B35', '#4ECDC4', '#FFE66D', '#A78BFA', '#FF8FAB', '#6BCB77']
  const emojis = ['🎯', '💻', '🎧', '🎮', '👟', '✈️', '📱', '🚗', '🏠', '⌚', '📷', '🎸']

  const validate = (n = name, p = price) => {
    const e: { name?: string; price?: string } = {}
    if (!n.trim()) e.name = 'El nombre es obligatorio'
    else if (n.trim().length < 2) e.name = 'Mínimo 2 caracteres'
    if (!p || isNaN(parseFloat(p)) || parseFloat(p) <= 0) e.price = 'Introduce un precio válido'
    else if (parseFloat(p) < goal.saved_amount) e.price = `Debe ser ≥ lo ya ahorrado (€${goal.saved_amount})`
    return e
  }

  const handleSubmit = () => {
    setSubmitted(true)
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    onSave(goal.id, { name: name.trim(), emoji, color, target_price: parseFloat(price), category })
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
          Editar meta ✏️
        </div>

        {/* Categoría */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>CATEGORÍA</label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {CATEGORIES.filter(c => c.key !== 'todas').map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: category === c.key ? color + '25' : 'rgba(255,255,255,0.05)', border: `1px solid ${category === c.key ? color + '60' : 'rgba(255,255,255,0.1)'}`, color: category === c.key ? color : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>{c.emoji} {c.label}</button>
            ))}
          </div>
        </div>

        {/* Emoji */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>EMOJI</label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {emojis.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} style={{ width: '40px', height: '40px', borderRadius: '10px', fontSize: '20px', background: emoji === e ? color + '30' : 'rgba(255,255,255,0.05)', border: `1px solid ${emoji === e ? color + '60' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer' }}>{e}</button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>COLOR</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {colors.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: c, border: `3px solid ${color === c ? '#fff' : 'transparent'}`, cursor: 'pointer', boxShadow: color === c ? `0 0 12px ${c}80` : 'none' }}/>
            ))}
          </div>
        </div>

        {/* Nombre */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>NOMBRE</label>
          <input type="text" value={name}
            onChange={(e) => { if (e.target.value.length <= 40) { setName(e.target.value); if (submitted) setErrors(prev => ({ ...prev, name: validate(e.target.value, price).name })) } }}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${errors.name ? '#ff6060' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <ErrorMsg msg={errors.name || ''} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>{name.length}/40</span>
          </div>
        </div>

        {/* Precio */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>PRECIO OBJETIVO (€)</label>
          <input type="text" inputMode="decimal" value={price}
            onChange={(e) => handlePriceChange(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${errors.price ? '#ff6060' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
          <ErrorMsg msg={errors.price || ''} />
          {goal.saved_amount > 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>
              Ya tienes ahorrado €{goal.saved_amount.toLocaleString()} — el precio no puede ser menor
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={isPending} style={{ flex: 2, padding: '14px', borderRadius: '12px', background: `linear-gradient(135deg, ${color}, ${color}cc)`, border: 'none', color: '#fff', fontSize: '14px', fontFamily: "'Nunito', sans-serif", fontWeight: '800', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? 'Guardando...' : '💾 Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AddDepositModal ──────────────────────────────────────────
function AddDepositModal({ goal, onClose, onDeposit, isPending }: {
  goal: Goal; onClose: () => void
  onDeposit: (goalId: string, amount: number, note: string) => void
  isPending: boolean
}) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [amountError, setAmountError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const remaining = goal.target_price - goal.saved_amount

  const validateAmount = (val: string) => {
    if (!val) return 'Introduce una cantidad'
    if (isNaN(parseFloat(val))) return 'Solo se permiten números'
    if (parseFloat(val) <= 0) return 'La cantidad debe ser mayor que 0'
    if (parseFloat(val) > 999999) return 'Cantidad demasiado grande'
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
    onDeposit(goal.id, parseFloat(amount), note.trim() || 'Depósito')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '400px', animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: goal.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{goal.emoji}</div>
          <div>
            <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '18px', color: '#f0f0f5' }}>Añadir ahorro</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{goal.name}</div>
          </div>
        </div>
        <div style={{ background: goal.color + '12', border: `1px solid ${goal.color}25`, borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Faltan para la meta</span>
          <span style={{ color: goal.color, fontWeight: '700' }}>{goal.currency}{remaining.toLocaleString()}</span>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>CANTIDAD ({goal.currency})</label>
          <input type="text" inputMode="decimal" value={amount} onChange={(e) => handleAmountChange(e.target.value)} onBlur={() => { if (amount) setAmountError(validateAmount(amount)) }} placeholder="0.00" autoFocus
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${amountError ? '#ff6060' : amount ? goal.color + '60' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '16px', color: '#f0f0f5', fontSize: '20px', fontFamily: "'Nunito', sans-serif", fontWeight: '800', outline: 'none', boxSizing: 'border-box' as const }}/>
          <ErrorMsg msg={amountError} />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>NOTA <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>(opcional)</span></label>
          <input type="text" value={note} onChange={(e) => { if (e.target.value.length <= 60) setNote(e.target.value) }} placeholder="Ej: Paga de marzo, freelance..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}/>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '4px', textAlign: 'right' }}>{note.length}/60</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={isPending} style={{ flex: 2, padding: '14px', borderRadius: '12px', background: `linear-gradient(135deg, ${goal.color}, ${goal.color}cc)`, border: 'none', color: '#fff', fontSize: '14px', fontFamily: "'Nunito', sans-serif", fontWeight: '800', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? '...' : '💰 Añadir ahorro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── NewGoalModal ─────────────────────────────────────────────
function NewGoalModal({ onClose, onCreate, isPending }: {
  onClose: () => void
  onCreate: (goal: { name: string; emoji: string; color: string; target_price: number; saved_amount: number; currency: string; category: Category }) => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [price, setPrice] = useState('')
  const [initial, setInitial] = useState('')
  const [category, setCategory] = useState<Category>('otro')
  const [errors, setErrors] = useState<{ name?: string; price?: string; initial?: string }>({})
  const [submitted, setSubmitted] = useState(false)
  const colors = ['#FF6B35', '#4ECDC4', '#FFE66D', '#A78BFA', '#FF8FAB', '#6BCB77']
  const [color, setColor] = useState(colors[0])
  const emojis = ['🎯', '💻', '🎧', '🎮', '👟', '✈️', '📱', '🚗', '🏠', '⌚', '📷', '🎸']

  const validate = (n = name, p = price, i = initial) => {
    const e: { name?: string; price?: string; initial?: string } = {}
    if (!n.trim()) e.name = 'El nombre es obligatorio'
    else if (n.trim().length < 2) e.name = 'Mínimo 2 caracteres'
    if (!p) e.price = 'El precio objetivo es obligatorio'
    else if (isNaN(parseFloat(p)) || parseFloat(p) <= 0) e.price = 'Introduce un precio válido mayor que 0'
    else if (parseFloat(p) > 9999999) e.price = 'Precio demasiado alto'
    if (i && (isNaN(parseFloat(i)) || parseFloat(i) < 0)) e.initial = 'Introduce un valor válido'
    if (i && p && parseFloat(i) >= parseFloat(p)) e.initial = 'No puede ser mayor o igual al precio objetivo'
    return e
  }

  const handleSubmit = () => {
    setSubmitted(true)
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    onCreate({ name: name.trim(), emoji, color, target_price: parseFloat(price), saved_amount: parseFloat(initial) || 0, currency: '€', category })
  }

  const handleNumericChange = (val: string, setter: (v: string) => void, field: 'price' | 'initial') => {
    if (val !== '' && !/^\d*\.?\d{0,2}$/.test(val)) return
    setter(val)
    if (submitted) setErrors(validate(name, field === 'price' ? val : price, field === 'initial' ? val : initial))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '440px', animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '90vh', overflowY: 'auto' as const }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '22px', color: '#f0f0f5', marginBottom: '24px' }}>Nueva meta de ahorro ✨</div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>CATEGORÍA</label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {CATEGORIES.filter(c => c.key !== 'todas').map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: category === c.key ? color + '25' : 'rgba(255,255,255,0.05)', border: `1px solid ${category === c.key ? color + '60' : 'rgba(255,255,255,0.1)'}`, color: category === c.key ? color : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>{c.emoji} {c.label}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>EMOJI</label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {emojis.map((e) => (<button key={e} onClick={() => setEmoji(e)} style={{ width: '40px', height: '40px', borderRadius: '10px', fontSize: '20px', background: emoji === e ? color + '30' : 'rgba(255,255,255,0.05)', border: `1px solid ${emoji === e ? color + '60' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer' }}>{e}</button>))}
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>COLOR</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {colors.map((c) => (<button key={c} onClick={() => setColor(c)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: c, border: `3px solid ${color === c ? '#fff' : 'transparent'}`, cursor: 'pointer', boxShadow: color === c ? `0 0 12px ${c}80` : 'none' }}/>))}
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>NOMBRE DEL PRODUCTO</label>
          <input type="text" value={name} onChange={(e) => { if (e.target.value.length <= 40) { setName(e.target.value); if (submitted) setErrors(prev => ({ ...prev, name: validate(e.target.value, price, initial).name })) } }} placeholder="Ej: MacBook Pro M4" autoFocus
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${errors.name ? '#ff6060' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <ErrorMsg msg={errors.name || ''} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>{name.length}/40</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>PRECIO OBJETIVO (€)</label>
            <input type="text" inputMode="decimal" value={price} onChange={(e) => handleNumericChange(e.target.value, setPrice, 'price')} placeholder="0.00"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${errors.price ? '#ff6060' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
            <ErrorMsg msg={errors.price || ''} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>YA TENGO (€)</label>
            <input type="text" inputMode="decimal" value={initial} onChange={(e) => handleNumericChange(e.target.value, setInitial, 'initial')} placeholder="0.00"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${errors.initial ? '#ff6060' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 16px', color: '#f0f0f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }}/>
            <ErrorMsg msg={errors.initial || ''} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={isPending} style={{ flex: 2, padding: '14px', borderRadius: '12px', background: `linear-gradient(135deg, ${color}, ${color}cc)`, border: 'none', color: '#fff', fontSize: '14px', fontFamily: "'Nunito', sans-serif", fontWeight: '800', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? 'Creando...' : '🎯 Crear meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── GlobalHistory ────────────────────────────────────────────
function GlobalHistory({ goals, onBack, onDeleteDeposit, isPending }: {
  goals: Goal[]; onBack: () => void
  onDeleteDeposit: (depositId: string, amount: number, goalId: string) => void
  isPending: boolean
}) {
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
      <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 16px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer', marginBottom: '24px' }}>← Volver</button>
      <div style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,143,171,0.06))', border: '1px solid rgba(255,107,53,0.2)', borderRadius: '24px', padding: '28px', marginBottom: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>💰</div>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '900', fontSize: '32px', color: '#FF6B35', marginBottom: '4px' }}>€{totalDeposited.toLocaleString()}</div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>total ahorrado · {allDeposits.length} depósitos</div>
      </div>
      {allDeposits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '16px' }}>Aún no hay depósitos</div>
        </div>
      ) : (
        Object.entries(grouped).map(([month, deposits]) => (
          <div key={month} style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '4px' }}>
              {month} · €{deposits.reduce((s, d) => s + d.amount, 0).toLocaleString()}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', overflow: 'hidden' }}>
              {deposits.map((d, i) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < deposits.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: d.goalColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{d.goalEmoji}</div>
                    <div>
                      <div style={{ fontSize: '13px', color: '#f0f0f5', fontWeight: '600' }}>{d.note || 'Depósito'}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', display: 'flex', gap: '6px' }}>
                        <span>{d.goalName}</span><span>·</span>
                        <span>{new Date(d.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '16px', color: d.goalColor }}>+{d.currency}{d.amount.toLocaleString()}</div>
                    <button onClick={() => { if (confirm(`¿Eliminar este depósito de €${d.amount}?`)) onDeleteDeposit(d.id, d.amount, d.goalId) }} disabled={isPending}
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
  const [showConfetti, setShowConfetti] = useState(false)
  const [isPending, startTransition] = useTransition()

  const totalSaved = goals.reduce((s, g) => s + g.saved_amount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_price, 0)
  const activeGoals = goals.filter((g) => g.saved_amount < g.target_price)
  const completedGoals = goals.filter((g) => g.saved_amount >= g.target_price)

  const baseFiltered = (filter === 'active' ? activeGoals : filter === 'completed' ? completedGoals : goals) as (Goal & { category?: string })[]
  const filteredGoals = categoryFilter === 'todas'
    ? baseFiltered
    : baseFiltered.filter((g) => (g.category ?? 'otro') === categoryFilter)

  const handleFilterClick = (f: Filter) => setFilter((prev: Filter) => prev === f ? 'all' : f)

  const handleCreateGoal = (goalData: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deposits'> & { category: Category }) => {
    startTransition(async () => {
      const newGoal = await createGoalAction(goalData)
      if (newGoal) {
        const initialDeposit: Deposit | null = goalData.saved_amount > 0 ? {
          id: Date.now().toString(), goal_id: newGoal.id, user_id: userId,
          amount: goalData.saved_amount, note: 'Ahorro inicial', created_at: new Date().toISOString(),
        } : null
        setGoals((prev) => [{ ...newGoal, category: goalData.category, deposits: initialDeposit ? [initialDeposit] : [] }, ...prev])
      }
      setShowNewGoal(false)
    })
  }

  const handleEditGoal = (goalId: string, updates: { name: string; emoji: string; color: string; target_price: number; category: string }) => {
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
      let justCompleted = false
      setGoals((prev) => prev.map((g) => {
        if (g.id !== goalId) return g
        const newSaved = g.saved_amount + amount
        if (newSaved >= g.target_price && g.saved_amount < g.target_price) justCompleted = true
        return { ...g, saved_amount: newSaved, deposits: [...(g.deposits ?? []), newDeposit] }
      }))
      if (justCompleted) setShowConfetti(true)
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

  const handleDelete = (goalId: string) => {
    if (!confirm('¿Eliminar esta meta? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      await deleteGoalAction(goalId)
      setGoals((prev) => prev.filter((g) => g.id !== goalId))
      setSelectedGoal(null)
    })
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
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>

      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      {showNewGoal && <NewGoalModal onClose={() => setShowNewGoal(false)} onCreate={handleCreateGoal} isPending={isPending}/>}
      {showDeposit && selectedGoal && <AddDepositModal goal={selectedGoal} onClose={() => setShowDeposit(false)} onDeposit={handleDeposit} isPending={isPending}/>}
      {showEditGoal && selectedGoal && <EditGoalModal goal={selectedGoal as Goal & { category?: string }} onClose={() => setShowEditGoal(false)} onSave={handleEditGoal} isPending={isPending}/>}

      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '32px 20px 60px' }}>
        {filter === 'history' ? (
          <GlobalHistory goals={goals} onBack={() => setFilter('all')} onDeleteDeposit={handleDeleteDeposit} isPending={isPending}/>
        ) : selectedGoal ? (
          <div style={{ animation: 'fadeUp 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <button onClick={() => setSelectedGoal(null)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 16px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer' }}>← Volver</button>
              <button onClick={() => setShowEditGoal(true)} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 16px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>✏️ Editar</button>
            </div>
            <div style={{ background: `linear-gradient(135deg, ${selectedGoal.color}15, ${selectedGoal.color}05)`, border: `1px solid ${selectedGoal.color}30`, borderRadius: '24px', padding: '32px', textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '52px', marginBottom: '12px' }}>{selectedGoal.emoji}</div>
              <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '24px', color: '#f0f0f5', marginBottom: '4px' }}>{selectedGoal.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '12px' }}>
                {selectedGoal.saved_amount >= selectedGoal.target_price ? '🎉 ¡Meta completada!' : `Faltan €${(selectedGoal.target_price - selectedGoal.saved_amount).toLocaleString()}`}
              </div>
              {selectedGoal.saved_amount < selectedGoal.target_price && getEstimatedDate(selectedGoal) && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: selectedGoal.color + '18', border: `1px solid ${selectedGoal.color}30`, borderRadius: '20px', padding: '5px 14px', marginBottom: '20px', fontSize: '12px', color: selectedGoal.color, fontWeight: '700', animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
                  📅 Estimado: {getEstimatedDate(selectedGoal)}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', position: 'relative', marginTop: '8px' }}>
                <CircularProgress percentage={Math.min(100, Math.round((selectedGoal.saved_amount / selectedGoal.target_price) * 100))} color={selectedGoal.color} size={160} strokeWidth={14}/>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '900', fontSize: '36px', color: selectedGoal.color }}>{Math.min(100, Math.round((selectedGoal.saved_amount / selectedGoal.target_price) * 100))}%</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>completado</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {[
                  { label: 'ahorrado', value: `€${selectedGoal.saved_amount.toLocaleString()}`, color: '#f0f0f5' },
                  { label: 'objetivo', value: `€${selectedGoal.target_price.toLocaleString()}`, color: 'rgba(255,255,255,0.5)' },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '22px', color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {selectedGoal.saved_amount < selectedGoal.target_price && (
              <button onClick={() => setShowDeposit(true)} style={{ width: '100%', padding: '18px', borderRadius: '16px', background: `linear-gradient(135deg, ${selectedGoal.color}, ${selectedGoal.color}bb)`, border: 'none', color: '#fff', fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '16px', cursor: 'pointer', marginBottom: '12px', boxShadow: `0 12px 32px ${selectedGoal.color}40` }}>💰 Añadir ahorro</button>
            )}
            <button onClick={() => handleDelete(selectedGoal.id)} disabled={isPending} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: 'rgba(255,100,100,0.8)', fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginBottom: '20px', transition: 'all 0.2s', opacity: isPending ? 0.6 : 1 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,80,80,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,80,80,0.4)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,80,80,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,80,80,0.2)' }}
            >🗑️ Eliminar meta</button>

            {/* Historial con botón eliminar depósito */}
            {selectedGoal.deposits && selectedGoal.deposits.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', marginBottom: '16px' }}>HISTORIAL DE DEPÓSITOS</div>
                {[...selectedGoal.deposits].reverse().map((d, i) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < (selectedGoal.deposits?.length ?? 0) - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: selectedGoal.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>💸</div>
                      <div>
                        <div style={{ fontSize: '13px', color: '#f0f0f5', fontWeight: '600' }}>{d.note || 'Depósito'}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{new Date(d.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '16px', color: selectedGoal.color }}>+{selectedGoal.currency}{d.amount.toLocaleString()}</div>
                      <button onClick={() => { if (confirm(`¿Eliminar este depósito de €${d.amount}?`)) handleDeleteDeposit(d.id, d.amount, selectedGoal.id) }} disabled={isPending}
                        style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)', color: 'rgba(255,100,100,0.7)', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPending ? 0.5 : 1 }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <div>
                <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '900', fontSize: '26px', color: '#f0f0f5' }}>Mis metas 🎯</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{goals.length} metas · {completedGoals.length} completadas</div>
              </div>
              <button onClick={() => setShowNewGoal(true)} style={{ background: 'linear-gradient(135deg, #FF6B35, #FF8FAB)', border: 'none', borderRadius: '12px', padding: '10px 18px', color: '#fff', fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '13px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(255,107,53,0.35)' }}>+ Nueva meta</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <TotalPill totalSaved={totalSaved} currentFilter={filter} onFilterClick={handleFilterClick} />
              <StatPill label="Metas activas" value={activeGoals.length} color="#4ECDC4" filterKey="active" currentFilter={filter} onFilterClick={handleFilterClick} />
              <StatPill label="Completadas" value={completedGoals.length} color="#A78BFA" filterKey="completed" currentFilter={filter} onFilterClick={handleFilterClick} />
            </div>

            {goals.length > 0 && presentCategories.length > 2 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '4px' }}>
                {presentCategories.map((key) => {
                  const cat = CATEGORIES.find(c => c.key === key)
                  if (!cat) return null
                  const isActive = categoryFilter === key
                  return (
                    <button key={key} onClick={() => setCategoryFilter(key)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: isActive ? 'rgba(255,107,53,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isActive ? 'rgba(255,107,53,0.5)' : 'rgba(255,255,255,0.1)'}`, color: isActive ? '#FF6B35' : 'rgba(255,255,255,0.45)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0 }}>{cat.emoji} {cat.label}</button>
                  )
                })}
              </div>
            )}

            {(filter === 'active' || filter === 'completed') && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', animation: 'fadeIn 0.2s ease' }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>
                  Mostrando: <span style={{ color: filter === 'active' ? '#4ECDC4' : '#A78BFA', fontWeight: '700' }}>{filter === 'active' ? 'Metas activas' : 'Completadas'}</span>
                </div>
                <button onClick={() => setFilter('all')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px 10px', color: 'rgba(255,255,255,0.5)', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>Ver todas ×</button>
              </div>
            )}

            {goals.length > 0 && filter === 'all' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>PROGRESO GLOBAL</span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>€{totalSaved.toLocaleString()} / €{totalTarget.toLocaleString()}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #FF6B35, #FF8FAB, #A78BFA)', borderRadius: '100px', width: `${Math.min(100, (totalSaved / totalTarget) * 100)}%`, boxShadow: '0 0 12px rgba(255,107,53,0.5)' }}/>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredGoals.map((goal) => (
                <div key={goal.id} style={{ animation: 'fadeIn 0.25s ease' }}>
                  <GoalCard goal={goal} onClick={setSelectedGoal}/>
                </div>
              ))}
            </div>

            {filteredGoals.length === 0 && goals.length > 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.25)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>{filter === 'completed' ? '🏆' : categoryFilter !== 'todas' ? '🔍' : '⏳'}</div>
                <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '16px', color: 'rgba(255,255,255,0.35)' }}>
                  {filter === 'completed' ? 'Aún no has completado ninguna meta' : categoryFilter !== 'todas' ? 'Sin metas en esta categoría' : 'No hay metas activas'}
                </div>
              </div>
            )}

            {goals.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.25)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🐷</div>
                <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '18px', marginBottom: '8px', color: 'rgba(255,255,255,0.4)' }}>Sin metas aún</div>
                <div style={{ fontSize: '14px' }}>Crea tu primera meta de ahorro</div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
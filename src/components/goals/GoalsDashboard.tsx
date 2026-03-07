'use client'
// src/components/goals/GoalsDashboard.tsx
// Full interactive dashboard - same UI logic as the MVP demo
// but wired to real Supabase data via Server Actions

import { useState, useTransition } from 'react'
import type { Goal } from '@/types/database'
import { createGoalAction, addDepositAction, deleteGoalAction } from '@/app/dashboard/actions'

// ── Circular Progress ────────────────────────────────────────
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

// ── Goal Card ────────────────────────────────────────────────
function GoalCard({ goal, onClick }: { goal: Goal; onClick: (g: Goal) => void }) {
  const percentage = Math.min(100, Math.round((goal.saved_amount / goal.target_price) * 100))
  const remaining = goal.target_price - goal.saved_amount
  const isComplete = percentage >= 100

  return (
    <div onClick={() => onClick(goal)} style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '20px', padding: '24px', cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.borderColor = goal.color + '60'
        e.currentTarget.style.boxShadow = `0 20px 40px ${goal.color}20`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {isComplete && (
        <div style={{
          position: 'absolute', top: '12px', right: '12px',
          background: '#4ECDC4', color: '#0a0a0f',
          fontSize: '10px', fontWeight: '800', padding: '3px 8px',
          borderRadius: '20px', letterSpacing: '1px',
        }}>✓ LISTO</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '14px',
          background: goal.color + '20', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '24px', border: `1px solid ${goal.color}30`,
        }}>{goal.emoji}</div>
        <div>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '16px', color: '#f0f0f5' }}>
            {goal.name}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
            {isComplete ? '¡Meta alcanzada! 🎉' : `Faltan ${goal.currency}${remaining.toLocaleString()}`}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ position: 'relative' }}>
          <CircularProgress percentage={percentage} color={goal.color} size={72} strokeWidth={7}/>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '14px', color: goal.color,
          }}>{percentage}%</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '22px', color: '#f0f0f5' }}>
              {goal.currency}{goal.saved_amount.toLocaleString()}
            </span>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', alignSelf: 'flex-end', marginBottom: '2px' }}>
              de {goal.currency}{goal.target_price.toLocaleString()}
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: `linear-gradient(90deg, ${goal.color}88, ${goal.color})`,
              borderRadius: '100px', width: `${percentage}%`,
              transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: `0 0 10px ${goal.color}80`,
            }}/>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add Deposit Modal ────────────────────────────────────────
function AddDepositModal({ goal, onClose, onDeposit, isPending }: {
  goal: Goal; onClose: () => void
  onDeposit: (goalId: string, amount: number, note: string) => void
  isPending: boolean
}) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: '20px',
    }} onClick={onClose}>
      <div style={{
        background: '#16161f', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '400px',
        animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: goal.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
          }}>{goal.emoji}</div>
          <div>
            <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '18px', color: '#f0f0f5' }}>Añadir ahorro</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{goal.name}</div>
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
            CANTIDAD ({goal.currency})
          </label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00" autoFocus
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${amount ? goal.color + '60' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '12px', padding: '16px', color: '#f0f0f5',
              fontSize: '20px', fontFamily: "'Nunito', sans-serif", fontWeight: '800',
              outline: 'none', boxSizing: 'border-box' as const,
            }}/>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
            NOTA (opcional)
          </label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Paga de marzo, freelance..."
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
              padding: '14px 16px', color: '#f0f0f5', fontSize: '14px',
              outline: 'none', boxSizing: 'border-box' as const,
            }}/>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
          }}>Cancelar</button>
          <button
            onClick={() => { if (amount && parseFloat(amount) > 0) onDeposit(goal.id, parseFloat(amount), note || 'Depósito') }}
            disabled={isPending}
            style={{
              flex: 2, padding: '14px', borderRadius: '12px',
              background: `linear-gradient(135deg, ${goal.color}, ${goal.color}cc)`,
              border: 'none', color: '#fff', fontSize: '14px',
              fontFamily: "'Nunito', sans-serif", fontWeight: '800',
              cursor: 'pointer', opacity: isPending ? 0.7 : 1,
            }}>
            {isPending ? '...' : '💰 Añadir ahorro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── New Goal Modal ───────────────────────────────────────────
function NewGoalModal({ onClose, onCreate, isPending }: {
  onClose: () => void
  onCreate: (goal: { name: string; emoji: string; color: string; target_price: number; saved_amount: number; currency: string }) => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [price, setPrice] = useState('')
  const [initial, setInitial] = useState('')
  const colors = ['#FF6B35', '#4ECDC4', '#FFE66D', '#A78BFA', '#FF8FAB', '#6BCB77']
  const [color, setColor] = useState(colors[0])
  const emojis = ['🎯', '💻', '🎧', '🎮', '👟', '✈️', '📱', '🚗', '🏠', '⌚', '📷', '🎸']

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: '20px',
    }} onClick={onClose}>
      <div style={{
        background: '#16161f', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '440px',
        animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        maxHeight: '90vh', overflowY: 'auto' as const,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '22px', color: '#f0f0f5', marginBottom: '24px' }}>
          Nueva meta de ahorro ✨
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>EMOJI</label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {emojis.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} style={{
                width: '40px', height: '40px', borderRadius: '10px', fontSize: '20px',
                background: emoji === e ? color + '30' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${emoji === e ? color + '60' : 'rgba(255,255,255,0.1)'}`,
                cursor: 'pointer',
              }}>{e}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>COLOR</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {colors.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: '32px', height: '32px', borderRadius: '50%', background: c,
                border: `3px solid ${color === c ? '#fff' : 'transparent'}`,
                cursor: 'pointer', boxShadow: color === c ? `0 0 12px ${c}80` : 'none',
              }}/>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>NOMBRE DEL PRODUCTO</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ej: MacBook Pro M4" autoFocus
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
              padding: '14px 16px', color: '#f0f0f5', fontSize: '15px',
              outline: 'none', boxSizing: 'border-box' as const,
            }}/>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>PRECIO OBJETIVO (€)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                padding: '14px 16px', color: '#f0f0f5', fontSize: '15px',
                outline: 'none', boxSizing: 'border-box' as const,
              }}/>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>YA TENGO (€)</label>
            <input type="number" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0.00"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                padding: '14px 16px', color: '#f0f0f5', fontSize: '15px',
                outline: 'none', boxSizing: 'border-box' as const,
              }}/>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
          }}>Cancelar</button>
          <button
            onClick={() => {
              if (name && price) onCreate({ name, emoji, color, target_price: parseFloat(price), saved_amount: parseFloat(initial) || 0, currency: '€' })
            }}
            disabled={isPending}
            style={{
              flex: 2, padding: '14px', borderRadius: '12px',
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              border: 'none', color: '#fff', fontSize: '14px',
              fontFamily: "'Nunito', sans-serif", fontWeight: '800',
              cursor: 'pointer', opacity: isPending ? 0.7 : 1,
            }}>
            {isPending ? 'Creando...' : '🎯 Crear meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────
export default function GoalsDashboard({ initialGoals, userId }: {
  initialGoals: Goal[]
  userId: string
}) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [showNewGoal, setShowNewGoal] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [isPending, startTransition] = useTransition()

  const totalSaved = goals.reduce((s, g) => s + g.saved_amount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_price, 0)
  const completedGoals = goals.filter((g) => g.saved_amount >= g.target_price).length

  const handleCreateGoal = (goalData: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    startTransition(async () => {
      const newGoal = await createGoalAction(goalData)
      if (newGoal) setGoals((prev) => [newGoal, ...prev])
      setShowNewGoal(false)
    })
  }

  const handleDeposit = (goalId: string, amount: number, note: string) => {
    startTransition(async () => {
      await addDepositAction(goalId, amount, note)
      setGoals((prev) => prev.map((g) => g.id === goalId
        ? { ...g, saved_amount: g.saved_amount + amount }
        : g
      ))
      if (selectedGoal?.id === goalId) {
        setSelectedGoal((prev) => prev ? { ...prev, saved_amount: prev.saved_amount + amount } : null)
      }
      setShowDeposit(false)
    })
  }

  return (
    <>
      <style>{`
        @keyframes modalIn { from { transform: scale(0.85) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes fadeUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>

      {showNewGoal && (
        <NewGoalModal onClose={() => setShowNewGoal(false)} onCreate={handleCreateGoal} isPending={isPending}/>
      )}
      {showDeposit && selectedGoal && (
        <AddDepositModal goal={selectedGoal} onClose={() => setShowDeposit(false)} onDeposit={handleDeposit} isPending={isPending}/>
      )}

      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* Detail view */}
        {selectedGoal ? (
          <div style={{ animation: 'fadeUp 0.3s ease' }}>
            <button onClick={() => setSelectedGoal(null)} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '8px 16px', color: 'rgba(255,255,255,0.6)',
              fontSize: '13px', cursor: 'pointer', marginBottom: '24px',
            }}>← Volver</button>

            <div style={{
              background: `linear-gradient(135deg, ${selectedGoal.color}15, ${selectedGoal.color}05)`,
              border: `1px solid ${selectedGoal.color}30`,
              borderRadius: '24px', padding: '32px', textAlign: 'center', marginBottom: '16px',
            }}>
              <div style={{ fontSize: '52px', marginBottom: '12px' }}>{selectedGoal.emoji}</div>
              <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '24px', color: '#f0f0f5', marginBottom: '4px' }}>
                {selectedGoal.name}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '28px' }}>
                {selectedGoal.saved_amount >= selectedGoal.target_price
                  ? '🎉 ¡Meta completada!'
                  : `Faltan €${(selectedGoal.target_price - selectedGoal.saved_amount).toLocaleString()}`
                }
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', position: 'relative' }}>
                <CircularProgress
                  percentage={Math.min(100, Math.round((selectedGoal.saved_amount / selectedGoal.target_price) * 100))}
                  color={selectedGoal.color} size={160} strokeWidth={14}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '900', fontSize: '36px', color: selectedGoal.color }}>
                    {Math.min(100, Math.round((selectedGoal.saved_amount / selectedGoal.target_price) * 100))}%
                  </div>
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
              <button onClick={() => setShowDeposit(true)} style={{
                width: '100%', padding: '18px', borderRadius: '16px',
                background: `linear-gradient(135deg, ${selectedGoal.color}, ${selectedGoal.color}bb)`,
                border: 'none', color: '#fff', fontFamily: "'Nunito', sans-serif",
                fontWeight: '800', fontSize: '16px', cursor: 'pointer', marginBottom: '16px',
                boxShadow: `0 12px 32px ${selectedGoal.color}40`,
              }}>💰 Añadir ahorro</button>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <div>
                <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '900', fontSize: '26px', color: '#f0f0f5' }}>
                  Mis metas 🎯
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                  {goals.length} metas · {completedGoals} completadas
                </div>
              </div>
              <button onClick={() => setShowNewGoal(true)} style={{
                background: 'linear-gradient(135deg, #FF6B35, #FF8FAB)',
                border: 'none', borderRadius: '12px', padding: '10px 18px',
                color: '#fff', fontFamily: "'Nunito', sans-serif", fontWeight: '800',
                fontSize: '13px', cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(255,107,53,0.35)',
              }}>+ Nueva meta</button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Total ahorrado', value: `€${totalSaved.toLocaleString()}`, color: '#FF6B35' },
                { label: 'Metas activas', value: goals.length, color: '#4ECDC4' },
                { label: 'Completadas', value: completedGoals, color: '#A78BFA' },
              ].map((s, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px', padding: '16px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '18px', color: s.color, marginBottom: '4px' }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '600', letterSpacing: '0.3px' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Global progress */}
            {goals.length > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '16px', padding: '16px 20px', marginBottom: '24px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>PROGRESO GLOBAL</span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>
                    €{totalSaved.toLocaleString()} / €{totalTarget.toLocaleString()}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: 'linear-gradient(90deg, #FF6B35, #FF8FAB, #A78BFA)',
                    borderRadius: '100px', width: `${Math.min(100, (totalSaved / totalTarget) * 100)}%`,
                    boxShadow: '0 0 12px rgba(255,107,53,0.5)',
                  }}/>
                </div>
              </div>
            )}

            {/* Goals list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onClick={setSelectedGoal}/>
              ))}
            </div>

            {goals.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.25)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🐷</div>
                <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '700', fontSize: '18px', marginBottom: '8px', color: 'rgba(255,255,255,0.4)' }}>
                  Sin metas aún
                </div>
                <div style={{ fontSize: '14px' }}>Crea tu primera meta de ahorro</div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

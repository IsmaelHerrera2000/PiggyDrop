// src/app/goal/[id]/page.tsx
// Public page — no auth required, viewable by anyone

import { getPublicGoal } from '@/lib/goals'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// ── Types ─────────────────────────────────────────────────────
type Props = { params: Promise<{ id: string }> }

// ── Metadata ──────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const goal = await getPublicGoal(id)
  if (!goal) return { title: 'Meta no encontrada — PiggyDrop' }
  const pct = Math.min(100, Math.round((goal.saved_amount / goal.target_price) * 100))
  return {
    title: `${goal.emoji} ${goal.name} — ${pct}% | PiggyDrop`,
    description: `Sigue el progreso de mi meta de ahorro "${goal.name}" en PiggyDrop 🐷`,
    openGraph: {
      title: `${goal.emoji} ${goal.name} — ${pct}% completado`,
      description: `Meta de ahorro en PiggyDrop 🐷`,
    },
  }
}

// ── Helpers ───────────────────────────────────────────────────
function calcStreak(deposits: { created_at: string }[]): number {
  if (!deposits.length) return 0
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

// ── Page ──────────────────────────────────────────────────────
export default async function PublicGoalPage({ params }: Props) {
  const { id } = await params
  const goal = await getPublicGoal(id)
  if (!goal) notFound()

  const pct = Math.min(100, Math.round((goal.saved_amount / goal.target_price) * 100))
  const deps = goal.deposits ?? []
  const streak = calcStreak(deps)
  const isComplete = pct >= 100

  // Deposit history grouped by month (no amounts shown)
  const recentDeps = [...deps]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      fontFamily: "'Nunito', 'Inter', sans-serif",
      padding: '0 0 60px',
    }}>
      {/* Header bar */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '22px' }}>🐷</span>
          <span style={{ fontWeight: '900', fontSize: '16px', color: '#FF6B35' }}>PiggyDrop</span>
        </div>
        <a href="https://piggy-drop-fvof.vercel.app" style={{
          background: 'rgba(255,107,53,0.15)',
          border: '1px solid rgba(255,107,53,0.3)',
          color: '#FF6B35', fontSize: '12px', fontWeight: '700',
          padding: '6px 14px', borderRadius: '20px', textDecoration: 'none',
        }}>
          Crear mi cuenta →
        </a>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 20px 0' }}>

        {/* Hero card */}
        <div style={{
          background: `linear-gradient(135deg, ${goal.color}18, rgba(255,255,255,0.03))`,
          border: `1px solid ${goal.color}40`,
          borderRadius: '28px', padding: '32px 28px',
          textAlign: 'center', marginBottom: '20px',
          boxShadow: `0 20px 60px ${goal.color}15`,
        }}>
          <div style={{ fontSize: '56px', marginBottom: '8px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}>
            {goal.emoji}
          </div>
          <h1 style={{ fontWeight: '900', fontSize: '28px', color: '#f0f0f5', margin: '0 0 6px' }}>
            {goal.name}
          </h1>
          {goal.description && (
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '0 0 20px', fontStyle: 'italic' }}>
              {goal.description}
            </p>
          )}

          {/* Big percentage */}
          <div style={{
            fontWeight: '900', fontSize: '52px', lineHeight: 1,
            color: isComplete ? '#4ECDC4' : goal.color,
            marginBottom: '4px',
            textShadow: `0 0 40px ${isComplete ? '#4ECDC480' : goal.color + '60'}`,
          }}>
            {pct}%
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '20px', fontWeight: '600' }}>
            {isComplete ? '✅ ¡Meta alcanzada!' : 'completado'}
          </div>

          {/* Progress bar */}
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '100px', height: '10px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: isComplete
                ? 'linear-gradient(90deg, #4ECDC4, #44E5D8)'
                : `linear-gradient(90deg, ${goal.color}, ${goal.color}bb)`,
              borderRadius: '100px',
              boxShadow: `0 0 12px ${goal.color}60`,
              transition: 'width 1s ease',
            }}/>
          </div>
          {goal.public_show_amounts ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>
              <span style={{ color: goal.color, fontWeight: '700' }}>{goal.currency ?? '€'}{goal.saved_amount.toLocaleString('es-ES')}</span>
              <span>de {goal.currency ?? '€'}{goal.target_price.toLocaleString('es-ES')}</span>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'right', marginTop: '4px' }}>
              importes privados
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          {[
            { icon: '💸', label: 'Depósitos', value: deps.length },
            { icon: '🔥', label: 'Racha', value: streak > 0 ? `${streak}d` : '-' },
            { icon: '📅', label: 'Días', value: deps.length > 0 ? Math.floor((Date.now() - new Date(deps[deps.length - 1]?.created_at ?? Date.now()).getTime()) / 86400000) + 'd' : '-' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px', padding: '14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
              <div style={{ fontWeight: '900', fontSize: '18px', color: '#f0f0f5' }}>{s.value}</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recent activity (no amounts) */}
        {recentDeps.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px', padding: '20px', marginBottom: '20px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', marginBottom: '14px' }}>
              ACTIVIDAD RECIENTE
            </div>
            {recentDeps.map((d, i) => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: i < recentDeps.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: goal.color + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px',
                  }}>💰</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#f0f0f5' }}>
                      {d.note && d.note !== 'Ahorro inicial' ? d.note : 'Depósito'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                      {new Date(d.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: goal.color }}>
                  {goal.public_show_amounts ? `+${goal.currency ?? '€'}${d.amount.toLocaleString('es-ES')}` : `+${goal.currency ?? '€'}•••`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{
          background: 'rgba(255,107,53,0.08)',
          border: '1px solid rgba(255,107,53,0.2)',
          borderRadius: '20px', padding: '24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🐷</div>
          <div style={{ fontWeight: '800', fontSize: '16px', color: '#f0f0f5', marginBottom: '6px' }}>
            ¿Tú también tienes metas?
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
            Rastrea tus ahorros con PiggyDrop, totalmente gratis.
          </div>
          <a href="https://piggy-drop-fvof.vercel.app" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #FF6B35, #FF8F65)',
            color: '#fff', fontWeight: '900', fontSize: '15px',
            padding: '14px 32px', borderRadius: '14px', textDecoration: 'none',
            boxShadow: '0 8px 24px rgba(255,107,53,0.35)',
          }}>
            Empezar gratis →
          </a>
        </div>
      </div>
    </div>
  )
}
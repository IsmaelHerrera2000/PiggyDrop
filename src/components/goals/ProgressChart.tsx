'use client'
// src/components/goals/ProgressChart.tsx

import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer
} from 'recharts'
import type { Goal, Deposit } from '@/types/database'
import { getT } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'

// ── Custom Tooltip ────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; payload: { note?: string; dayTotal?: number } }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const { value, payload: { note, dayTotal } } = payload[0]
  return (
    <div style={{
      background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '12px', padding: '10px 14px', fontSize: '12px', minWidth: '140px',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: '800', fontSize: '18px', color: '#f0f0f5' }}>
        €{value.toLocaleString()}
      </div>
      {dayTotal !== undefined && dayTotal > 0 && (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '3px' }}>
          +€{dayTotal.toLocaleString()} ese día
        </div>
      )}
      {note && (
        <div style={{
          color: 'rgba(255,255,255,0.4)', marginTop: '4px', fontSize: '11px',
          borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '4px',
          maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{note}</div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function ProgressChart({ goal, locale = 'es' }: { goal: Goal; locale?: Locale }) {
  const t = getT(locale)
  const { data, color } = useMemo(() => {
    if (!goal.deposits || goal.deposits.length === 0) return { data: [], color: goal.color }

    // Ordenar depósitos por fecha
    const sorted = [...goal.deposits].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Agrupar por día: suma importes y concatena notas del mismo día
    const byDay = new Map<string, { date: string; dayTotal: number; notes: string[] }>()
    for (const d of sorted) {
      const key = new Date(d.created_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' })
      if (!byDay.has(key)) byDay.set(key, { date: key, dayTotal: 0, notes: [] })
      const entry = byDay.get(key)!
      entry.dayTotal += d.amount
      if (d.note) entry.notes.push(d.note)
    }

    // Construir serie acumulada sobre los días agrupados
    let cumulative = 0
    const points = Array.from(byDay.values()).map(day => {
      cumulative += day.dayTotal
      return {
        date: day.date,
        amount: Math.round(cumulative * 100) / 100,
        dayTotal: Math.round(day.dayTotal * 100) / 100,
        note: day.notes.length > 0 ? day.notes.join(', ') : 'Depósito',
      }
    })

    // Añadir punto inicial en 0
    if (points.length > 1) {
      const firstDate = new Date(sorted[0].created_at)
      firstDate.setDate(firstDate.getDate() - 1)
      points.unshift({
        date: firstDate.toLocaleDateString(locale === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' }),
        amount: 0,
        dayTotal: 0,
        note: '',
      })
    }

    return { data: points, color: goal.color }
  }, [goal])

  if (data.length < 2) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px', padding: '32px', textAlign: 'center',
        color: 'rgba(255,255,255,0.3)', fontSize: '13px',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📊</div>
        <div>{locale === 'en' ? 'You need at least 2 deposits to see the chart' : 'Necesitas al menos 2 depósitos para ver el gráfico'}</div>
      </div>
    )
  }

  const percentage = Math.min(100, Math.round((goal.saved_amount / goal.target_price) * 100))

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '20px', padding: '20px 8px 12px 4px',
    }}>
      <div style={{
        fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)',
        letterSpacing: '1px', paddingLeft: '16px', marginBottom: '16px',
      }}>
        {locale === 'en' ? 'SAVINGS PROGRESS' : 'EVOLUCIÓN DEL AHORRO'}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${goal.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `€${v}`}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Línea objetivo */}
          <ReferenceLine
            y={goal.target_price}
            stroke={color}
            strokeDasharray="6 3"
            strokeOpacity={0.4}
            label={{
              value: `Meta €${goal.target_price.toLocaleString()}`,
              fill: color,
              fontSize: 10,
              position: 'insideTopRight',
            }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#grad-${goal.id})`}
            dot={{ fill: color, strokeWidth: 0, r: 3 }}
            activeDot={{ fill: color, r: 5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '8px 16px 0',
        fontSize: '11px', color: 'rgba(255,255,255,0.3)',
      }}>
        <span>{goal.deposits?.length ?? 0} {locale === 'en' ? 'deposits' : 'depósitos'} · {data.length - 1} {locale === 'en' ? 'different days' : 'días distintos'}</span>
        <span style={{ color: color, fontWeight: '700' }}>{percentage}% {locale === 'en' ? 'complete' : 'completado'}</span>
      </div>
    </div>
  )
}
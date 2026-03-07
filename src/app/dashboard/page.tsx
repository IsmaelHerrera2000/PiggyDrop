// src/app/dashboard/page.tsx
// Server Component - fetches goals from Supabase server-side

import { createClient } from '@/lib/supabase/server'
import { getGoals } from '@/lib/goals'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/auth/actions'
import GoalsDashboard from '@/components/goals/GoalsDashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const goals = await getGoals()

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 100px; }
      `}</style>

      {/* Top nav */}
      <nav style={{
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,10,15,0.85)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px',
            background: 'linear-gradient(135deg, #FF6B35, #FF8FAB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
          }}>🐷</div>
          <span style={{
            fontFamily: "'Nunito', sans-serif", fontWeight: '900',
            fontSize: '18px', color: '#f0f0f5',
          }}>PiggyDrop</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user.user_metadata?.avatar_url && (
            <img
              src={user.user_metadata.avatar_url}
              alt="avatar"
              style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)' }}
            />
          )}
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
            {user.user_metadata?.full_name || user.email}
          </span>
          <form action={signOut}>
            <button type="submit" style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '6px 12px',
              color: 'rgba(255,255,255,0.5)', fontSize: '12px',
              cursor: 'pointer', fontWeight: '600',
            }}>
              Salir
            </button>
          </form>
        </div>
      </nav>

      {/* Main content - Client Component for interactivity */}
      <GoalsDashboard initialGoals={goals} userId={user.id} />
    </main>
  )
}

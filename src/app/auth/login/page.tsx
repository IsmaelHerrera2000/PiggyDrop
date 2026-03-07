// src/app/auth/login/page.tsx
import { signInWithGoogle } from '../actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(255,107,53,0.12) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #FF6B35, #FF8FAB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', margin: '0 auto 16px',
            boxShadow: '0 20px 40px rgba(255,107,53,0.3)',
          }}>🐷</div>
          <h1 style={{
            fontFamily: "'Syne', sans-serif", fontWeight: '900',
            fontSize: '32px', color: '#f0f0f5', marginBottom: '8px',
          }}>PiggyDrop</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '15px' }}>
            Ahorra para lo que quieres, de verdad.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '24px', padding: '36px',
        }}>
          <h2 style={{
            fontFamily: "'Syne', sans-serif", fontWeight: '800',
            fontSize: '20px', color: '#f0f0f5', marginBottom: '8px',
          }}>Empieza gratis</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '28px', lineHeight: '1.5' }}>
            Sin tarjeta. Sin contraseña que recordar. Solo entra con Google.
          </p>

          {error && (
            <div style={{
              background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)',
              borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
              color: '#ff8080', fontSize: '13px',
            }}>
              ⚠️ Algo salió mal. Inténtalo de nuevo.
            </div>
          )}

          {/* Google OAuth Button */}
          <form action={signInWithGoogle}>
            <button type="submit" style={{
              width: '100%', padding: '15px 20px',
              background: '#fff', border: 'none', borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              fontWeight: '600', fontSize: '15px', color: '#1a1a2e',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}>
              {/* Google SVG icon */}
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </button>
          </form>

          <p style={{
            textAlign: 'center', marginTop: '20px',
            fontSize: '12px', color: 'rgba(255,255,255,0.25)', lineHeight: '1.6',
          }}>
            Al continuar aceptas los términos de uso.<br />
            Tus datos son solo tuyos. 🔒
          </p>
        </div>

        {/* Features teaser */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '24px',
          marginTop: '28px', flexWrap: 'wrap',
        }}>
          {['💰 Metas de ahorro', '📊 Progreso visual', '🔔 Recordatorios'].map((f) => (
            <span key={f} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontWeight: '500' }}>
              {f}
            </span>
          ))}
        </div>
      </div>
    </main>
  )
}

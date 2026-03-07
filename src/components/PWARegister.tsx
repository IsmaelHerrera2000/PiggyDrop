'use client'
// src/components/PWARegister.tsx
// Registra el service worker y gestiona el prompt de instalación

import { useEffect, useState } from 'react'

export default function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Registrar service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('SW registrado:', reg.scope))
        .catch((err) => console.error('SW error:', err))
    }

    // Capturar el evento de instalación
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      // Mostrar banner solo si no fue descartado antes
      if (!localStorage.getItem('pwa-dismissed')) {
        setShowBanner(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setShowBanner(false)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('pwa-dismissed', '1')
  }

  if (!showBanner) return null

  return (
    <div style={{
      position: 'fixed', bottom: '20px', left: '50%',
      transform: 'translateX(-50%)', zIndex: 9999,
      width: 'calc(100% - 32px)', maxWidth: '420px',
      background: '#1a1a2a',
      border: '1px solid rgba(255,107,53,0.3)',
      borderRadius: '18px', padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: '14px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,107,53,0.1)',
      animation: 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
        background: 'linear-gradient(135deg, #FF6B35, #FF8FAB)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
      }}>🐷</div>

      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "'Nunito', sans-serif", fontWeight: '800',
          fontSize: '14px', color: '#f0f0f5', marginBottom: '2px',
        }}>Instalar PiggyDrop</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
          Añadir a pantalla de inicio
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleDismiss} style={{
          background: 'rgba(255,255,255,0.08)', border: 'none',
          borderRadius: '10px', padding: '8px 12px',
          color: 'rgba(255,255,255,0.5)', fontSize: '12px',
          cursor: 'pointer', fontWeight: '600',
        }}>Ahora no</button>
        <button onClick={handleInstall} style={{
          background: 'linear-gradient(135deg, #FF6B35, #FF8FAB)',
          border: 'none', borderRadius: '10px', padding: '8px 14px',
          color: '#fff', fontSize: '12px', cursor: 'pointer',
          fontFamily: "'Nunito', sans-serif", fontWeight: '800',
          boxShadow: '0 4px 12px rgba(255,107,53,0.4)',
        }}>Instalar</button>
      </div>
    </div>
  )
}

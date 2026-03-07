// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import PWARegister from '@/components/PWARegister'

export const metadata: Metadata = {
  title: 'PiggyDrop — Ahorra para lo que quieres',
  description: 'Define tus metas de ahorro, registra tu progreso y consigue lo que quieres.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PiggyDrop',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#FF6B35',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body style={{ margin: 0, background: '#0a0a0f' }}>
        {children}
        <PWARegister />
      </body>
    </html>
  )
}

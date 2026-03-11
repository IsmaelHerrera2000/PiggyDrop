import type { Metadata, Viewport } from 'next'
import { Nunito } from 'next/font/google'
import './globals.css'

const nunito = Nunito({ subsets: ['latin'], weight: ['400','500','600','700','800','900'] })

export const viewport: Viewport = {
  themeColor: '#FF6B35',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'PiggyDrop',
  description: 'Tracker de metas de ahorro',
  manifest: '/manifest.json',
  metadataBase: new URL('https://piggy-drop-fvof.vercel.app'),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PiggyDrop',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png',      sizes: '192x192', type: 'image/png' },
      { url: '/favicon.ico',             sizes: 'any' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/icon-512.png' },
    ],
  },
  openGraph: {
    title: 'PiggyDrop',
    description: 'Tracker de metas de ahorro',
    images: [{ url: '/icons/og-image.png', width: 1200, height: 1200 }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={nunito.className} suppressHydrationWarning>

        {children}
      </body>
    </html>
  )
}

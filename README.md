# 🐷 PiggyDrop

**Ahorra para lo que quieres, de verdad.**

Una app para crear metas de ahorro vinculadas a productos concretos, registrar depósitos y visualizar tu progreso de forma motivadora.

![PiggyDrop Screenshot](./public/screenshot.png)

## ✨ Features

- 🎯 **Metas de ahorro** personalizadas con emoji, color y precio objetivo
- 💰 **Registro de depósitos** con notas y fechas
- 📊 **Progreso visual** con animaciones y barras circulares
- 🔐 **Auth con Google** — login en un clic, sin contraseñas
- 🔒 **Datos privados** — Row Level Security en Supabase
- 📱 **Responsive** — funciona en móvil y desktop

## 🛠️ Tech Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth + DB | Supabase (PostgreSQL + RLS) |
| OAuth | Google via Supabase Auth |
| Estilos | CSS-in-JS (inline styles) |
| Deploy | Vercel |

## 🚀 Setup

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/piggydrop
cd piggydrop
npm install
```

### 2. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto gratis
2. En **SQL Editor**, ejecuta el contenido de `supabase/migrations/001_initial_schema.sql`
3. En **Authentication → Providers**, activa **Google**:
   - Necesitas un Client ID y Secret de [Google Cloud Console](https://console.cloud.google.com)
   - Crea un proyecto → APIs & Services → Credentials → OAuth 2.0 Client ID
   - Authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`

### 3. Variables de entorno

```bash
cp .env.local.example .env.local
```

Rellena con tus credenciales de Supabase (Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 4. Arrancar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## 📦 Deploy en Vercel

```bash
npx vercel
```

Añade las variables de entorno en el dashboard de Vercel.  
Actualiza el **Site URL** en Supabase → Authentication → URL Configuration:
```
https://tu-app.vercel.app
```

## 🗺️ Roadmap

- [ ] Price tracker — alertas cuando el producto baja de precio (SerpAPI)
- [ ] Notificaciones push (Expo para móvil)
- [ ] Compartir meta en redes sociales
- [ ] Modo freemium (máx. 3 metas gratis)
- [ ] App móvil con React Native + Expo

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── auth/
│   │   ├── actions.ts        # signInWithGoogle, signOut
│   │   ├── callback/route.ts # OAuth redirect handler
│   │   └── login/page.tsx    # Login page
│   ├── dashboard/
│   │   ├── page.tsx          # Server Component (fetch goals)
│   │   └── actions.ts        # Server Actions (mutations)
│   ├── layout.tsx
│   └── page.tsx              # Redirect to /dashboard or /login
├── components/
│   └── goals/
│       └── GoalsDashboard.tsx # Client Component (UI interactivo)
├── lib/
│   ├── goals.ts              # Data access layer
│   └── supabase/
│       ├── client.ts         # Browser client
│       └── server.ts         # Server client (SSR)
├── types/
│   └── database.ts           # TypeScript types generados
middleware.ts                 # Session refresh + route protection
supabase/
└── migrations/
    └── 001_initial_schema.sql
```

## 📄 Licencia

MIT

<div align="center">

<img src="public/icons/icon-192x192.png" alt="PiggyDrop Logo" width="96" height="96" />

# 🐷 PiggyDrop

**Tu gestor de metas de ahorro personal**

Visualiza tus objetivos, registra depósitos y celebra cada logro — todo en una PWA rápida y sin fricción.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://typescriptlang.org)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000?logo=vercel)](https://piggy-drop-fvof.vercel.app)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps)

[**→ Ver demo en vivo**](https://piggy-drop-fvof.vercel.app)

</div>

---

## ✨ Características

### 🎯 Metas de ahorro
- Crea metas con nombre, emoji, color y categoría personalizados
- Seguimiento visual con gráfico circular de progreso
- Fecha objetivo con cálculo automático de ahorro mensual necesario
- Descripción opcional para cada meta
- Fijar metas importantes (pin) para verlas siempre primero

### 💰 Depósitos
- Añade y edita depósitos con notas
- Historial completo con fecha y descripción
- Vista global de todos los depósitos de todas las metas
- Ahorro inicial al crear la meta

### 📊 Estadísticas y visualización
- Gráfico de evolución del ahorro (Recharts)
- Mayor depósito, promedio y racha activa
- Progreso global de todas las metas
- Fecha estimada de finalización basada en tu ritmo actual

### 🔥 Rachas y logros
- Contador de días consecutivos con depósitos
- Badges de hito en las tarjetas (🔥 racha, ⏰ inactividad, 🏁 casi llegaste)
- Confetti al alcanzar el 25%, 50%, 75% y 100%

### 🔔 Notificaciones push
- Alertas diarias personalizadas vía Web Push API
- Recordatorio si llevas 7+ días sin ahorrar
- Celebración al completar tu objetivo semanal o mensual
- Notificaciones en hitos de racha (3, 7, 14, 21, 30, 60, 100 días)
- Cron job automático en Vercel (10:00 cada día)

### 🌐 Metas públicas
- Comparte cualquier meta con un enlace público sin necesidad de cuenta
- Control de privacidad: elige si mostrar o no los importes
- Metadatos Open Graph para previsualización al compartir en redes

### 🛠️ Personalización
- 8 colores, 38 emojis y 16 categorías
- Selector de moneda (€, $, £, ¥)
- Ocultar todos los importes con un clic 👁️
- Idioma automático (ES / EN) según el navegador
- Período de ahorro: ninguno / mensual / semanal
- Ordenar por: más reciente, % completado, nombre, importe

### 📱 PWA
- Instalable en móvil y escritorio
- Funciona como app nativa (sin barra de navegador)
- Iconos completos para todos los tamaños

---

## 🖼️ Capturas

| Dashboard | Detalle de meta | Menú de opciones |
|-----------|----------------|-----------------|
| _(próximamente)_ | _(próximamente)_ | _(próximamente)_ |

---

## 🚀 Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | [Next.js 15](https://nextjs.org) (App Router + Server Actions) |
| Base de datos | [Supabase](https://supabase.com) (PostgreSQL + RLS) |
| Auth | Google OAuth vía Supabase Auth |
| Estilos | CSS-in-JS (inline styles) + Nunito font |
| Gráficos | [Recharts](https://recharts.org) |
| Push | Web Push API + [web-push](https://www.npmjs.com/package/web-push) |
| Deploy | [Vercel](https://vercel.com) |
| Lenguaje | TypeScript 5 |

---

## 🗂️ Estructura del proyecto

```
src/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx          # Página principal (SSR)
│   │   └── actions.ts        # Server Actions
│   ├── goal/[id]/
│   │   └── page.tsx          # Página pública de meta
│   └── api/
│       └── push/
│           ├── subscribe/    # Suscripción Web Push
│           └── send/         # Cron: envío de notificaciones
├── components/
│   └── goals/
│       ├── GoalsDashboard.tsx  # Componente principal
│       └── ProgressChart.tsx   # Gráfico de evolución
├── lib/
│   ├── goals.ts              # Data layer (Supabase queries)
│   └── i18n.ts               # Traducciones ES/EN
├── types/
│   └── database.ts           # Tipos TypeScript
└── middleware.ts             # Protección de rutas
public/
├── sw.js                     # Service Worker (PWA + Push)
└── icons/                    # Iconos PWA
supabase/migrations/          # Migraciones SQL
vercel.json                   # Configuración cron
```

---

## ⚙️ Instalación local

### Prerrequisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Vercel](https://vercel.com) (para deploy)
- Proyecto OAuth configurado en [Google Cloud Console](https://console.cloud.google.com)

### 1. Clonar e instalar

```bash
git clone https://github.com/IsmaelHerrera2000/PiggyDrop.git
cd PiggyDrop
npm install
```

### 2. Variables de entorno

Crea un archivo `.env.local` en la raíz:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Web Push (genera las claves con el comando de abajo)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=tu-clave-publica
VAPID_PRIVATE_KEY=tu-clave-privada
VAPID_EMAIL=mailto:tu@email.com

# Cron (cualquier string aleatorio)
CRON_SECRET=un-secreto-aleatorio
```

Genera las claves VAPID:

```bash
npx web-push generate-vapid-keys
```

### 3. Migraciones de base de datos

Ejecuta en orden en el **SQL Editor de Supabase**:

```
supabase/migrations/001_initial.sql
supabase/migrations/002_categories.sql
supabase/migrations/003_push_and_monthly.sql
supabase/migrations/004_push_locale.sql
supabase/migrations/005_description_target_date.sql
supabase/migrations/006_savings_period.sql
supabase/migrations/007_is_public.sql
supabase/migrations/008_public_show_amounts.sql
```

### 4. Google OAuth

En tu proyecto de Supabase → **Authentication → Providers → Google**, añade:

- **Client ID** y **Client Secret** de tu app de Google Cloud
- En Google Cloud Console → URI de redirección autorizada: `https://tu-proyecto.supabase.co/auth/v1/callback`

### 5. Ejecutar en local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 🗄️ Esquema de base de datos

```sql
goals
  id, user_id, name, emoji, color, category
  target_price, saved_amount
  monthly_target, savings_period ('monthly' | 'weekly')
  description, target_date
  is_public, public_show_amounts
  created_at, updated_at

deposits
  id, goal_id, user_id, amount, note, created_at

push_subscriptions
  id, user_id, subscription (jsonb), locale, created_at
```

> Los triggers de Supabase recalculan `saved_amount` automáticamente al insertar o eliminar depósitos.

---

## 🚢 Deploy en Vercel

```bash
vercel --prod
```

Añade todas las variables de entorno en **Vercel → Settings → Environment Variables**.

El cron job (`/api/push/send`) se ejecuta automáticamente cada día a las 10:00 UTC gracias a `vercel.json`.

---

## 🗺️ Roadmap

- [ ] Rastreador de precios automático (SerpAPI)
- [ ] Modelo freemium (máx. 3 metas gratis)
- [ ] Exportar historial a CSV
- [ ] Duplicar meta
- [ ] Búsqueda y filtros avanzados
- [ ] Notificaciones por email

---

## 📄 Licencia

MIT © [Ismael Herrera](https://github.com/IsmaelHerrera2000)

---

<div align="center">
  Hecho con 🐷 y mucho café
</div>
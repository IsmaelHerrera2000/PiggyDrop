'use server'
// src/app/dashboard/actions.ts

import { revalidatePath } from 'next/cache'
import { createGoal, addDeposit, deleteGoal, updateGoal, deleteDeposit, savePushSubscription, deletePushSubscription } from '@/lib/goals'
import { createClient } from '@/lib/supabase/server'
import type { Goal } from '@/types/database'

export async function createGoalAction(goalData: {
  name: string
  emoji: string
  color: string
  target_price: number
  saved_amount: number
  currency: string
  category: string
  monthly_target?: number | null
  savings_period?: 'monthly' | 'weekly' | null
  description?: string | null
  target_date?: string | null
  locale?: string
}): Promise<Goal | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const goal = await createGoal({
    name: goalData.name,
    emoji: goalData.emoji,
    color: goalData.color,
    target_price: goalData.target_price,
    saved_amount: 0,
    currency: goalData.currency,
    category: goalData.category,
    monthly_target: goalData.monthly_target ?? null,
    savings_period: goalData.savings_period ?? null,
    description: goalData.description ?? null,
    target_date: goalData.target_date ?? null,
  })

  if (goal && goalData.saved_amount > 0) {
    await addDeposit({
      goal_id: goal.id,
      user_id: user.id,
      amount: goalData.saved_amount,
      note: 'Ahorro inicial',
    })
  }

  // Notificación FCM — meta creada
  if (goal) {
    try {
      const remaining = goalData.target_price - (goalData.saved_amount ?? 0)
      const locale = goalData.locale ?? 'es'
      const isEN = locale === 'en'
      const title = isEN ? `🎯 New goal created!` : `🎯 ¡Nueva meta creada!`
      const body = isEN
        ? `"${goalData.name}" — ${goalData.currency ?? '€'}${remaining.toLocaleString('en')} to go. You got this! 💪`
        : `"${goalData.name}" — Solo faltan ${goalData.currency ?? '€'}${remaining.toLocaleString('es-ES')} para poder comprarlo. ¡Tú puedes! 💪`

      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
      const serviceSupabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: tokens } = await serviceSupabase
        .from('fcm_tokens')
        .select('token')
        .eq('user_id', user.id)

      if (tokens && tokens.length > 0) {
        const { sendNotificationToUser } = await import('@/lib/fcm-server')
        await sendNotificationToUser(user.id, title, body, { url: '/dashboard' })
      }
    } catch (e) {
      console.error('FCM notification error (createGoal):', e)
    }
  }

  revalidatePath('/dashboard')
  return goal
}

export async function updateGoalAction(
  goalId: string,
  updates: {
    name?: string
    emoji?: string
    color?: string
    target_price?: number
    currency?: string
    category?: string
    monthly_target?: number | null
    savings_period?: 'monthly' | 'weekly' | null
  }
): Promise<Goal | null> {
  const goal = await updateGoal(goalId, updates)
  revalidatePath('/dashboard')
  return goal
}

export async function addDepositAction(
  goalId: string,
  amount: number,
  note: string
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Obtener estado actual de la meta ANTES del depósito
  const { data: goalBefore } = await supabase
    .from('goals')
    .select('saved_amount, target_price, name, emoji, currency')
    .eq('id', goalId)
    .single()

  await addDeposit({ goal_id: goalId, user_id: user.id, amount, note })
  revalidatePath('/dashboard')

  // Notificación FCM — meta completada al 100%
  if (goalBefore) {
    const newSaved = goalBefore.saved_amount + amount
    const wasComplete = goalBefore.saved_amount >= goalBefore.target_price
    const isNowComplete = newSaved >= goalBefore.target_price

    if (!wasComplete && isNowComplete) {
      try {
        const { createClient: createServiceClient } = await import('@supabase/supabase-js')
        const serviceSupabase = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Obtener locale del usuario
        const { data: tokenRow } = await serviceSupabase
          .from('fcm_tokens')
          .select('locale')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        const isEN = tokenRow?.locale === 'en'
        const title = isEN
          ? `🎉 Goal completed!`
          : `🎉 ¡Meta completada!`
        const body = isEN
          ? `You saved ${goalBefore.currency}${goalBefore.target_price.toLocaleString('en')} for "${goalBefore.name}". Time to treat yourself! ${goalBefore.emoji}`
          : `Has ahorrado ${goalBefore.currency}${goalBefore.target_price.toLocaleString('es-ES')} para "${goalBefore.name}". ¡Ha llegado el momento! ${goalBefore.emoji}`

        const { sendNotificationToUser } = await import('@/lib/fcm-server')
        await sendNotificationToUser(user.id, title, body, { url: '/dashboard' })
        console.log('FCM goal completed notification sent')
      } catch (e) {
        console.error('FCM notification error (goalCompleted):', e)
      }
    }
  }
}

export async function deleteDepositAction(
  depositId: string,
  _amount: number,
  _goalId: string
): Promise<void> {
  await deleteDeposit(depositId)
  revalidatePath('/dashboard')
}

export async function deleteGoalAction(goalId: string): Promise<void> {
  await deleteGoal(goalId)
  revalidatePath('/dashboard')
}

export async function subscribePushAction(sub: {
  endpoint: string
  p256dh: string
  auth: string
  locale?: string
}): Promise<boolean> {
  return savePushSubscription(sub)
}

export async function unsubscribePushAction(endpoint: string): Promise<boolean> {
  return deletePushSubscription(endpoint)
}

export async function toggleGoalPublicAction(goalId: string, isPublic: boolean): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { toggleGoalPublic } = await import('@/lib/goals')
  const ok = await toggleGoalPublic(goalId, isPublic)
  revalidatePath('/dashboard')
  return ok
}

export async function toggleGoalShowAmountsAction(goalId: string, show: boolean): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { toggleGoalShowAmounts } = await import('@/lib/goals')
  const ok = await toggleGoalShowAmounts(goalId, show)
  revalidatePath('/dashboard')
  return ok
}
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
}): Promise<Goal | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const goal = await createGoal({
    name: goalData.name,
    emoji: goalData.emoji,
    color: goalData.color,
    target_price: goalData.target_price,
    saved_amount: goalData.saved_amount,
    currency: goalData.currency,
    category: goalData.category,
    monthly_target: goalData.monthly_target ?? null,
  })

  if (goal && goalData.saved_amount > 0) {
    await addDeposit({
      goal_id: goal.id,
      user_id: user.id,
      amount: goalData.saved_amount,
      note: 'Ahorro inicial',
    })
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

  await addDeposit({ goal_id: goalId, user_id: user.id, amount, note })
  revalidatePath('/dashboard')
}

export async function deleteDepositAction(
  depositId: string,
  _amount: number,
  _goalId: string
): Promise<void> {
  // El trigger de Supabase recalcula saved_amount automáticamente
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

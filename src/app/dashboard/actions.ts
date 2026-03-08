'use server'
// src/app/dashboard/actions.ts

import { revalidatePath } from 'next/cache'
import { createGoal, addDeposit, deleteGoal, updateGoal, deleteDeposit } from '@/lib/goals'
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

  await addDeposit({
    goal_id: goalId,
    user_id: user.id,
    amount,
    note,
  })

  revalidatePath('/dashboard')
}

export async function deleteDepositAction(
  depositId: string,
  amount: number,
  goalId: string
): Promise<void> {
  const supabase = await createClient()
  // Update saved_amount in goal
  const { data: goal } = await supabase
    .from('goals')
    .select('saved_amount')
    .eq('id', goalId)
    .single()

  if (goal) {
    const newAmount = Math.max(0, goal.saved_amount - amount)
    await supabase
      .from('goals')
      .update({ saved_amount: newAmount, updated_at: new Date().toISOString() })
      .eq('id', goalId)
  }

  await deleteDeposit(depositId)
  revalidatePath('/dashboard')
}

export async function deleteGoalAction(goalId: string): Promise<void> {
  await deleteGoal(goalId)
  revalidatePath('/dashboard')
}
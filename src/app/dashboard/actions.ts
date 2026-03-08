// src/app/dashboard/actions.ts
'use server'

import { createGoal, addDeposit } from '@/lib/goals'
import { revalidatePath } from 'next/cache'

export async function createGoalAction(goalData: {
  name: string
  emoji: string
  color: string
  target_price: number
  saved_amount: number
  currency: string
}) {
  try {
    const goal = await createGoal(goalData)

    // Si hay cantidad inicial, crear un depósito para que quede en el historial
    if (goal && goalData.saved_amount > 0) {
      await addDeposit({
        goal_id: goal.id,
        amount: goalData.saved_amount,
        note: 'Ahorro inicial',
      })
    }

    revalidatePath('/dashboard')
    return goal
  } catch (error) {
    console.error('Failed to create goal:', error)
    return null
  }
}

export async function addDepositAction(goalId: string, amount: number, note: string) {
  try {
    const deposit = await addDeposit({ goal_id: goalId, amount, note })
    revalidatePath('/dashboard')
    return { success: true, deposit }
  } catch (error) {
    console.error('Failed to add deposit:', error)
    return { success: false }
  }
}

export async function deleteGoalAction(goalId: string) {
  try {
    const { deleteGoal } = await import('@/lib/goals')
    await deleteGoal(goalId)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete goal:', error)
    return { success: false }
  }
}
// src/lib/goals.ts
// Server-side data access functions for goals and deposits

import { createClient } from './supabase/server'
import type { GoalInsert, DepositInsert } from '@/types/database'

// ── GOALS ────────────────────────────────────────────────────

export async function getGoals() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getGoalById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('goals')
    .select(`*, deposits(*)`)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createGoal(goal: Omit<GoalInsert, 'user_id'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('goals')
    .insert({ ...goal, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteGoal(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ── DEPOSITS ─────────────────────────────────────────────────

export async function getDepositsForGoal(goalId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function addDeposit(deposit: Omit<DepositInsert, 'user_id'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('deposits')
    .insert({ ...deposit, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return data
  // The DB trigger will automatically update goal.saved_amount
}

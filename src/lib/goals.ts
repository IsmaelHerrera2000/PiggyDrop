// src/lib/goals.ts
import { createClient } from '@/lib/supabase/server'
import type { Goal, GoalInsert, Deposit, DepositInsert } from '@/types/database'

export async function getGoals(): Promise<Goal[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('goals')
    .select('*, deposits(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) { console.error('Error fetching goals:', error); return [] }
  return (data ?? []) as Goal[]
}

export async function getGoalById(id: string): Promise<Goal | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('goals')
    .select('*, deposits(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Goal
}

export async function createGoal(goal: Omit<GoalInsert, 'user_id'>): Promise<Goal | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('goals')
    .insert({ ...goal, user_id: user.id })
    .select()
    .single()

  if (error) { console.error('Error creating goal:', error); return null }
  return data as Goal
}

export async function updateGoal(id: string, updates: {
  name?: string
  emoji?: string
  color?: string
  target_price?: number
  currency?: string
  category?: string
  monthly_target?: number | null
}): Promise<Goal | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) { console.error('Error updating goal:', error); return null }
  return data as Goal
}

export async function deleteGoal(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) { console.error('Error deleting goal:', error); return false }
  return true
}

export async function getDepositsForGoal(goalId: string): Promise<Deposit[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}

export async function addDeposit(deposit: DepositInsert): Promise<Deposit | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('deposits')
    .insert(deposit)
    .select()
    .single()
  if (error) { console.error('Error adding deposit:', error); return null }
  return data
}

export async function deleteDeposit(depositId: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from('deposits').delete().eq('id', depositId)
  if (error) { console.error('Error deleting deposit:', error); return false }
  return true
}

// ── Push subscriptions ────────────────────────────────────────

export async function savePushSubscription(sub: {
  endpoint: string
  p256dh: string
  auth: string
  locale?: string
}): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: user.id, ...sub, locale: sub.locale ?? 'es' }, { onConflict: 'endpoint' })

  if (error) { console.error('Error saving push sub:', error); return false }
  return true
}

export async function deletePushSubscription(endpoint: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
  if (error) return false
  return true
}

// Used by cron — gets all subscriptions with their user's goals
export async function getAllSubscriptionsWithGoals(): Promise<{
  endpoint: string
  p256dh: string
  auth: string
  user_id: string
  locale: string
  goals: Goal[]
}[]> {
  const supabase = await createClient()

  const { data: subs, error: subError } = await supabase
    .from('push_subscriptions')
    .select('*')

  if (subError || !subs?.length) return []

  const results = await Promise.all(subs.map(async (sub) => {
    const { data: goals } = await supabase
      .from('goals')
      .select('*, deposits(*)')
      .eq('user_id', sub.user_id)
    return { ...sub, goals: (goals ?? []) as Goal[] }
  }))

  return results
}

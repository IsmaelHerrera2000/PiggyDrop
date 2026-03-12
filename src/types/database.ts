// src/types/database.ts

export type Database = {
  public: {
    Tables: {
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          emoji: string
          color: string
          target_price: number
          saved_amount: number
          currency: string
          category: string
          monthly_target: number | null
          is_public: boolean
          public_show_amounts: boolean
          savings_period: 'monthly' | 'weekly' | null
          description: string | null
          target_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          emoji?: string
          color?: string
          target_price: number
          saved_amount?: number
          currency?: string
          category?: string
          monthly_target?: number | null
          is_public?: boolean
          public_show_amounts?: boolean
          savings_period?: 'monthly' | 'weekly' | null
          description?: string | null
          target_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          emoji?: string
          color?: string
          target_price?: number
          saved_amount?: number
          currency?: string
          category?: string
          monthly_target?: number | null
          is_public?: boolean
          public_show_amounts?: boolean
          savings_period?: 'monthly' | 'weekly' | null
          description?: string | null
          target_date?: string | null
          updated_at?: string
        }
      }
      deposits: {
        Row: {
          id: string
          goal_id: string
          user_id: string
          amount: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          goal_id: string
          user_id: string
          amount: number
          note?: string | null
          created_at?: string
        }
        Update: never
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: never
      }
    }
  }
}

export type GoalRow = Database['public']['Tables']['goals']['Row']
export type GoalInsert = Database['public']['Tables']['goals']['Insert']
export type Deposit = Database['public']['Tables']['deposits']['Row']
export type DepositInsert = Database['public']['Tables']['deposits']['Insert']

export type Goal = GoalRow & {
  deposits?: Deposit[]
}
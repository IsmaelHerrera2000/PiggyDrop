// src/app/api/fcm/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { token, locale = 'es', platform = 'web' } = await req.json()
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

    // Upsert — if token exists update locale/platform, otherwise insert
    const { error } = await supabase
      .from('fcm_tokens')
      .upsert(
        { user_id: user.id, token, locale, platform, updated_at: new Date().toISOString() },
        { onConflict: 'token' }
      )

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('FCM subscribe error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

    await supabase
      .from('fcm_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token', token)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('FCM unsubscribe error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

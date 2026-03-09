// src/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { subscribePushAction, unsubscribePushAction } from '@/app/dashboard/actions'

export async function POST(req: NextRequest) {
  try {
    const { endpoint, keys } = await req.json()
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }
    const ok = await subscribePushAction({ endpoint, p256dh: keys.p256dh, auth: keys.auth })
    return NextResponse.json({ ok })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json()
    const ok = await unsubscribePushAction(endpoint)
    return NextResponse.json({ ok })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

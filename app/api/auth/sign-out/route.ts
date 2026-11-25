import { NextResponse } from 'next/server'
import { signOutSession } from '@/lib/auth'

export async function POST() {
  await signOutSession()
  return NextResponse.json({ ok: true })
}

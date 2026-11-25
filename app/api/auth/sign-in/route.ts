import { NextResponse } from 'next/server'
import { z } from 'zod'
import { signInWithEmail } from '@/lib/auth'

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = signInSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 400 })
    }

    const user = await signInWithEmail(parsed.data.email, parsed.data.password)
    if (!user) {
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
    }

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: 'Unable to sign in right now.' }, { status: 500 })
  }
}

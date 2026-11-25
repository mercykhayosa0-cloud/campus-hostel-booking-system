import 'server-only'
import { randomBytes, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { account, session, user } from '@/lib/db/schema'
import { verifyPassword } from '@/lib/password'

export type Role = 'student' | 'officer' | 'caretaker'

export const SESSION_COOKIE_NAME = 'hostel_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export async function signInWithEmail(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      passwordHash: account.password,
    })
    .from(user)
    .innerJoin(account, and(eq(account.userId, user.id), eq(account.providerId, 'credential')))
    .where(eq(user.email, normalizedEmail))
    .limit(1)

  if (!row || !row.passwordHash) return null

  const valid = await verifyPassword(password, row.passwordHash)
  if (!valid) return null

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await db.insert(session).values({
    id: randomUUID(),
    token,
    userId: row.id,
    expiresAt,
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })

  return { id: row.id, name: row.name, email: row.email, role: row.role as Role }
}

export async function signOutSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (token) {
    await db.delete(session).where(eq(session.token, token))
  }
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(and(eq(session.token, token), gt(session.expiresAt, new Date())))
    .limit(1)

  if (!row) return null
  return { id: row.id, name: row.name, email: row.email, role: row.role as Role }
}

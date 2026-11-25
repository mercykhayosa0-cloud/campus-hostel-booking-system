import 'server-only'
import { redirect } from 'next/navigation'
import { getSessionUser, type Role } from '@/lib/auth'

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: Role
}

export const dashboardPathFor: Record<Role, string> = {
  student: '/student',
  officer: '/officer',
  caretaker: '/caretaker',
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return getSessionUser()
}

/** Server-side authorization gate for pages and server actions. */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (user.role !== role) redirect(dashboardPathFor[user.role])
  return user
}

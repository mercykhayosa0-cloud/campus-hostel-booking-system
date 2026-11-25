import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth, type Role } from '@/lib/auth'

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
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const { id, name, email, role } = session.user
  return { id, name, email, role: role as Role }
}

/** Server-side authorization gate for pages and server actions. */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  if (user.role !== role) redirect(dashboardPathFor[user.role])
  return user
}

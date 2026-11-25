import { redirect } from 'next/navigation'
import { dashboardPathFor, getCurrentUser } from '@/lib/session'

export default async function HomePage() {
  const user = await getCurrentUser()
  redirect(user ? dashboardPathFor[user.role] : '/sign-in')
}

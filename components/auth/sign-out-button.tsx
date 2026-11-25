'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function handleSignOut() {
    setIsPending(true)
    await fetch('/api/auth/sign-out', { method: 'POST' })
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={isPending}>
      <LogOut className="size-4" aria-hidden="true" />
      Sign out
    </Button>
  )
}

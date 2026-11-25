import { MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { KisiiCrest } from '@/components/kisii-crest'
import type { CurrentUser } from '@/lib/session'

const roleLabel: Record<CurrentUser['role'], string> = {
  student: 'Student',
  officer: 'Accommodation Officer',
  caretaker: 'Hall Caretaker',
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function AppShell({
  user,
  title,
  description,
  children,
}: {
  user: CurrentUser
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-gold to-primary" />
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <KisiiCrest className="size-9" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">Kisii University</span>
              <span className="text-xs text-muted-foreground">Hostel &amp; Accommodation Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20">
                {getInitials(user.name)}
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium leading-none">{user.name}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">{user.email}</span>
              </div>
            </div>
            <Badge variant="secondary" className="border border-primary/20 bg-primary/10 text-primary">
              {roleLabel[user.role]}
            </Badge>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-1.5 border-b pb-5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <MapPin className="size-3.5" aria-hidden="true" />
            <span>Main Campus · Kisii, Kenya</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
          {description ? <p className="max-w-2xl text-sm text-muted-foreground text-pretty">{description}</p> : null}
        </div>
        {children}
      </main>

      <footer className="border-t bg-background/60 py-5">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>Kisii University · Directorate of Student Accommodation</span>
          <span>P.O. Box 408-40200, Kisii · Official Hostel Portal</span>
        </div>
      </footer>
    </div>
  )
}

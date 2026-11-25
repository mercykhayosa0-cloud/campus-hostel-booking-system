'use client'

import { Sparkles } from 'lucide-react'
import { DEMO_FILL_EVENT } from '@/components/auth/sign-in-form'
import { Badge } from '@/components/ui/badge'

const DEMO_PASSWORD = 'Hostel@2026'

const accounts = [
  { label: 'Accommodation Officer', email: 'officer@demo.hostel', role: 'Officer' },
  { label: 'Caretaker (Kilimanjaro, Savannah)', email: 'caretaker.north@demo.hostel', role: 'Caretaker' },
  { label: 'Amina Hassan · Eligible', email: 'amina@demo.hostel', role: 'Student' },
  { label: 'Esther Njeri · Fees pending', email: 'esther@demo.hostel', role: 'Student' },
]

export function DemoAccounts() {
  return (
    <section
      aria-labelledby="demo-accounts-heading"
      className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-background/80 p-4"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          <h2 id="demo-accounts-heading" className="text-sm font-medium">
            Demo accounts
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {'Click any account to auto-fill. Password: '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{DEMO_PASSWORD}</code>
        </p>
      </div>
      <ul className="flex flex-col gap-1">
        {accounts.map((account) => (
          <li key={account.email}>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(DEMO_FILL_EVENT, {
                    detail: { email: account.email, password: DEMO_PASSWORD },
                  }),
                )
              }
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="flex flex-col">
                <span className="font-medium">{account.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{account.email}</span>
              </span>
              <Badge variant="secondary" className="shrink-0">
                {account.role}
              </Badge>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { CheckCircle2, MapPin, ShieldCheck } from 'lucide-react'
import { SignInForm } from '@/components/auth/sign-in-form'
import { DemoAccounts } from '@/components/auth/demo-accounts'
import { KisiiCrest } from '@/components/kisii-crest'
import { dashboardPathFor, getCurrentUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Sign in' }

const highlights = [
  'Fair merit & home-distance room allocation',
  'Real-time offer confirmation & digital check-in',
  'Transparent hall occupancy & room inspections',
]

export default async function SignInPage() {
  const user = await getCurrentUser()
  if (user) redirect(dashboardPathFor[user.role])

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      {/* Left Hero Panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-white lg:flex">
        <Image
          src="/images/kisii-campus-hero.jpg"
          alt="Kisii University student residence halls"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-primary/70 to-black/50" />

        <div className="relative z-10 flex items-center gap-3">
          <KisiiCrest className="size-10" />
          <div className="flex flex-col">
            <span className="text-base font-semibold tracking-tight">Kisii University</span>
            <span className="text-xs text-white/80">Directorate of Student Accommodation</span>
          </div>
        </div>

        <div className="relative z-10 flex max-w-lg flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <MapPin className="size-3.5 text-gold" aria-hidden="true" />
            <span>Main Campus · Kisii Highlands, Kenya</span>
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
              Modern Student Housing &amp; Hostel Allocation
            </h1>
            <p className="text-sm leading-relaxed text-white/85 text-pretty">
              Apply for on-campus residence halls, track your allocation status, confirm room offers, and manage
              check-ins seamlessly from one unified portal.
            </p>
          </div>
          <ul className="flex flex-col gap-2.5 text-sm text-white/90">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-gold" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-white/75">
          <ShieldCheck className="size-4 text-gold" aria-hidden="true" />
          <span>Secured institutional access · P.O. Box 408-40200, Kisii</span>
        </div>
      </section>

      {/* Right Sign-In Panel */}
      <section className="flex flex-col items-center justify-center bg-muted/30 px-4 py-10 sm:px-8">
        <div className="flex w-full max-w-md flex-col gap-6">
          {/* Mobile campus banner */}
          <div className="relative overflow-hidden rounded-xl border lg:hidden">
            <div className="relative h-36 w-full">
              <Image
                src="/images/kisii-campus-hero.jpg"
                alt="Kisii University campus hostels"
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4 text-white">
                <KisiiCrest className="size-9" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Kisii University</span>
                  <span className="text-xs text-white/80">Hostel &amp; Accommodation Portal</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden flex-col gap-1 lg:flex">
            <div className="flex items-center gap-2.5">
              <KisiiCrest className="size-9" />
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Kisii University Hostels</h2>
                <p className="text-xs text-muted-foreground">Accommodation &amp; Residence Management</p>
              </div>
            </div>
          </div>

          <SignInForm />

          {process.env.NODE_ENV !== 'production' || process.env.SHOW_DEMO_ACCOUNTS === 'true' ? (
            <DemoAccounts />
          ) : null}
        </div>
      </section>
    </main>
  )
}

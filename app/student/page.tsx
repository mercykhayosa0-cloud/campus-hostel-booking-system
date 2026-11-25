import type { Metadata } from 'next'
import Image from 'next/image'
import {
  BedDouble,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Compass,
  GraduationCap,
  History,
  IdCard,
  Wifi,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { eligibilityPolicy } from '@/lib/domain/eligibility-policy'
import { getHallVisual } from '@/lib/hall-visuals'
import { findCurrentSemester, listHallOccupancy } from '@/lib/repositories/inventory-repository'
import {
  findActiveApplication,
  findLiveAllocation,
  findStudentProfile,
} from '@/lib/repositories/student-repository'
import { requireRole } from '@/lib/session'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Student dashboard' }

const allocationStatusLabel = {
  offered: 'Offer awaiting your confirmation',
  confirmed: 'Confirmed, ready for check-in',
  checked_in: 'Checked in',
} as const

const policyLabel = {
  male_only: 'Male only',
  female_only: 'Female only',
  mixed: 'Mixed',
} as const

export default async function StudentDashboardPage() {
  const user = await requireRole('student')
  const [profile, semester, halls] = await Promise.all([
    findStudentProfile(user.id),
    findCurrentSemester(),
    listHallOccupancy(),
  ])

  if (!profile) {
    return (
      <AppShell user={user} title="Student dashboard">
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>No student record found</AlertTitle>
          <AlertDescription>Contact the Kisii University Accommodation Office to link your registry record.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  const eligibility = eligibilityPolicy.evaluate(profile)
  const [application, allocation] = semester
    ? await Promise.all([findActiveApplication(user.id, semester.id), findLiveAllocation(user.id, semester.id)])
    : [null, null]

  const steps = [
    { label: 'Eligibility Check', done: eligibility.isEligible, active: !eligibility.isEligible },
    { label: 'Application', done: Boolean(application), active: eligibility.isEligible && !application },
    { label: 'Room Offer', done: Boolean(allocation), active: Boolean(application) && !allocation },
    {
      label: 'Check-in',
      done: allocation?.status === 'checked_in',
      active: Boolean(allocation) && allocation?.status !== 'checked_in',
    },
  ]

  return (
    <AppShell
      user={user}
      title={`Welcome, ${user.name.split(' ')[0]}`}
      description={
        semester
          ? `${semester.name} · Kisii University Student Accommodation Portal`
          : 'No semester is currently open.'
      }
    >
      {/* Campus Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border bg-primary text-white shadow-sm">
        <Image
          src="/images/kisii-campus-hero.jpg"
          alt="Kisii University residence halls"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-primary/75 to-black/45" />
        <div className="relative z-10 flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/25 bg-white/15 text-white backdrop-blur-sm">
                <IdCard className="mr-1 size-3.5 text-gold" aria-hidden="true" />
                {profile.studentNumber}
              </Badge>
              <Badge className="border-white/25 bg-white/15 text-white backdrop-blur-sm">
                Year {profile.yearOfStudy}
              </Badge>
              {semester ? (
                <Badge className="border-gold/40 bg-gold/20 text-white backdrop-blur-sm">
                  <CalendarDays className="mr-1 size-3.5 text-gold" aria-hidden="true" />
                  {semester.applicationsOpen ? 'Applications Open' : 'Applications Closed'}
                </Badge>
              ) : null}
            </div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Your Kisii University Housing Overview
            </h2>
            <p className="max-w-xl text-sm text-white/85">
              Track your eligibility, active hostel application, and assigned residence hall for the current academic
              semester.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-white/20 bg-black/35 px-4 py-3 backdrop-blur-md">
            <p className="text-xs text-white/75">Eligibility status</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
              {eligibility.isEligible ? (
                <>
                  <CircleCheck className="size-4 text-gold" aria-hidden="true" />
                  <span>Cleared for allocation</span>
                </>
              ) : (
                <>
                  <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
                  <span>Action required</span>
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Allocation Journey Stepper */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Accommodation Journey</CardTitle>
          <CardDescription>Follow your progress from eligibility verification to hall check-in.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-4">
            {steps.map((step, idx) => (
              <li
                key={step.label}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors',
                  step.done && 'border-primary/30 bg-primary/5',
                  step.active && 'border-gold/60 bg-gold/10',
                  !step.done && !step.active && 'bg-muted/30 text-muted-foreground',
                )}
              >
                <div
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    step.done && 'bg-primary text-primary-foreground',
                    step.active && 'bg-gold text-gold-foreground',
                    !step.done && !step.active && 'bg-muted text-muted-foreground',
                  )}
                >
                  {step.done ? <CheckCircle2 className="size-4" aria-hidden="true" /> : idx + 1}
                </div>
                <span className="font-medium">{step.label}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {eligibility.isEligible ? (
        <Alert className="border-primary/25 bg-primary/5">
          <CircleCheck aria-hidden="true" className="text-success" />
          <AlertTitle>You are eligible for hostel allocation</AlertTitle>
          <AlertDescription>Enrolled, fees cleared, and no disciplinary hold on your university record.</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>You are not currently eligible</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {eligibility.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Application & Allocation */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="size-4 text-primary" aria-hidden="true" />
                <span>Application</span>
              </CardTitle>
              <Badge variant={application ? 'default' : 'secondary'}>
                {application ? 'Submitted' : 'Not submitted'}
              </Badge>
            </div>
            <CardDescription>One active application per semester.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {application ? (
              <p>Submitted on {application.submittedAt.toLocaleDateString('en-GB')}.</p>
            ) : (
              <p className="text-muted-foreground">
                {semester?.applicationsOpen
                  ? 'You have not applied yet. The application form arrives in the next stage.'
                  : 'Applications are currently closed.'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BedDouble className="size-4 text-primary" aria-hidden="true" />
                <span>Allocation</span>
              </CardTitle>
              <Badge variant={allocation ? 'default' : 'secondary'}>
                {allocation ? 'Assigned' : 'Pending'}
              </Badge>
            </div>
            <CardDescription>Your room assignment for this semester.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {allocation ? (
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold">
                  {allocation.hallName}, Room {allocation.roomNumber}
                </p>
                <p className="text-muted-foreground">
                  {allocationStatusLabel[allocation.status as keyof typeof allocationStatusLabel]}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">No room allocated yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Registry Record */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">University Registry Record</CardTitle>
          <CardDescription>
            Used for eligibility and priority ranking. Contact the Accommodation Office to correct any errors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/25 p-3.5">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <IdCard className="size-3.5 text-primary" aria-hidden="true" />
                <span>Student number</span>
              </dt>
              <dd className="font-mono text-sm font-semibold">{profile.studentNumber}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/25 p-3.5">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GraduationCap className="size-3.5 text-primary" aria-hidden="true" />
                <span>Year of study</span>
              </dt>
              <dd className="text-sm font-semibold">Year {profile.yearOfStudy}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/25 p-3.5">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Compass className="size-3.5 text-primary" aria-hidden="true" />
                <span>Distance from home</span>
              </dt>
              <dd className="text-sm font-semibold tabular-nums">{profile.homeDistanceKm} km</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/25 p-3.5">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <History className="size-3.5 text-primary" aria-hidden="true" />
                <span>Housed last semester</span>
              </dt>
              <dd className="text-sm font-semibold">{profile.housedPreviousSemester ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Kisii University Residence Halls Gallery */}
      {halls.length > 0 ? (
        <section aria-labelledby="halls-gallery-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="halls-gallery-heading" className="text-lg font-semibold tracking-tight">
              Kisii University Residence Halls
            </h2>
            <p className="text-sm text-muted-foreground">
              Explore on-campus halls and live bed availability for the current semester.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {halls.map((hall) => {
              const visual = getHallVisual(hall.code)
              return (
                <Card key={hall.id} className="group overflow-hidden pt-0 transition-shadow hover:shadow-md">
                  <div className="relative h-44 w-full overflow-hidden">
                    <Image
                      src={visual.image}
                      alt={hall.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute top-3 right-3">
                      <Badge className="border-white/25 bg-black/50 text-white backdrop-blur-sm">
                        {policyLabel[hall.genderPolicy]}
                      </Badge>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <p className="text-xs font-medium text-gold">{visual.wing}</p>
                      <h3 className="text-base font-semibold">{hall.name}</h3>
                    </div>
                  </div>
                  <CardContent className="flex flex-col gap-3 pt-4">
                    <p className="text-xs leading-relaxed text-muted-foreground">{visual.tagline}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {visual.amenities.map((amenity) => (
                        <Badge key={amenity} variant="secondary" className="text-[11px] font-normal">
                          <Wifi className="mr-1 size-3 text-primary" aria-hidden="true" />
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t pt-3 text-xs">
                      <span className="text-muted-foreground">
                        {hall.roomCount} rooms · {hall.totalBeds} beds
                      </span>
                      <span className="font-semibold text-primary tabular-nums">
                        {hall.availableBeds} beds available
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      ) : null}
    </AppShell>
  )
}

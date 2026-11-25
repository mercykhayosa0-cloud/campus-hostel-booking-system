import type { Metadata } from 'next'
import Image from 'next/image'
import { ArrowLeftRight, BedDouble, ClipboardCheck, ShieldAlert } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { HallOccupancyTable } from '@/components/hall-occupancy-table'
import { StatCard } from '@/components/stat-card'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getHallVisual } from '@/lib/hall-visuals'
import {
  findCurrentSemester,
  getOfficerWorkQueue,
  listHallOccupancy,
} from '@/lib/repositories/inventory-repository'
import { requireRole } from '@/lib/session'

export const metadata: Metadata = { title: 'Officer dashboard' }

export default async function OfficerDashboardPage() {
  const user = await requireRole('officer')
  const semester = await findCurrentSemester()
  const [halls, queue] = await Promise.all([listHallOccupancy(), getOfficerWorkQueue(semester?.id ?? null)])
  const totals = halls.reduce(
    (sum, hall) => ({
      beds: sum.beds + hall.totalBeds,
      available: sum.available + hall.availableBeds,
      occupied: sum.occupied + hall.occupiedBeds,
    }),
    { beds: 0, available: 0, occupied: 0 },
  )

  return (
    <AppShell
      user={user}
      title="Accommodation Office"
      description={
        semester
          ? `${semester.name} · Applications are ${semester.applicationsOpen ? 'open' : 'closed'}; offers must be confirmed within ${semester.offerConfirmationHours} hours.`
          : 'No current semester has been configured.'
      }
    >
      <section aria-label="Work queue" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Available beds"
          value={totals.available}
          hint={`of ${totals.beds} total beds (${totals.occupied} occupied)`}
          icon={BedDouble}
          tone="primary"
        />
        <StatCard
          label="Active applications"
          value={queue.activeApplications}
          hint="Waiting for an allocation run"
          icon={ClipboardCheck}
          tone="primary"
        />
        <StatCard
          label="Pending transfers"
          value={queue.pendingTransfers}
          hint="Need a decision with a reason"
          icon={ArrowLeftRight}
          tone={queue.pendingTransfers > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Damage reviews"
          value={queue.pendingDamageReviews}
          hint="Findings awaiting a charge decision"
          icon={ShieldAlert}
          tone={queue.pendingDamageReviews > 0 ? 'warning' : 'default'}
        />
      </section>

      {halls.length > 0 ? (
        <section aria-label="Residence halls summary" className="grid gap-4 md:grid-cols-3">
          {halls.map((hall) => {
            const visual = getHallVisual(hall.code)
            const usedBeds = hall.occupiedBeds + hall.reservedBeds
            const pct = hall.totalBeds > 0 ? Math.min(100, Math.round((usedBeds / hall.totalBeds) * 100)) : 0
            return (
              <Card key={hall.id} className="overflow-hidden pt-0 transition-shadow hover:shadow-md">
                <div className="relative h-32 w-full">
                  <Image src={visual.image} alt={hall.name} fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3.5 text-white">
                    <div>
                      <p className="text-[11px] font-medium text-gold">{visual.wing}</p>
                      <h3 className="text-sm font-semibold">{hall.name}</h3>
                    </div>
                    <Badge className="border-white/25 bg-black/50 text-white backdrop-blur-sm tabular-nums">
                      {pct}% full
                    </Badge>
                  </div>
                </div>
                <CardContent className="flex items-center justify-between pt-3 text-xs">
                  <span className="text-muted-foreground">
                    {hall.availableBeds} of {hall.totalBeds} beds open
                  </span>
                  {hall.roomsOutOfService > 0 ? (
                    <Badge variant="destructive" className="text-[11px]">
                      {hall.roomsOutOfService} out of service
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[11px]">
                      All rooms active
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Hall occupancy</CardTitle>
          <CardDescription>
            Available beds exclude rooms that are out of service and beds held by open offers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HallOccupancyTable halls={halls} />
        </CardContent>
      </Card>
    </AppShell>
  )
}

import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getHallVisual } from '@/lib/hall-visuals'

const policyLabel = { male_only: 'Male only', female_only: 'Female only', mixed: 'Mixed' } as const

export type HallOccupancyRow = {
  id: number
  name: string
  code: string
  genderPolicy: keyof typeof policyLabel
  roomCount: number
  totalBeds: number
  occupiedBeds: number
  reservedBeds: number
  availableBeds: number
  roomsOutOfService: number
}

export function HallOccupancyTable({ halls }: { halls: HallOccupancyRow[] }) {
  if (halls.length === 0) {
    return <p className="text-sm text-muted-foreground">No halls have been set up yet.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Hall</TableHead>
          <TableHead>Policy</TableHead>
          <TableHead className="text-right">Rooms</TableHead>
          <TableHead className="text-right">Beds</TableHead>
          <TableHead className="text-right">Occupied</TableHead>
          <TableHead className="text-right">Reserved</TableHead>
          <TableHead className="text-right">Available</TableHead>
          <TableHead className="hidden w-36 md:table-cell">Utilization</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {halls.map((hall) => {
          const visual = getHallVisual(hall.code)
          const usedBeds = hall.occupiedBeds + hall.reservedBeds
          const pct = hall.totalBeds > 0 ? Math.min(100, Math.round((usedBeds / hall.totalBeds) * 100)) : 0
          return (
            <TableRow key={hall.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="relative hidden size-10 shrink-0 overflow-hidden rounded-md border sm:block">
                    <Image src={visual.image} alt={hall.name} fill className="object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{hall.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {hall.code}
                      </span>
                    </div>
                    {hall.roomsOutOfService > 0 ? (
                      <span className="text-xs text-destructive">
                        {hall.roomsOutOfService} {hall.roomsOutOfService === 1 ? 'room' : 'rooms'} out of service
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{visual.wing}</span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{policyLabel[hall.genderPolicy]}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{hall.roomCount}</TableCell>
              <TableCell className="text-right tabular-nums">{hall.totalBeds}</TableCell>
              <TableCell className="text-right tabular-nums">{hall.occupiedBeds}</TableCell>
              <TableCell className="text-right tabular-nums">{hall.reservedBeds}</TableCell>
              <TableCell className="text-right font-semibold text-primary tabular-nums">{hall.availableBeds}</TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{pct}%</span>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

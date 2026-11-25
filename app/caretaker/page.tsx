import type { Metadata } from 'next'
import { BedDouble, Building2, DoorOpen, Wrench } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { HallOccupancyTable } from '@/components/hall-occupancy-table'
import { StatCard } from '@/components/stat-card'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listHallOccupancy, listRoomsForCaretaker } from '@/lib/repositories/inventory-repository'
import { requireRole } from '@/lib/session'

export const metadata: Metadata = { title: 'Caretaker dashboard' }

const roomTypeLabel = { single: 'Single', double: 'Double', shared: 'Shared' } as const

export default async function CaretakerDashboardPage() {
  const user = await requireRole('caretaker')
  const [halls, rooms] = await Promise.all([listHallOccupancy(user.id), listRoomsForCaretaker(user.id)])

  const totalBeds = rooms.reduce((sum, r) => sum + r.capacity, 0)
  const occupiedBeds = rooms.reduce((sum, r) => sum + r.occupiedBeds, 0)
  const closedRooms = rooms.filter((r) => !r.isInService).length

  return (
    <AppShell
      user={user}
      title="Caretaker overview"
      description="Rooms in the Kisii University halls assigned to you. Inspections and repair clearance arrive in a later stage."
    >
      <section aria-label="Caretaker summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assigned halls" value={halls.length} hint="Under your supervision" icon={Building2} tone="primary" />
        <StatCard label="Total rooms" value={rooms.length} hint="Across assigned halls" icon={DoorOpen} tone="primary" />
        <StatCard
          label="Occupied beds"
          value={`${occupiedBeds}/${totalBeds}`}
          hint="Current student occupancy"
          icon={BedDouble}
        />
        <StatCard
          label="Out of service"
          value={closedRooms}
          hint={closedRooms === 0 ? 'All rooms operational' : 'Rooms closed for maintenance'}
          icon={Wrench}
          tone={closedRooms > 0 ? 'warning' : 'default'}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Your halls</CardTitle>
          <CardDescription>Live capacity and bed utilization across your assigned residence halls.</CardDescription>
        </CardHeader>
        <CardContent>
          <HallOccupancyTable halls={halls} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rooms</CardTitle>
          <CardDescription>{rooms.length} rooms across your halls.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Hall</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Occupied</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-mono text-sm font-medium">{room.roomNumber}</TableCell>
                  <TableCell>{room.hallName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{roomTypeLabel[room.roomType]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {room.occupiedBeds}/{room.capacity}
                  </TableCell>
                  <TableCell>
                    {room.isInService ? (
                      <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-primary">
                        In service
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Closed</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  )
}

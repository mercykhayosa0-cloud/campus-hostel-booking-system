/**
 * Resets the database to a known demo state.
 * Run with: pnpm db:seed
 *
 * WARNING: this deletes every row in the hostel tables and every demo account
 * (emails ending in @demo.hostel). Never run it against real data.
 */
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { hashPassword } from '../lib/password'

const DEMO_PASSWORD = 'Hostel@2026'

type DemoUser = {
  key: string
  name: string
  email: string
  role: 'student' | 'officer' | 'caretaker'
}

const staff: DemoUser[] = [
  { key: 'officer', name: 'Grace Wanjiru', email: 'officer@demo.hostel', role: 'officer' },
  { key: 'caretakerA', name: 'Peter Otieno', email: 'caretaker.north@demo.hostel', role: 'caretaker' },
  { key: 'caretakerB', name: 'Mary Achieng', email: 'caretaker.south@demo.hostel', role: 'caretaker' },
]

const students = [
  // eligible, far from home, first year
  { name: 'Amina Hassan', email: 'amina@demo.hostel', number: 'S2026001', gender: 'female', year: 1, km: 480, fees: true, hold: false, enrolled: true, prev: false },
  { name: 'Brian Kiprop', email: 'brian@demo.hostel', number: 'S2026002', gender: 'male', year: 1, km: 320, fees: true, hold: false, enrolled: true, prev: false },
  { name: 'Cynthia Mwangi', email: 'cynthia@demo.hostel', number: 'S2025014', gender: 'female', year: 2, km: 95, fees: true, hold: false, enrolled: true, prev: true },
  { name: 'David Ouma', email: 'david@demo.hostel', number: 'S2024031', gender: 'male', year: 3, km: 610, fees: true, hold: false, enrolled: true, prev: true },
  // ineligible examples for the demo
  { name: 'Esther Njeri', email: 'esther@demo.hostel', number: 'S2025022', gender: 'female', year: 2, km: 250, fees: false, hold: false, enrolled: true, prev: false },
  { name: 'Felix Mutua', email: 'felix@demo.hostel', number: 'S2023008', gender: 'male', year: 4, km: 40, fees: true, hold: true, enrolled: true, prev: true },
] as const

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  const passwordHash = await hashPassword(DEMO_PASSWORD)

  try {
    await client.query('BEGIN')
    await client.query(`TRUNCATE student_profiles, halls, rooms, semesters, applications,
      allocation_runs, allocation_run_entries, allocations, transfer_requests, inspections,
      room_service_events, damage_findings, damage_charges, status_changes RESTART IDENTITY`)
    await client.query(`DELETE FROM "user" WHERE email LIKE '%@demo.hostel'`)

    const ids: Record<string, string> = {}
    const insertUser = async (u: { name: string; email: string; role: string }) => {
      const id = randomUUID()
      await client.query(
        `INSERT INTO "user" (id, name, email, "emailVerified", role) VALUES ($1, $2, $3, true, $4)`,
        [id, u.name, u.email, u.role],
      )
      await client.query(
        `INSERT INTO account (id, "accountId", "providerId", "userId", password) VALUES ($1, $2, 'credential', $2, $3)`,
        [randomUUID(), id, passwordHash],
      )
      return id
    }

    for (const s of staff) ids[s.key] = await insertUser(s)

    for (const s of students) {
      const id = await insertUser({ name: s.name, email: s.email, role: 'student' })
      await client.query(
        `INSERT INTO student_profiles (user_id, student_number, gender, year_of_study, home_distance_km,
          is_enrolled, is_fee_cleared, has_disciplinary_hold, housed_previous_semester)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, s.number, s.gender, s.year, s.km, s.enrolled, s.fees, s.hold, s.prev],
      )
    }

    await client.query(
      `INSERT INTO semesters (name, starts_on, ends_on, offer_confirmation_hours, applications_open, is_current)
       VALUES ('2026/27 Semester 1', '2026-09-07', '2026-12-18', 72, true, true)`,
    )

    const hallRows = [
      { name: 'Kilimanjaro Hall', code: 'KIL', policy: 'male_only', caretaker: ids.caretakerA },
      { name: 'Victoria Hall', code: 'VIC', policy: 'female_only', caretaker: ids.caretakerB },
      { name: 'Savannah Hall', code: 'SAV', policy: 'mixed', caretaker: ids.caretakerA },
    ]
    const capacityFor = { single: 1, double: 2, shared: 4 } as const
    const layout: Array<keyof typeof capacityFor> = ['single', 'single', 'double', 'double', 'shared']

    for (const hall of hallRows) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO halls (name, code, gender_policy, caretaker_user_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [hall.name, hall.code, hall.policy, hall.caretaker],
      )
      const hallId = rows[0].id
      const fixedGender = hall.policy === 'male_only' ? 'male' : hall.policy === 'female_only' ? 'female' : null
      for (const [index, type] of layout.entries()) {
        await client.query(
          `INSERT INTO rooms (hall_id, room_number, room_type, capacity, occupant_gender, is_in_service)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          // One shared room in Savannah starts closed so repair flows can be demoed.
          [hallId, `${hall.code}-${101 + index}`, type, capacityFor[type], fixedGender, !(hall.code === 'SAV' && type === 'shared')],
        )
      }
    }

    await client.query('COMMIT')
    console.log(`Seeded ${staff.length + students.length} demo accounts. Password for all: ${DEMO_PASSWORD}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

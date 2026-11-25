# Hostel Allocation System

A university hostel allocation system: student applications, fair room allocation, offers and confirmation, check-in/out, transfers, inspections, damage charges and occupancy reports.

## Stack

- **Next.js 16 (App Router) + TypeScript**: UI and server in one project
- **Neon PostgreSQL**: relational database with transactions (prevents double-booking a bed)
- **Drizzle ORM**: type-safe queries
- **Better Auth**: email + password login, hashed passwords, server-side sessions

## Architecture (layers)

| Layer | Folder | Responsibility |
| --- | --- | --- |
| Domain | `lib/domain/` | Business rules as plain classes (e.g. `EligibilityPolicy`). No database code. |
| Repositories | `lib/repositories/` | The only code that reads and writes the database. |
| Services | `lib/services/` (later stages) | Coordinate use cases and transactions (allocation, transfers). |
| UI | `app/`, `components/` | Pages and components. Every protected page checks the role on the server (`requireRole`). |

## Roles

| Role | Dashboard |
| --- | --- |
| Student | `/student` |
| Accommodation Officer | `/officer` |
| Hall Caretaker | `/caretaker` (sees only assigned halls) |

## Running locally

1. `pnpm install`
2. Create `.env.development.local` with `DATABASE_URL` and `BETTER_AUTH_SECRET` (`openssl rand -base64 32`).
3. Apply `db/migrations/0001_initial_schema.sql` to the database.
4. `pnpm db:seed` loads demo halls, rooms, a semester and users.
5. `pnpm dev`, then open http://localhost:3000.

### Demo accounts (password `Hostel@2026`)

- `officer@demo.hostel`: Accommodation Officer
- `caretaker.north@demo.hostel`: Caretaker
- `amina@demo.hostel`: eligible student
- `esther@demo.hostel`: student with fees not cleared

## Assumptions (to confirm with the lecturer)

- Mixed halls still have single-gender rooms (`rooms.occupant_gender`).
- Distance from home is in kilometres, held on the registry record.
- Eligibility data (enrolment, fees, disciplinary hold) is maintained by the office.
- Only the Accommodation Officer approves damage charges.
- Offer confirmation window defaults to 72 hours and is set per semester.

## Progress

- [x] Stage 2: foundation (schema, seed, login, role dashboards)
- [ ] Semester setup and inventory management
- [ ] Applications and eligibility
- [ ] Allocation ranking, offers, confirmation and lapse
- [ ] Check-in, check-out, early vacation
- [ ] Transfers
- [ ] Inspections, room closure, damage
- [ ] Reports

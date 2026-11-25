-- Campus Hostel Booking System: initial schema
-- Applied to Neon through the Neon MCP (one statement at a time).
-- This file is the written record of the schema so it can be reviewed and
-- re-applied to a fresh database. lib/db/schema.ts mirrors it for Drizzle.

-- ---------------------------------------------------------------------------
-- 1. Authentication tables (shape required by Better Auth, camelCase columns)
-- ---------------------------------------------------------------------------

CREATE TABLE "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "role" text NOT NULL DEFAULT 'student'
    CHECK ("role" IN ('student', 'officer', 'caretaker')),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Students (eligibility values are consumed, not processed, by this system)
-- ---------------------------------------------------------------------------

CREATE TABLE student_profiles (
  user_id text PRIMARY KEY,
  student_number text NOT NULL UNIQUE,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  year_of_study integer NOT NULL CHECK (year_of_study BETWEEN 1 AND 6),
  home_distance_km numeric(7, 1) NOT NULL CHECK (home_distance_km >= 0),
  is_enrolled boolean NOT NULL DEFAULT true,
  is_fee_cleared boolean NOT NULL DEFAULT false,
  has_disciplinary_hold boolean NOT NULL DEFAULT false,
  housed_previous_semester boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Inventory: halls and rooms
-- ---------------------------------------------------------------------------

CREATE TABLE halls (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  gender_policy text NOT NULL
    CHECK (gender_policy IN ('male_only', 'female_only', 'mixed')),
  caretaker_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- occupied_beds and reserved_beds are tracked separately (rule 2).
-- The CHECK constraints make the database itself refuse any change that
-- would overfill a room, even if two requests arrive at the same moment.
CREATE TABLE rooms (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hall_id integer NOT NULL,
  room_number text NOT NULL,
  room_type text NOT NULL CHECK (room_type IN ('single', 'double', 'shared')),
  capacity integer NOT NULL,
  occupant_gender text CHECK (occupant_gender IN ('male', 'female')),
  is_in_service boolean NOT NULL DEFAULT true,
  occupied_beds integer NOT NULL DEFAULT 0 CHECK (occupied_beds >= 0),
  reserved_beds integer NOT NULL DEFAULT 0 CHECK (reserved_beds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hall_id, room_number),
  CHECK (
    (room_type = 'single' AND capacity = 1) OR
    (room_type = 'double' AND capacity = 2) OR
    (room_type = 'shared' AND capacity = 4)
  ),
  CHECK (occupied_beds + reserved_beds <= capacity)
);

-- ---------------------------------------------------------------------------
-- 4. Semesters
-- ---------------------------------------------------------------------------

CREATE TABLE semesters (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  offer_confirmation_hours integer NOT NULL DEFAULT 72
    CHECK (offer_confirmation_hours BETWEEN 1 AND 720),
  applications_open boolean NOT NULL DEFAULT false,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on > starts_on)
);

CREATE UNIQUE INDEX semesters_one_current ON semesters (is_current) WHERE is_current;

-- ---------------------------------------------------------------------------
-- 5. Applications
-- ---------------------------------------------------------------------------

CREATE TABLE applications (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  semester_id integer NOT NULL,
  student_user_id text NOT NULL,
  preferred_hall_id integer,
  preferred_room_type text CHECK (preferred_room_type IN ('single', 'double', 'shared')),
  preferred_roommate_student_number text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);

-- Rule 3: at most one active application per student per semester.
CREATE UNIQUE INDEX applications_one_active_per_semester
  ON applications (semester_id, student_user_id) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 6. Allocation runs (audit trail of every ranking, rule 14)
-- ---------------------------------------------------------------------------

CREATE TABLE allocation_runs (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  semester_id integer NOT NULL,
  run_by_user_id text NOT NULL,
  policy_version text NOT NULL,
  applicants_considered integer NOT NULL DEFAULT 0,
  offers_made integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE allocation_run_entries (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  allocation_run_id integer NOT NULL,
  application_id integer NOT NULL,
  rank integer,
  is_eligible boolean NOT NULL,
  ineligibility_reasons text[] NOT NULL DEFAULT '{}',
  ranking_factors jsonb NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('offered', 'no_room', 'ineligible', 'already_allocated')),
  outcome_detail text,
  roommate_preference_met boolean,
  UNIQUE (allocation_run_id, application_id)
);

-- ---------------------------------------------------------------------------
-- 7. Allocations (one bed for one student in one semester)
-- ---------------------------------------------------------------------------

CREATE TABLE allocations (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  semester_id integer NOT NULL,
  application_id integer NOT NULL,
  student_user_id text NOT NULL,
  room_id integer NOT NULL,
  allocation_run_id integer,
  status text NOT NULL DEFAULT 'offered' CHECK (status IN (
    'offered', 'confirmed', 'checked_in', 'checked_out',
    'lapsed', 'cancelled', 'ended', 'transferred'
  )),
  offer_expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  closed_at timestamptz,
  transferred_from_allocation_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A student can hold only one live allocation per semester.
CREATE UNIQUE INDEX allocations_one_live_per_student
  ON allocations (semester_id, student_user_id)
  WHERE status IN ('offered', 'confirmed', 'checked_in');

-- ---------------------------------------------------------------------------
-- 8. Transfer requests
-- ---------------------------------------------------------------------------

CREATE TABLE transfer_requests (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  allocation_id integer NOT NULL,
  student_user_id text NOT NULL,
  reason text NOT NULL,
  preferred_hall_id integer,
  preferred_room_type text CHECK (preferred_room_type IN ('single', 'double', 'shared')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  decided_by_user_id text,
  decision_reason text,
  decided_at timestamptz,
  new_allocation_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX transfer_requests_one_pending
  ON transfer_requests (allocation_id) WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 9. Room condition: inspections, service events, damage
-- ---------------------------------------------------------------------------

CREATE TABLE inspections (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id integer NOT NULL,
  caretaker_user_id text NOT NULL,
  condition text NOT NULL CHECK (condition IN ('good', 'fair', 'needs_repair', 'unsafe')),
  notes text,
  inspected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE room_service_events (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id integer NOT NULL,
  action text NOT NULL CHECK (action IN ('closed', 'repair_cleared')),
  inspection_id integer,
  recorded_by_user_id text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE damage_findings (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id integer NOT NULL,
  allocation_id integer,
  inspection_id integer,
  recorded_by_user_id text NOT NULL,
  description text NOT NULL,
  evidence_notes text,
  estimated_cost numeric(10, 2) CHECK (estimated_cost >= 0),
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'charge_approved', 'charge_declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE damage_charges (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  damage_finding_id integer NOT NULL UNIQUE,
  decision text NOT NULL CHECK (decision IN ('approved', 'declined')),
  amount numeric(10, 2) CHECK (amount >= 0),
  decided_by_user_id text NOT NULL,
  decision_reason text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (decision = 'declined' OR amount IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- 10. Status history (explains every decision later)
-- ---------------------------------------------------------------------------

CREATE TABLE status_changes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN (
    'application', 'allocation', 'transfer_request', 'room', 'damage_finding'
  )),
  entity_id integer NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor_user_id text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX status_changes_entity ON status_changes (entity_type, entity_id, created_at);

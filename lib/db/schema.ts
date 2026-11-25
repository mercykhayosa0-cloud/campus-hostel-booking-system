// Mirrors db/migrations/0001_initial_schema.sql. The SQL file is the source of
// truth for constraints (CHECKs, partial unique indexes); this file gives the
// application typed access to the same columns.
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// ---------- Better Auth tables (camelCase columns are Better Auth defaults) ----------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: text('role', { enum: ['student', 'officer', 'caretaker'] })
    .notNull()
    .default('student'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

// ---------- Hostel domain tables ----------

export const studentProfiles = pgTable('student_profiles', {
  userId: text('user_id').primaryKey(),
  studentNumber: text('student_number').notNull().unique(),
  gender: text('gender', { enum: ['male', 'female'] }).notNull(),
  yearOfStudy: integer('year_of_study').notNull(),
  homeDistanceKm: numeric('home_distance_km', { precision: 7, scale: 1, mode: 'number' }).notNull(),
  isEnrolled: boolean('is_enrolled').notNull().default(true),
  isFeeCleared: boolean('is_fee_cleared').notNull().default(false),
  hasDisciplinaryHold: boolean('has_disciplinary_hold').notNull().default(false),
  housedPreviousSemester: boolean('housed_previous_semester').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const halls = pgTable('halls', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
  genderPolicy: text('gender_policy', { enum: ['male_only', 'female_only', 'mixed'] }).notNull(),
  caretakerUserId: text('caretaker_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const rooms = pgTable('rooms', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  hallId: integer('hall_id').notNull(),
  roomNumber: text('room_number').notNull(),
  roomType: text('room_type', { enum: ['single', 'double', 'shared'] }).notNull(),
  capacity: integer('capacity').notNull(),
  occupantGender: text('occupant_gender', { enum: ['male', 'female'] }),
  isInService: boolean('is_in_service').notNull().default(true),
  occupiedBeds: integer('occupied_beds').notNull().default(0),
  reservedBeds: integer('reserved_beds').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const semesters = pgTable('semesters', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  offerConfirmationHours: integer('offer_confirmation_hours').notNull().default(72),
  applicationsOpen: boolean('applications_open').notNull().default(false),
  isCurrent: boolean('is_current').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const applications = pgTable('applications', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  semesterId: integer('semester_id').notNull(),
  studentUserId: text('student_user_id').notNull(),
  preferredHallId: integer('preferred_hall_id'),
  preferredRoomType: text('preferred_room_type', { enum: ['single', 'double', 'shared'] }),
  preferredRoommateStudentNumber: text('preferred_roommate_student_number'),
  status: text('status', { enum: ['active', 'withdrawn', 'closed'] }).notNull().default('active'),
  closedReason: text('closed_reason'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
})

export const allocationRuns = pgTable('allocation_runs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  semesterId: integer('semester_id').notNull(),
  runByUserId: text('run_by_user_id').notNull(),
  policyVersion: text('policy_version').notNull(),
  applicantsConsidered: integer('applicants_considered').notNull().default(0),
  offersMade: integer('offers_made').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const allocationRunEntries = pgTable('allocation_run_entries', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  allocationRunId: integer('allocation_run_id').notNull(),
  applicationId: integer('application_id').notNull(),
  rank: integer('rank'),
  isEligible: boolean('is_eligible').notNull(),
  ineligibilityReasons: text('ineligibility_reasons').array().notNull().default([]),
  rankingFactors: jsonb('ranking_factors').notNull(),
  outcome: text('outcome', {
    enum: ['offered', 'no_room', 'ineligible', 'already_allocated'],
  }).notNull(),
  outcomeDetail: text('outcome_detail'),
  roommatePreferenceMet: boolean('roommate_preference_met'),
})

export const allocationStatuses = [
  'offered',
  'confirmed',
  'checked_in',
  'checked_out',
  'lapsed',
  'cancelled',
  'ended',
  'transferred',
] as const

export const allocations = pgTable('allocations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  semesterId: integer('semester_id').notNull(),
  applicationId: integer('application_id').notNull(),
  studentUserId: text('student_user_id').notNull(),
  roomId: integer('room_id').notNull(),
  allocationRunId: integer('allocation_run_id'),
  status: text('status', { enum: allocationStatuses }).notNull().default('offered'),
  offerExpiresAt: timestamp('offer_expires_at', { withTimezone: true }).notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  checkedOutAt: timestamp('checked_out_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  vacatedEarly: boolean('vacated_early').notNull().default(false),
  transferredFromAllocationId: integer('transferred_from_allocation_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const transferRequests = pgTable('transfer_requests', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  allocationId: integer('allocation_id').notNull(),
  studentUserId: text('student_user_id').notNull(),
  reason: text('reason').notNull(),
  preferredHallId: integer('preferred_hall_id'),
  preferredRoomType: text('preferred_room_type', { enum: ['single', 'double', 'shared'] }),
  status: text('status', { enum: ['pending', 'approved', 'declined', 'cancelled'] })
    .notNull()
    .default('pending'),
  decidedByUserId: text('decided_by_user_id'),
  decisionReason: text('decision_reason'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  newAllocationId: integer('new_allocation_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const inspections = pgTable('inspections', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  roomId: integer('room_id').notNull(),
  caretakerUserId: text('caretaker_user_id').notNull(),
  condition: text('condition', { enum: ['good', 'fair', 'needs_repair', 'unsafe'] }).notNull(),
  notes: text('notes'),
  inspectedAt: timestamp('inspected_at', { withTimezone: true }).notNull().defaultNow(),
})

export const roomServiceEvents = pgTable('room_service_events', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  roomId: integer('room_id').notNull(),
  action: text('action', { enum: ['closed', 'repair_cleared'] }).notNull(),
  inspectionId: integer('inspection_id'),
  recordedByUserId: text('recorded_by_user_id').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const damageFindings = pgTable('damage_findings', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  roomId: integer('room_id').notNull(),
  allocationId: integer('allocation_id'),
  inspectionId: integer('inspection_id'),
  recordedByUserId: text('recorded_by_user_id').notNull(),
  description: text('description').notNull(),
  evidenceNotes: text('evidence_notes'),
  estimatedCost: numeric('estimated_cost', { precision: 10, scale: 2, mode: 'number' }),
  status: text('status', { enum: ['pending_review', 'charge_approved', 'charge_declined'] })
    .notNull()
    .default('pending_review'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const damageCharges = pgTable('damage_charges', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  damageFindingId: integer('damage_finding_id').notNull().unique(),
  decision: text('decision', { enum: ['approved', 'declined'] }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2, mode: 'number' }),
  decidedByUserId: text('decided_by_user_id').notNull(),
  decisionReason: text('decision_reason').notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
})

export const statusChanges = pgTable('status_changes', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  entityType: text('entity_type', {
    enum: ['application', 'allocation', 'transfer_request', 'room', 'damage_finding'],
  }).notNull(),
  entityId: integer('entity_id').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  actorUserId: text('actor_user_id'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

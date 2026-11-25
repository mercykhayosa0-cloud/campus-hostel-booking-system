-- 0002: an application is "closed" when its offer lapses or is declined, so the
-- student is not automatically re-offered in the next run (they may re-apply).
-- Allocations record whether a check-out happened before the semester end date.
ALTER TABLE applications DROP CONSTRAINT applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (status IN ('active', 'withdrawn', 'closed'));
ALTER TABLE applications ADD COLUMN closed_reason text;
ALTER TABLE allocations ADD COLUMN vacated_early boolean NOT NULL DEFAULT false;
CREATE INDEX allocations_room_status ON allocations (room_id, status);

-- Deduplicate existing rows before adding constraint
DELETE FROM work_note_person a
USING work_note_person b
WHERE a.ctid < b.ctid
  AND a.work_id = b.work_id
  AND a.person_id = b.person_id;

-- Add UNIQUE constraint required for UPSERT (ON CONFLICT) pattern
-- The initial_schema already has this for fresh databases; this covers existing ones.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_work_note_person_work_person'
  ) THEN
    ALTER TABLE work_note_person
      ADD CONSTRAINT uq_work_note_person_work_person UNIQUE (work_id, person_id);
  END IF;
END $$;

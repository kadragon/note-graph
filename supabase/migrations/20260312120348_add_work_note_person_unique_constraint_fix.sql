-- Deduplicate existing rows before adding constraint
DELETE FROM work_note_person a
USING work_note_person b
WHERE a.ctid < b.ctid
  AND a.work_id = b.work_id
  AND a.person_id = b.person_id;

-- Add unique constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'work_note_person'::regclass
      AND contype = 'u'
      AND conkey @> ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'work_note_person'::regclass AND attname = 'work_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'work_note_person'::regclass AND attname = 'person_id')
      ]
  ) THEN
    ALTER TABLE work_note_person
      ADD CONSTRAINT uq_work_note_person_work_person UNIQUE (work_id, person_id);
  END IF;
END $$;

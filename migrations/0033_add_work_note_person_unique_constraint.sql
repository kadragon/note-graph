-- Add UNIQUE constraint on work_note_person(work_id, person_id)
-- Required for UPSERT (ON CONFLICT) pattern in junction table updates
ALTER TABLE work_note_person
  ADD CONSTRAINT uq_work_note_person_work_person UNIQUE (work_id, person_id);

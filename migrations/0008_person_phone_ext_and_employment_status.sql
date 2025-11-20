-- Migration: 0006_person_phone_ext_and_employment_status
-- Description: Expand phone_ext to 15 chars and add employment_status column
-- Trace: TASK-LLM-IMPORT

-- Step 1: Create new persons table with updated constraints
CREATE TABLE IF NOT EXISTS persons_new (
  person_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_ext TEXT CHECK(phone_ext IS NULL OR (length(phone_ext) <= 15 AND NOT phone_ext GLOB '*[^0-9-]*')),
  current_dept TEXT,
  current_position TEXT,
  current_role_desc TEXT,
  employment_status TEXT DEFAULT '재직' CHECK (employment_status IN ('재직', '휴직', '퇴직')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 2: Copy existing data
INSERT INTO persons_new (person_id, name, phone_ext, current_dept, current_position, current_role_desc, created_at, updated_at)
SELECT person_id, name, phone_ext, current_dept, current_position, current_role_desc, created_at, updated_at
FROM persons;

-- Step 3: Drop old table
DROP TABLE persons;

-- Step 4: Rename new table
ALTER TABLE persons_new RENAME TO persons;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
CREATE INDEX IF NOT EXISTS idx_persons_current_dept ON persons(current_dept);
CREATE INDEX IF NOT EXISTS idx_persons_phone_ext ON persons(phone_ext);
CREATE INDEX IF NOT EXISTS idx_persons_employment_status ON persons(employment_status);

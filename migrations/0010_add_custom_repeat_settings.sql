-- Migration: Add custom repeat settings for todos
-- This adds support for custom repeat intervals and weekend skipping

-- Add custom_interval column (e.g., 2 for "every 2 months")
ALTER TABLE todos ADD COLUMN custom_interval INTEGER;

-- Add custom_unit column (DAY, WEEK, MONTH)
ALTER TABLE todos ADD COLUMN custom_unit TEXT;

-- Add skip_weekends column (default false)
ALTER TABLE todos ADD COLUMN skip_weekends INTEGER DEFAULT 0;

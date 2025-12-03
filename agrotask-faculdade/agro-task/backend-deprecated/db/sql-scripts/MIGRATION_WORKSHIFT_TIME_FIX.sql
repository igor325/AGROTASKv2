-- Migration to fix WorkShift time fields
-- Run this in Supabase SQL Editor

-- Change startTime and endTime from timestamp to text (HH:MM format)
-- This prevents timezone conversion issues

-- Step 1: Add new text columns
ALTER TABLE "WorkShift" 
ADD COLUMN IF NOT EXISTS "startTimeNew" text,
ADD COLUMN IF NOT EXISTS "endTimeNew" text;

-- Step 2: Migrate existing data (extract time portion)
UPDATE "WorkShift"
SET "startTimeNew" = to_char("startTime", 'HH24:MI'),
    "endTimeNew" = to_char("endTime", 'HH24:MI');

-- Step 3: Drop old columns
ALTER TABLE "WorkShift"
DROP COLUMN IF EXISTS "startTime",
DROP COLUMN IF EXISTS "endTime";

-- Step 4: Rename new columns
ALTER TABLE "WorkShift"
RENAME COLUMN "startTimeNew" TO "startTime";

ALTER TABLE "WorkShift"
RENAME COLUMN "endTimeNew" TO "endTime";

-- Step 5: Set NOT NULL constraint
ALTER TABLE "WorkShift"
ALTER COLUMN "startTime" SET NOT NULL,
ALTER COLUMN "endTime" SET NOT NULL;

-- Comments
COMMENT ON COLUMN "WorkShift"."startTime" IS 'Start time in HH:MM format (e.g., 06:00)';
COMMENT ON COLUMN "WorkShift"."endTime" IS 'End time in HH:MM format (e.g., 18:00)';


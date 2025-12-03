-- Migration to update Activity table schema
-- Run this in Supabase SQL Editor

-- Add new columns
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "repeatStartDate" timestamp without time zone,
ADD COLUMN IF NOT EXISTS "scheduledDate" timestamp without time zone,
ADD COLUMN IF NOT EXISTS "scheduledTime" text;

-- Migrate existing data from 'time' to new fields
-- For non-repeating tasks: move time to scheduledDate
UPDATE "Activity"
SET "scheduledDate" = "createdAt"::date + time::time
WHERE "isRepeating" = false AND time IS NOT NULL;

-- For repeating tasks: move time to scheduledTime (just the HH:MM part)
UPDATE "Activity"
SET "scheduledTime" = time::text,
    "repeatStartDate" = CURRENT_DATE
WHERE "isRepeating" = true AND time IS NOT NULL;

-- Optional: Drop the old 'time' column after verification
-- ALTER TABLE "Activity" DROP COLUMN IF EXISTS time;

-- Update repeatEndDate to be just date (if needed)
-- The column is already DateTime in Prisma, so it can handle dates

COMMENT ON COLUMN "Activity"."scheduledDate" IS 'Full date+time for one-time tasks';
COMMENT ON COLUMN "Activity"."scheduledTime" IS 'Time only (HH:MM) for repeating tasks';
COMMENT ON COLUMN "Activity"."repeatStartDate" IS 'Start date for repeating tasks';


-- Migration to update AdminReminder table schema
-- Run this in Supabase SQL Editor

-- Step 1: Add RepeatFrequency enum (same as Activity)
CREATE TYPE "RepeatFrequency" AS ENUM ('day', 'week');

-- Step 2: Drop old columns
ALTER TABLE "AdminReminder" 
DROP COLUMN IF EXISTS "frequencyType",
DROP COLUMN IF EXISTS "intervalValue",
DROP COLUMN IF EXISTS "dayOfWeek",
DROP COLUMN IF EXISTS time;

-- Step 3: Add new columns (same structure as Activity)
ALTER TABLE "AdminReminder"
ADD COLUMN IF NOT EXISTS "isRepeating" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "repeatInterval" integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "repeatUnit" "RepeatFrequency" NOT NULL DEFAULT 'day'::"RepeatFrequency",
ADD COLUMN IF NOT EXISTS "repeatStartDate" timestamp without time zone,
ADD COLUMN IF NOT EXISTS "repeatEndType" "RepeatEndType" NOT NULL DEFAULT 'never'::"RepeatEndType",
ADD COLUMN IF NOT EXISTS "repeatEndDate" timestamp without time zone,
ADD COLUMN IF NOT EXISTS "repeatOccurrences" integer,
ADD COLUMN IF NOT EXISTS "scheduledDate" timestamp without time zone,
ADD COLUMN IF NOT EXISTS "scheduledTime" text;

-- Step 4: Drop old ReminderFrequency enum if exists
DROP TYPE IF EXISTS "ReminderFrequency";

-- Comments
COMMENT ON COLUMN "AdminReminder"."scheduledDate" IS 'Full date+time for one-time reminders';
COMMENT ON COLUMN "AdminReminder"."scheduledTime" IS 'Time only (HH:MM) for repeating reminders';
COMMENT ON COLUMN "AdminReminder"."repeatStartDate" IS 'Start date for repeating reminders';

-- Example usage:
-- One-time reminder on specific date:
-- INSERT INTO "AdminReminder" (title, "isRepeating", "scheduledDate") 
-- VALUES ('Meeting', false, '2025-01-15 14:00:00');

-- Daily repeating reminder:
-- INSERT INTO "AdminReminder" (title, "isRepeating", "repeatUnit", "repeatStartDate", "scheduledTime") 
-- VALUES ('Daily standup', true, 'day', '2025-01-01', '09:00');

-- Weekly repeating reminder (every Monday):
-- INSERT INTO "AdminReminder" (title, "isRepeating", "repeatInterval", "repeatUnit", "repeatStartDate", "scheduledTime") 
-- VALUES ('Weekly review', true, 1, 'week', '2025-01-06', '15:00'); -- Jan 6 is a Monday


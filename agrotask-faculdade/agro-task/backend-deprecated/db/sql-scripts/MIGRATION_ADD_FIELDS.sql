-- Migration to add missing fields
-- 1. Add roles column to Activity
-- 2. Add repeatDaysOfWeek to AdminReminder

-- Step 1: Add roles column to Activity (if it doesn't exist)
ALTER TABLE public."Activity" 
ADD COLUMN IF NOT EXISTS "roles" text[] DEFAULT '{}'::text[];

-- Step 2: Add repeatDaysOfWeek to AdminReminder
ALTER TABLE public."AdminReminder" 
ADD COLUMN IF NOT EXISTS "repeatDaysOfWeek" integer[] DEFAULT '{}'::integer[];

-- Add comments
COMMENT ON COLUMN public."Activity"."roles" IS 'Array of role strings (renamed from tags)';
COMMENT ON COLUMN public."AdminReminder"."repeatDaysOfWeek" IS 'Array of weekdays for weekly repeating reminders (0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday)';


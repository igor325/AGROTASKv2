-- Complete Migration - Add all missing fields
-- Execute this in Supabase SQL Editor

-- 1. Add roles to Activity (fixes the error)
ALTER TABLE public."Activity" 
ADD COLUMN IF NOT EXISTS "roles" text[] DEFAULT '{}'::text[];

-- 2. Add repeatDaysOfWeek to Activity
ALTER TABLE public."Activity" 
ADD COLUMN IF NOT EXISTS "repeatDaysOfWeek" integer[] DEFAULT '{}'::integer[];

-- 3. Add repeatDaysOfWeek to AdminReminder
ALTER TABLE public."AdminReminder" 
ADD COLUMN IF NOT EXISTS "repeatDaysOfWeek" integer[] DEFAULT '{}'::integer[];

-- Add comments for documentation
COMMENT ON COLUMN public."Activity"."roles" IS 'Array of role strings (renamed from tags)';
COMMENT ON COLUMN public."Activity"."repeatDaysOfWeek" IS 'Array of weekdays for weekly repeating tasks (0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday)';
COMMENT ON COLUMN public."AdminReminder"."repeatDaysOfWeek" IS 'Array of weekdays for weekly repeating reminders (0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday)';


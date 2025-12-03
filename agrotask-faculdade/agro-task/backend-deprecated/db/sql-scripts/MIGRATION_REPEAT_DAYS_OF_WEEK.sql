-- Migration to add repeatDaysOfWeek field to Activity table
-- Add the new column for storing days of week for weekly repeating tasks
ALTER TABLE public."Activity" 
ADD COLUMN "repeatDaysOfWeek" integer[] DEFAULT '{}'::integer[];

-- Add comment to explain the field
COMMENT ON COLUMN public."Activity"."repeatDaysOfWeek" IS 'Array of weekdays for weekly repeating tasks (0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday)';


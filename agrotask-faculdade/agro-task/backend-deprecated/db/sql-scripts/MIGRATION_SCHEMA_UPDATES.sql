-- Migration: Schema Updates
-- 1. Rename tags to roles on Activity
-- 2. Add messageString to AdminReminder
-- 3. Make repetition fields optional in AdminReminder

-- Step 1: Add roles column to Activity (will replace tags)
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "roles" text[] DEFAULT '{}';

-- Step 2: Copy data from tags to roles (if tags column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Activity' 
        AND column_name = 'tags'
    ) THEN
        UPDATE "Activity" SET "roles" = "tags";
        ALTER TABLE "Activity" DROP COLUMN "tags";
    END IF;
END $$;

-- Step 3: Add messageString to AdminReminder
ALTER TABLE "AdminReminder" ADD COLUMN IF NOT EXISTS "messageString" text;

-- Step 4: Make repetition fields optional in AdminReminder
-- Change isRepeating from Boolean NOT NULL to Boolean NULL
ALTER TABLE "AdminReminder" ALTER COLUMN "isRepeating" DROP NOT NULL;
ALTER TABLE "AdminReminder" ALTER COLUMN "isRepeating" SET DEFAULT false;

-- Change repeatInterval from Int NOT NULL to Int NULL
ALTER TABLE "AdminReminder" ALTER COLUMN "repeatInterval" DROP NOT NULL;
ALTER TABLE "AdminReminder" ALTER COLUMN "repeatInterval" SET DEFAULT 1;

-- Change repeatUnit from RepeatFrequency NOT NULL to RepeatFrequency NULL
ALTER TABLE "AdminReminder" ALTER COLUMN "repeatUnit" DROP NOT NULL;
ALTER TABLE "AdminReminder" ALTER COLUMN "repeatUnit" SET DEFAULT 'day';

-- Change repeatEndType from RepeatEndType NOT NULL to RepeatEndType NULL
ALTER TABLE "AdminReminder" ALTER COLUMN "repeatEndType" DROP NOT NULL;
ALTER TABLE "AdminReminder" ALTER COLUMN "repeatEndType" SET DEFAULT 'never';

-- Verification queries (optional - comment out if not needed)
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'Activity' AND column_name IN ('roles', 'tags');

-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'AdminReminder' 
-- AND column_name IN ('messageString', 'isRepeating', 'repeatInterval', 'repeatUnit', 'repeatEndType');



-- CRITICAL FIX: Add DEFAULT gen_random_uuid() to users.id column
-- The id column has no default, so INSERT fails with null constraint violation

-- Ensure pgcrypto extension exists (provides gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Set the default for the id column
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verify it works
DO $$
DECLARE
    test_id uuid;
BEGIN
    INSERT INTO public.users (email, display_name, show_in_public)
    VALUES ('__migration_test__@test.local', 'Migration Test', false)
    RETURNING id INTO test_id;
    
    IF test_id IS NOT NULL THEN
        DELETE FROM public.users WHERE id = test_id;
        RAISE NOTICE 'SUCCESS: INSERT with auto-generated id works. Test id was: %', test_id;
    ELSE
        RAISE EXCEPTION 'FAILED: id was still null after insert';
    END IF;
END $$;

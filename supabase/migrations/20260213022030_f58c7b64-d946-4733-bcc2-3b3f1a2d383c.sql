
-- Step 1: Migrate existing rows
UPDATE public.user_roles SET role = 'inspector' WHERE role = 'construction_manager';

-- Step 2: Drop policies first (they depend on functions)
DROP POLICY IF EXISTS "Admins read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;

-- Step 3: Drop functions (now safe)
DROP FUNCTION IF EXISTS public.has_ops_role(uuid, ops_role);
DROP FUNCTION IF EXISTS public.get_ops_role(uuid);

-- Step 4: Create new enum type
CREATE TYPE public.ops_role_new AS ENUM ('admin', 'office_manager', 'field_ops', 'engineer');

-- Step 5: Alter column to use new enum
ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.ops_role_new
  USING (
    CASE role::text
      WHEN 'inspector' THEN 'field_ops'::public.ops_role_new
      WHEN 'construction_manager' THEN 'field_ops'::public.ops_role_new
      ELSE role::text::public.ops_role_new
    END
  );

-- Step 6: Drop old enum and rename
DROP TYPE public.ops_role;
ALTER TYPE public.ops_role_new RENAME TO ops_role;

-- Step 7: Recreate functions
CREATE OR REPLACE FUNCTION public.get_ops_role(_user_id uuid)
RETURNS ops_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.has_ops_role(_user_id uuid, _role ops_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Step 8: Recreate RLS policies
CREATE POLICY "Admins read all profiles"
ON public.user_profiles FOR SELECT
USING (has_ops_role(auth.uid(), 'admin'::ops_role) OR has_ops_role(auth.uid(), 'office_manager'::ops_role));

CREATE POLICY "Admins read all roles"
ON public.user_roles FOR SELECT
USING (has_ops_role(auth.uid(), 'admin'::ops_role));

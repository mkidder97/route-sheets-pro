

# Add Authentication to RoofOps Section

## Overview

Add email/password login gating to all `/ops/*` routes while leaving the existing RoofRoute pages completely untouched. Admins create accounts (no self-signup).

## Database Changes (Migration)

### 1. Create `user_roles` table (security best practice)

Per security requirements, roles are stored in a separate table rather than on the profile itself. A security definer function `has_role()` is used for RLS checks.

```sql
-- Role enum
CREATE TYPE public.ops_role AS ENUM (
  'admin', 'office_manager', 'inspector', 'engineer', 'construction_manager'
);

-- Roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role ops_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for RLS
CREATE OR REPLACE FUNCTION public.has_ops_role(_user_id uuid, _role ops_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user has any ops role
CREATE OR REPLACE FUNCTION public.get_ops_role(_user_id uuid)
RETURNS ops_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id LIMIT 1
$$;
```

### 2. Create `user_profiles` table

```sql
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  inspector_id uuid REFERENCES public.inspectors(id),
  phone text,
  is_active boolean DEFAULT true,
  notification_preferences jsonb DEFAULT '{"email": true, "sms": false}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
```

### 3. RLS Policies

```sql
-- user_profiles: users read own, admin/office_manager read all
CREATE POLICY "Users read own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins read all profiles" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    public.has_ops_role(auth.uid(), 'admin')
    OR public.has_ops_role(auth.uid(), 'office_manager')
  );

CREATE POLICY "Users update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- user_roles: only readable, not self-modifiable
CREATE POLICY "Users read own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_ops_role(auth.uid(), 'admin'));
```

### 4. Trigger for updated_at

```sql
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 5. Auto-create profile on signup (trigger)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## New Files

### `src/hooks/useAuth.ts`

Custom hook providing:
- `user` -- current Supabase auth user (from `onAuthStateChange` listener set up before `getSession()`)
- `profile` -- fetched from `user_profiles` table
- `role` -- fetched from `user_roles` table via `get_ops_role()` RPC
- `isLoading` -- true while auth state initializing
- `signIn(email, password)` -- calls `supabase.auth.signInWithPassword`
- `signOut()` -- calls `supabase.auth.signOut`

Uses React context (`AuthProvider`) so it can be consumed anywhere under the provider.

### `src/components/ops/ProtectedRoute.tsx`

- Wraps children; checks `useAuth()` for authenticated user
- If not authenticated and not loading, redirects to `/ops/login`
- Accepts optional `allowedRoles: ops_role[]` prop
- If user's role is not in `allowedRoles`, renders an "Access Denied" card instead of the children

### `src/pages/ops/OpsLogin.tsx`

- Clean login page with dark blue (#1B4F72) header bar showing white "RoofOps" text
- Email + password fields using existing `Input` and `Button` components
- "Sign In" button, error message display
- No sign-up form
- On successful login, redirect to `/ops`

## Modified Files

### `src/App.tsx`

- Wrap the app (or just the ops routes) with `AuthProvider`
- Add `/ops/login` route **outside** the OpsLayout (it has its own layout)
- Wrap OpsLayout with `ProtectedRoute`

```text
<Route path="/ops/login" element={<OpsLogin />} />
<Route path="/ops" element={<ProtectedRoute><OpsLayout /></ProtectedRoute>}>
  <Route index element={<OpsDashboard />} />
  ...
</Route>
```

Existing RoofRoute routes remain completely untouched.

### `src/components/ops/OpsSidebar.tsx`

- Add user info section at the bottom (above "Switch to RoofRoute"):
  - Display user's full_name and role from `useAuth()`
  - Sign out button (LogOut icon)
- When sidebar is collapsed, show just the sign-out icon button

### Files NOT modified

- All existing RoofRoute pages and components stay exactly as they are
- `src/components/AppLayout.tsx`, `AppSidebar.tsx` -- no changes
- `src/integrations/supabase/client.ts` -- never touched

## Technical Details

| Item | Detail |
|------|--------|
| New files | 3 (useAuth.ts, ProtectedRoute.tsx, OpsLogin.tsx) |
| Modified files | 2 (App.tsx, OpsSidebar.tsx) |
| Migration | 1 (creates 2 tables, 1 enum, 2 functions, RLS policies, triggers) |
| Auth method | Email/password only via `signInWithPassword` |
| Session handling | `onAuthStateChange` listener set up before `getSession()` |
| Role storage | Separate `user_roles` table with security definer function |


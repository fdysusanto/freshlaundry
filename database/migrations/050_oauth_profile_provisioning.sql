-- =============================================================================
-- CUCIYAN LAUNDRY MARKETPLACE
-- Migration: 050_oauth_profile_provisioning.sql
-- Description: Drop NOT NULL constraint on public.profiles.phone and create
--              automatic handle_new_user() trigger AFTER INSERT ON auth.users.
-- Author: Antigravity AI Architecture Team
-- Date: 2026-09-21
-- Status: IDEMPOTENT & TRANSACTIONAL (DESIGN / DRAFT)
-- =============================================================================

BEGIN;

-- 1. MAKE public.profiles.phone NULLABLE FOR OAUTH COMPATIBILITY
-- Google and Apple OAuth providers do not supply phone numbers during signup.
-- Allowing NULL in public.profiles.phone allows OAuth users to register without
-- violating schema constraints, while maintaining data integrity.
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;

-- 2. CREATE OR REPLACE PROVISIONING TRIGGER FUNCTION
-- Automatically creates a minimal profile row in public.profiles whenever a new
-- user signs up via Supabase Auth (Email/Password, Google OAuth, or Apple OAuth).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_full_name TEXT;
  v_avatar_url TEXT;
  v_phone TEXT;
BEGIN
  -- 1. Extract & validate email
  v_email := NULLIF(TRIM(NEW.email), '');

  -- If email is missing or empty, skip profile creation safely
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Extract full_name with strict precedence hierarchy
  -- 1) raw_user_meta_data.full_name
  -- 2) raw_user_meta_data.name
  -- 3) first_name + last_name
  -- 4) local-part of email
  -- 5) Default 'Customer'
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(CONCAT(NEW.raw_user_meta_data->>'first_name', ' ', NEW.raw_user_meta_data->>'last_name')), ''),
    NULLIF(TRIM(SPLIT_PART(v_email, '@', 1)), ''),
    'Customer'
  );

  -- 3. Extract avatar_url (if provided by OAuth provider)
  v_avatar_url := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'picture'), '')
  );

  -- 4. Extract phone (NULL if not supplied by provider)
  v_phone := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');

  -- 5. Idempotent insert into public.profiles
  -- Security Rule: Role is STRICTLY hardcoded to 'customer'::public.user_role.
  -- raw_user_meta_data.role is IGNORED to prevent privilege escalation attacks.
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    avatar_url,
    created_at
  )
  VALUES (
    NEW.id,
    v_email,
    v_full_name,
    v_phone,
    'customer'::public.user_role,
    v_avatar_url,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public VOLATILE;

-- Revoke direct execution privileges from PUBLIC, anon, and authenticated roles for security
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3. CREATE IDEMPOTENT AFTER INSERT TRIGGER ON auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;

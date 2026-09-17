-- ============================================================
-- FIX ADMIN LOGIN FOR admin@wrapstore.com
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

-- Step 1: Create or update password for admin@wrapstore.com in auth.users
-- This sets the login password to: Admin@123456

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if user exists in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@wrapstore.com';

  IF v_user_id IS NOT NULL THEN
    -- Update existing user's password to Admin@123456
    UPDATE auth.users
    SET 
      encrypted_password = crypt('Admin@123456', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = v_user_id;
  ELSE
    -- Generate new UUID for user
    v_user_id := gen_random_uuid();
    
    -- Insert user into auth.users
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'admin@wrapstore.com', crypt('Admin@123456', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Super Admin"}', now(), now()
    );
  END IF;

  -- Ensure profile exists and has super_admin role
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (v_user_id, 'admin@wrapstore.com', 'Super Admin', 'super_admin', TRUE)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = 'super_admin',
    is_active = TRUE;

END $$;

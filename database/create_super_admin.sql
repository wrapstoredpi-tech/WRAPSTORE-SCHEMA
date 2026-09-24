-- ============================================================
-- WRAPSTORE POS — Create Super Admin Account
-- ============================================================
-- PREREQUISITES: Run database/schema.sql FIRST before this script.
-- ============================================================
-- Credentials:
--   Email    : admin@wrapstore.com
--   Password : WrapAdmin@2026
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN

  -- Step 1: Check if auth user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'admin@wrapstore.com';

  IF v_user_id IS NULL THEN
    -- Create fresh auth user
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'admin@wrapstore.com',
      crypt('WrapAdmin@2026', gen_salt('bf')),
      NOW(),
      '{"full_name": "Super Admin", "role": "super_admin"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;

    RAISE NOTICE 'Auth user created with id: %', v_user_id;
  ELSE
    -- User already exists — update password just in case
    UPDATE auth.users
    SET encrypted_password    = crypt('WrapAdmin@2026', gen_salt('bf')),
        email_confirmed_at    = COALESCE(email_confirmed_at, NOW()),
        raw_user_meta_data    = '{"full_name": "Super Admin", "role": "super_admin"}'::jsonb,
        updated_at            = NOW()
    WHERE id = v_user_id;

    RAISE NOTICE 'Auth user already exists (id: %). Password reset to WrapAdmin@2026.', v_user_id;
  END IF;

  -- Step 2: Upsert the profile with super_admin role
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (v_user_id, 'admin@wrapstore.com', 'Super Admin', 'super_admin', TRUE)
  ON CONFLICT (id) DO UPDATE
    SET role       = 'super_admin',
        full_name  = 'Super Admin',
        is_active  = TRUE,
        updated_at = NOW();

  RAISE NOTICE 'Profile upserted — role set to super_admin.';

END;
$$;

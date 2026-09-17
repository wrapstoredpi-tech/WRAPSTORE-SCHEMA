-- ============================================================
-- WRAPSTORE - CREATE ADMIN USER SQL SCRIPT
-- Run this script in Supabase Dashboard -> SQL Editor
-- ============================================================

-- Method 1: Promote an existing user to Super Admin
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'admin@wrapstore.in';

-- ============================================================
-- Method 2: Create Super Admin directly via SQL (if not already created via UI)
-- Default Password set below: Admin@123456
-- ============================================================
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@wrapstore.in',
  crypt('Admin@123456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"WrapStore Super Admin", "role":"super_admin"}',
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;

-- Ensure profile role is updated to super_admin
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'admin@wrapstore.in';

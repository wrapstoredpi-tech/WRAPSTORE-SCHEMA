-- Migration: Add customer_phone to online_sales
-- Run this in the Supabase SQL Editor if you want a dedicated customer_phone column

ALTER TABLE public.online_sales 
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

COMMENT ON COLUMN public.online_sales.customer_phone IS 'Customer mobile/phone number for manual channel sales';


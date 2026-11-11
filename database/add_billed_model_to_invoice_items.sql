-- Migration: Add billed_model to invoice_items
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS billed_model TEXT;

COMMENT ON COLUMN public.invoice_items.billed_model IS 'The specific phone model selected by cashier during POS billing';

CREATE INDEX IF NOT EXISTS idx_invoice_items_billed_model ON public.invoice_items(billed_model);


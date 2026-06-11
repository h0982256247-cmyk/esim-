-- Migration: Add bundle_id + bundle_seq to orders for multi-item checkout
-- Run this in Supabase SQL Editor.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS bundle_id  TEXT,
  ADD COLUMN IF NOT EXISTS bundle_seq INTEGER;

-- Group all orders in the same checkout
CREATE INDEX IF NOT EXISTS idx_orders_bundle_id ON orders (bundle_id) WHERE bundle_id IS NOT NULL;

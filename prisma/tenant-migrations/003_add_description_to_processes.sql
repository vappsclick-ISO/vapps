-- Add description column to processes table
-- This migration adds the description field to existing processes tables

ALTER TABLE "processes" ADD COLUMN IF NOT EXISTS "description" TEXT;

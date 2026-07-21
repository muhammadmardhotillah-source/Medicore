-- Migration: add scan_url column for radiology scan uploads
ALTER TABLE radiology_requests ADD COLUMN IF NOT EXISTS scan_url TEXT;

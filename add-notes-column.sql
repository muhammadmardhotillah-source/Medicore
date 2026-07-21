-- ============================================
-- MediCore SIMRS — Add notes column to registrations
-- ============================================
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add hasil column to lab_requests
ALTER TABLE lab_requests ADD COLUMN IF NOT EXISTS hasil TEXT;

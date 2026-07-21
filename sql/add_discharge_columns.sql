-- ============================================
-- MediCore SIMRS — Add discharge columns
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS bed_id UUID REFERENCES beds(id);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS tanggal_masuk TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS tanggal_pulang TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS diagnosa_masuk TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS diagnosa_akhir TEXT;

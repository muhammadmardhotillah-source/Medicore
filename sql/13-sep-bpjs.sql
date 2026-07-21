-- ============================================================
-- MediCore SIMRS — BPJS SEP Table & Migration
-- Execute di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. TABLE: SEP BPJS (Surat Eligibilitas Peserta)
CREATE TABLE IF NOT EXISTS sep_bpjs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_sep TEXT NOT NULL UNIQUE,
    no_bpjs TEXT NOT NULL,
    no_rm TEXT,
    poli TEXT,
    jenis TEXT DEFAULT 'Rawat Jalan',
    diagnosis TEXT,
    dpjp TEXT,
    catatan TEXT,
    registration_id UUID REFERENCES registrations(id),
    status TEXT DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add constraint to prevent duplicate SEP per registration
ALTER TABLE sep_bpjs ADD CONSTRAINT unique_reg_sep UNIQUE (registration_id);

-- 3. Add BPJS number column to patients if not exists
ALTER TABLE patients ADD COLUMN IF NOT EXISTS no_bpjs VARCHAR(20);

-- 4. Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_sep_nobpjs ON sep_bpjs (no_bpjs);
CREATE INDEX IF NOT EXISTS idx_sep_reg ON sep_bpjs (registration_id);

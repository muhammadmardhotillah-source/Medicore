-- ============================================
-- MediCore SIMRS — Database Migration Script
-- ============================================

-- 1️⃣ BUAT TABLE beds (tempat tidur)
CREATE TABLE IF NOT EXISTS beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor VARCHAR(20) NOT NULL,
    kelas VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Tersedia',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2️⃣ TAMBAH KOLOM YANG KURANG DI patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nik VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS jk VARCHAR(10);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS alamat TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS no_hp VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS agama VARCHAR(20);

-- 3️⃣ TAMBAH KOLOM YANG KURANG DI registrations
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS no_antrian VARCHAR(10);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS penjamin VARCHAR(20);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Menunggu';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS loket_id VARCHAR(10);

-- ============================================
-- Selesai
-- ============================================

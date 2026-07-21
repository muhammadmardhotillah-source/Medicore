-- =============================================================
-- 05-penggunaan-obat.sql — Penggunaan Obat Pasien Module
-- MediCore SIMRS
-- Execute this in Supabase SQL Editor
-- =============================================================

-- Add no_resep column if not exists
ALTER TABLE penggunaan_obat ADD COLUMN IF NOT EXISTS no_resep TEXT;

CREATE TABLE IF NOT EXISTS penggunaan_obat (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    medicine_id UUID REFERENCES medicines(id) ON DELETE RESTRICT,
    registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
    no_resep TEXT,
    jumlah INTEGER NOT NULL CHECK (jumlah > 0),
    satuan TEXT DEFAULT 'tablet',
    dosis TEXT,
    aturan_pakai TEXT,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    keterangan TEXT,
    dibuat_oleh UUID,
    poli_id UUID REFERENCES poli(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_penggunaan_obat_pasien ON penggunaan_obat(patient_id);
CREATE INDEX IF NOT EXISTS idx_penggunaan_obat_obat ON penggunaan_obat(medicine_id);
CREATE INDEX IF NOT EXISTS idx_penggunaan_obat_tanggal ON penggunaan_obat(tanggal);
CREATE INDEX IF NOT EXISTS idx_penggunaan_obat_registrasi ON penggunaan_obat(registration_id);
CREATE INDEX IF NOT EXISTS idx_penggunaan_obat_no_resep ON penggunaan_obat(no_resep);
CREATE INDEX IF NOT EXISTS idx_penggunaan_obat_poli ON penggunaan_obat(poli_id);
CREATE INDEX IF NOT EXISTS idx_penggunaan_obat_dibuat_oleh ON penggunaan_obat(dibuat_oleh);

-- Enable RLS
ALTER TABLE penggunaan_obat ENABLE ROW LEVEL SECURITY;

-- Public access (anon key)
CREATE POLICY "Public access" ON penggunaan_obat FOR ALL USING (true) WITH CHECK (true);

-- =============================================================
-- SEED DOCTORS (if not exists)
-- =============================================================
INSERT INTO users (id, nama, email, role, is_active, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'dr. Andi Wijaya', 'dr.andi@edoy.com', 'dokter', true, NOW()),
  ('22222222-2222-2222-2222-222222222222', 'dr. Siti Nurhaliza', 'dr.siti@edoy.com', 'dokter', true, NOW()),
  ('33333333-3333-3333-3333-333333333333', 'dr. Budi Santoso', 'dr.budi@edoy.com', 'dokter', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- SEED DATA — sample medication usage records
-- =============================================================
DO $$
DECLARE
    v_pasien_budi UUID;
    v_pasien_siti UUID;
    v_pasien_ahmad UUID;
    v_obat_amlodipine UUID;
    v_obat_metformin UUID;
    v_obat_omeprazole UUID;
    v_obat_paracetamol UUID;
    v_dokter_andi UUID := '11111111-1111-1111-1111-111111111111';
    v_dokter_siti UUID := '22222222-2222-2222-2222-222222222222';
    v_dokter_budi UUID := '33333333-3333-3333-3333-333333333333';
    v_poli_jantung UUID;
    v_poli_umum UUID;
    v_poli_kandungan UUID;
    v_poli_penyakit_dalam UUID;
BEGIN
    -- Get patient IDs
    SELECT id INTO v_pasien_budi FROM patients WHERE nama LIKE '%Budi%' LIMIT 1;
    SELECT id INTO v_pasien_siti FROM patients WHERE nama LIKE '%Siti%' LIMIT 1;
    SELECT id INTO v_pasien_ahmad FROM patients WHERE nama LIKE '%Ahmad%' LIMIT 1;

    -- Get medicine IDs
    SELECT id INTO v_obat_amlodipine FROM medicines WHERE kode = 'OBT-001' LIMIT 1;
    SELECT id INTO v_obat_metformin FROM medicines WHERE kode = 'OBT-002' LIMIT 1;
    SELECT id INTO v_obat_omeprazole FROM medicines WHERE kode = 'OBT-005' LIMIT 1;
    SELECT id INTO v_obat_paracetamol FROM medicines WHERE kode = 'OBT-007' LIMIT 1;

    -- Get poli IDs
    SELECT id INTO v_poli_jantung FROM poli WHERE nama_poli LIKE '%Jantung%' LIMIT 1;
    SELECT id INTO v_poli_umum FROM poli WHERE nama_poli LIKE '%Umum%' LIMIT 1;
    SELECT id INTO v_poli_kandungan FROM poli WHERE nama_poli LIKE '%Kandungan%' LIMIT 1;
    SELECT id INTO v_poli_penyakit_dalam FROM poli WHERE nama_poli LIKE '%Penyakit Dalam%' LIMIT 1;

    -- Delete old seed data
    DELETE FROM penggunaan_obat WHERE keterangan IN ('Kontrol hipertensi rutin', 'DM tipe 2', 'Gastritis', 'Demam');

    -- Insert sample records with proper no_resep, dokter, poli
    IF v_pasien_budi IS NOT NULL AND v_obat_amlodipine IS NOT NULL AND v_poli_jantung IS NOT NULL THEN
        INSERT INTO penggunaan_obat (patient_id, medicine_id, no_resep, jumlah, satuan, dosis, aturan_pakai, tanggal, keterangan, dibuat_oleh, poli_id)
        VALUES (v_pasien_budi, v_obat_amlodipine, 'RSP-20260706-001', 30, 'tablet', '5 mg', '1x sehari setelah makan', CURRENT_DATE, 'Kontrol hipertensi rutin', v_dokter_andi, v_poli_jantung);
    END IF;

    IF v_pasien_siti IS NOT NULL AND v_obat_metformin IS NOT NULL AND v_poli_kandungan IS NOT NULL THEN
        INSERT INTO penggunaan_obat (patient_id, medicine_id, no_resep, jumlah, satuan, dosis, aturan_pakai, tanggal, keterangan, dibuat_oleh, poli_id)
        VALUES (v_pasien_siti, v_obat_metformin, 'RSP-20260706-002', 60, 'tablet', '500 mg', '2x sehari sebelum makan', CURRENT_DATE, 'DM tipe 2', v_dokter_siti, v_poli_kandungan);
    END IF;

    IF v_pasien_ahmad IS NOT NULL AND v_obat_omeprazole IS NOT NULL AND v_poli_umum IS NOT NULL THEN
        INSERT INTO penggunaan_obat (patient_id, medicine_id, no_resep, jumlah, satuan, dosis, aturan_pakai, tanggal, keterangan, dibuat_oleh, poli_id)
        VALUES (v_pasien_ahmad, v_obat_omeprazole, 'RSP-20260705-001', 14, 'kapsul', '20 mg', '1x sehari sebelum sarapan', CURRENT_DATE - 1, 'Gastritis', v_dokter_budi, v_poli_umum);
    END IF;

    IF v_pasien_budi IS NOT NULL AND v_obat_paracetamol IS NOT NULL AND v_poli_penyakit_dalam IS NOT NULL THEN
        INSERT INTO penggunaan_obat (patient_id, medicine_id, no_resep, jumlah, satuan, dosis, aturan_pakai, tanggal, keterangan, dibuat_oleh, poli_id)
        VALUES (v_pasien_budi, v_obat_paracetamol, 'RSP-20260704-001', 10, 'tablet', '500 mg', '3x sehari jika demam', CURRENT_DATE - 2, 'Demam', v_dokter_andi, v_poli_penyakit_dalam);
    END IF;
END $$;

-- =============================================================
-- UPDATE MEDICINE PRICES (if not set)
-- =============================================================
UPDATE medicines SET harga = 2500 WHERE kode = 'OBT-001' AND (harga IS NULL OR harga = 0);  -- Amlodipine
UPDATE medicines SET harga = 3000 WHERE kode = 'OBT-002' AND (harga IS NULL OR harga = 0);  -- Metformin
UPDATE medicines SET harga = 5000 WHERE kode = 'OBT-005' AND (harga IS NULL OR harga = 0);  -- Omeprazole
UPDATE medicines SET harga = 1500 WHERE kode = 'OBT-007' AND (harga IS NULL OR harga = 0);  -- Paracetamol
-- =============================================================
-- 05a-penggunaan-obat-fix.sql — Fix missing columns
-- MediCore SIMRS
-- Menambah kolom no_resep, status, poli_id yg hilang
-- + backfill data existing
-- Execute di Supabase SQL Editor
-- =============================================================

-- 1. ADD MISSING COLUMNS
ALTER TABLE penggunaan_obat ADD COLUMN IF NOT EXISTS no_resep TEXT;
ALTER TABLE penggunaan_obat ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE penggunaan_obat ADD COLUMN IF NOT EXISTS poli_id INTEGER REFERENCES poli(id);

-- 2. BACKFILL EXISTING DATA dengan no_resep + status
-- Record 1: Budi Santoso → Demam → Penyakit Dalam (id=16)
UPDATE penggunaan_obat
SET no_resep = 'RSP-20260704-001',
    status = 'pending',
    poli_id = (SELECT id FROM poli WHERE nama_poli = 'Penyakit Dalam' LIMIT 1)
WHERE keterangan = 'Demam'
  AND no_resep IS NULL;

-- Record 2: Ahmad Fauzi → Gastritis → Umum (id=13)
UPDATE penggunaan_obat
SET no_resep = 'RSP-20260705-001',
    status = 'pending',
    poli_id = (SELECT id FROM poli WHERE nama_poli = 'Umum' LIMIT 1)
WHERE keterangan = 'Gastritis'
  AND no_resep IS NULL;

-- Record 3: Budi Santoso → Kontrol hipertensi rutin → Jantung (id=15)
UPDATE penggunaan_obat
SET no_resep = 'RSP-20260706-001',
    status = 'pending',
    poli_id = (SELECT id FROM poli WHERE nama_poli = 'Jantung' LIMIT 1)
WHERE keterangan = 'Kontrol hipertensi rutin'
  AND no_resep IS NULL;

-- Record 4: Siti Rahayu → DM tipe 2 → Kandungan (id=17)
UPDATE penggunaan_obat
SET no_resep = 'RSP-20260706-002',
    status = 'pending',
    poli_id = (SELECT id FROM poli WHERE nama_poli = 'Kandungan' LIMIT 1)
WHERE keterangan = 'DM tipe 2'
  AND no_resep IS NULL;

-- 3. VERIFICATION
SELECT no_resep, status, poli_id, keterangan, patient_id,
  (SELECT nama FROM patients WHERE id = penggunaan_obat.patient_id) AS nama_pasien,
  (SELECT nama_poli FROM poli WHERE id = penggunaan_obat.poli_id) AS nama_poli
FROM penggunaan_obat
ORDER BY tanggal DESC;

-- =============================================================
-- 06-permintaan-medis.sql — Medical Supplies Request Module
-- MediCore SIMRS
-- =============================================================
-- Tabel permintaan Medis (header)
CREATE TABLE IF NOT EXISTS permintaan_medis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_permintaan TEXT NOT NULL UNIQUE,
    unit_peminta TEXT NOT NULL DEFAULT 'Apotek',
    keterangan TEXT,
    status TEXT NOT NULL DEFAULT 'Menunggu',
    dibuat_oleh UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel item permintaan (detail baris)
CREATE TABLE IF NOT EXISTS permintaan_medis_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permintaan_id UUID NOT NULL REFERENCES permintaan_medis(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES medicines(id),
    jumlah_diminta INTEGER NOT NULL DEFAULT 0,
    jumlah_diberikan INTEGER DEFAULT 0,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE permintaan_medis ENABLE ROW LEVEL SECURITY;
ALTER TABLE permintaan_medis_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "anon_all_permintaan" ON permintaan_medis FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_permintaan_items" ON permintaan_medis_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed data — sample requests
INSERT INTO permintaan_medis (no_permintaan, unit_peminta, keterangan, status) VALUES
('PM-20260706-001', 'Rawat Inap', 'Stok obat bulanan untuk bangsal rawat inap - kebutuhan rutin', 'Selesai'),
('PM-20260706-002', 'UGD', 'Re-stok obat emergency UGD - kebutuhan segera', 'Diproses'),
('PM-20260707-001', 'Poli Jantung', 'Permintaan obat hipertensi untuk pasien kontrol', 'Menunggu'),
('PM-20260707-002', 'Kandungan', 'Suplemen vitamin dan obat pendukung', 'Menunggu')
ON CONFLICT (no_permintaan) DO NOTHING;

INSERT INTO permintaan_medis_items (permintaan_id, medicine_id, jumlah_diminta, jumlah_diberikan, keterangan)
SELECT pm.id, m.id, 
  CASE 
    WHEN m.kode = 'OBT-001' THEN 200
    WHEN m.kode = 'OBT-002' THEN 150
    WHEN m.kode = 'OBT-003' THEN 300
    WHEN m.kode = 'OBT-005' THEN 100
    WHEN m.kode = 'OBT-007' THEN 250
    WHEN m.kode = 'OBT-008' THEN 80
    ELSE 50
  END,
  CASE 
    WHEN pm.status = 'Selesai' THEN 
      CASE 
        WHEN m.kode = 'OBT-001' THEN 200
        WHEN m.kode = 'OBT-002' THEN 150
        WHEN m.kode = 'OBT-003' THEN 300
        WHEN m.kode = 'OBT-005' THEN 100
        WHEN m.kode = 'OBT-007' THEN 250
        WHEN m.kode = 'OBT-008' THEN 80
        ELSE 50
      END
    ELSE 0
  END,
  CASE 
    WHEN m.kode = 'OBT-001' THEN 'Amlodipine 5mg untuk pasien hipertensi'
    WHEN m.kode = 'OBT-002' THEN 'Metformin 500mg untuk pasien DM'
    WHEN m.kode = 'OBT-003' THEN 'Vitamin B Complex'
    WHEN m.kode = 'OBT-005' THEN 'Omeprazole untuk pasien gastritis'
    WHEN m.kode = 'OBT-007' THEN 'Paracetamol 500mg'
    WHEN m.kode = 'OBT-008' THEN 'Lansoprazole 30mg'
    ELSE 'Keperluan medis'
  END
FROM permintaan_medis pm
CROSS JOIN medicines m
WHERE pm.no_permintaan IN ('PM-20260706-001', 'PM-20260706-002', 'PM-20260707-001', 'PM-20260707-002')
  AND m.id IN (
    SELECT id FROM medicines WHERE kode IN ('OBT-001','OBT-002','OBT-003','OBT-005','OBT-007','OBT-008')
  )
ON CONFLICT DO NOTHING;

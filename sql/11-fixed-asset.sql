-- =============================================================
-- 11-fixed-asset.sql — Fixed Asset Management Module
-- MediCore SIMRS
-- =============================================================

CREATE TABLE IF NOT EXISTS fixed_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_aset TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    kategori TEXT NOT NULL DEFAULT 'Lainnya',
    tanggal_perolehan DATE NOT NULL,
    harga_perolehan NUMERIC(15,2) NOT NULL DEFAULT 0,
    umur_manfaat INTEGER NOT NULL DEFAULT 5,
    nilai_residu NUMERIC(15,2) NOT NULL DEFAULT 0,
    lokasi TEXT,
    kondisi TEXT NOT NULL DEFAULT 'Baik',
    status TEXT NOT NULL DEFAULT 'Aktif',
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_fixed_assets" ON fixed_assets FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed data
INSERT INTO fixed_assets (kode_aset, nama, kategori, tanggal_perolehan, harga_perolehan, umur_manfaat, nilai_residu, lokasi, keterangan) VALUES
('ASET-001', 'Gedung Utama RS', 'Gedung', '2020-01-01', 5000000000, 30, 500000000, 'Jl. Utama No.1', 'Gedung utama 5 lantai'),
('ASET-002', 'Mobil Ambulans', 'Kendaraan', '2021-03-15', 450000000, 8, 50000000, 'Garasi RS', 'Toyota Hiace Ambulans'),
('ASET-003', 'CT Scan', 'Peralatan Medis', '2022-06-01', 2500000000, 10, 250000000, 'R. Radiologi Lt.2', 'Siemens CT Scanner'),
('ASET-004', 'X-Ray Mobile', 'Peralatan Medis', '2022-08-15', 350000000, 8, 35000000, 'R. Radiologi Lt.1', 'Mobile X-Ray Unit'),
('ASET-005', 'Server Rack', 'Komputer', '2023-01-10', 180000000, 5, 18000000, 'R. Server Lt.3', 'Dell PowerEdge R740'),
('ASET-006', 'Meja & Kursi Administrasi', 'Furniture', '2021-06-01', 75000000, 5, 7500000, 'R. Administrasi Lt.1', 'Set meja kursi 15 unit'),
('ASET-007', 'Sistem UPS', 'Peralatan Medis', '2023-03-20', 95000000, 5, 9500000, 'R. Server Lt.3', 'APC UPS 20kVA'),
('ASET-008', 'Mobil Operasional', 'Kendaraan', '2022-01-01', 320000000, 8, 32000000, 'Parkir RS', 'Toyota Innova'),
('ASET-009', 'AC Central', 'Lainnya', '2021-12-01', 250000000, 8, 25000000, 'Seluruh Gedung', 'AC Central 10 PK'),
('ASET-010', 'Tempat Tidur Pasien', 'Peralatan Medis', '2020-06-01', 450000000, 10, 45000000, 'Rawat Inap', '60 unit tempat tidur elektrik')
ON CONFLICT (kode_aset) DO NOTHING;
-- =============================================================
-- 08-logistik.sql — Non-Medical Logistics Module
-- MediCore SIMRS
-- =============================================================

CREATE TABLE IF NOT EXISTS logistik (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    kategori TEXT DEFAULT 'Umum',
    satuan TEXT DEFAULT 'pcs',
    stok NUMERIC DEFAULT 0,
    stok_minimum NUMERIC DEFAULT 5,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logistik_mutasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logistik_id UUID NOT NULL REFERENCES logistik(id) ON DELETE CASCADE,
    tipe TEXT NOT NULL CHECK (tipe IN ('masuk','keluar')),
    qty NUMERIC NOT NULL DEFAULT 0,
    keterangan TEXT,
    tanggal DATE DEFAULT CURRENT_DATE,
    dibuat_oleh TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE logistik ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistik_mutasi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_logistik" ON logistik FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_logistik_mutasi" ON logistik_mutasi FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed data
INSERT INTO logistik (kode, nama, kategori, satuan, stok, stok_minimum) VALUES
('LG-001', 'Kertas A4 70gr', 'ATK', 'rim', 50, 10),
('LG-002', 'Map Snail', 'ATK', 'pcs', 120, 25),
('LG-003', 'Ballpoint Standard', 'ATK', 'pcs', 200, 30),
('LG-004', 'Masker Biru (Box)', 'Kebersihan', 'box', 30, 10),
('LG-005', 'Hand Sanitizer 500ml', 'Kebersihan', 'botol', 15, 5),
('LG-006', 'Sabun Cair', 'Kebersihan', 'botol', 20, 8),
('LG-007', 'Tisu Gulung', 'Kebersihan', 'roll', 60, 15),
('LG-008', 'Kantong Plastik Samph', 'Kebersihan', 'pack', 40, 10)
ON CONFLICT (kode) DO NOTHING;

INSERT INTO logistik_mutasi (logistik_id, tipe, qty, keterangan, tanggal) 
SELECT l.id, 'masuk', l.stok, 'Stok awal', CURRENT_DATE
FROM logistik l
WHERE NOT EXISTS (SELECT 1 FROM logistik_mutasi WHERE logistik_id = l.id);

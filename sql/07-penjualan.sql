-- =============================================================
-- 07-penjualan.sql — Retail/Apotek Sales Module
-- MediCore SIMRS
-- =============================================================

CREATE TABLE IF NOT EXISTS penjualan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_penjualan TEXT NOT NULL UNIQUE,
    tanggal DATE DEFAULT CURRENT_DATE,
    customer TEXT DEFAULT 'Umum',
    subtotal NUMERIC DEFAULT 0,
    diskon NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    metode_bayar TEXT DEFAULT 'Tunai',
    status TEXT DEFAULT 'Lunas',
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS penjualan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    penjualan_id UUID NOT NULL REFERENCES penjualan(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES medicines(id),
    qty INTEGER NOT NULL DEFAULT 1,
    harga_satuan NUMERIC DEFAULT 0,
    subtotal NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE penjualan ENABLE ROW LEVEL SECURITY;
ALTER TABLE penjualan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_penjualan" ON penjualan FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_penjualan_items" ON penjualan_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed data — sample sales
INSERT INTO penjualan (no_penjualan, tanggal, customer, subtotal, total, metode_bayar, status) VALUES
('TRX-20260706-001', '2026-07-06', 'Umum', 45000, 45000, 'Tunai', 'Lunas'),
('TRX-20260706-002', '2026-07-06', 'Umum', 125000, 120000, 'QRIS', 'Lunas'),
('TRX-20260707-001', '2026-07-07', 'Siti Rahayu', 34000, 32000, 'Debit', 'Lunas')
ON CONFLICT (no_penjualan) DO NOTHING;

INSERT INTO penjualan_items (penjualan_id, medicine_id, qty, harga_satuan, subtotal)
SELECT p.id, m.id,
  CASE 
    WHEN p.no_penjualan = 'TRX-20260706-001' AND m.nama_obat = 'Paracetamol 500mg' THEN 10
    WHEN p.no_penjualan = 'TRX-20260706-001' AND m.nama_obat = 'Vitamin B Complex' THEN 5
    WHEN p.no_penjualan = 'TRX-20260706-002' AND m.nama_obat = 'Amlodipine 5mg' THEN 30
    WHEN p.no_penjualan = 'TRX-20260706-002' AND m.nama_obat = 'Lansoprazole 30mg' THEN 14
    WHEN p.no_penjualan = 'TRX-20260707-001' AND m.nama_obat = 'Omeprazole' THEN 14
    WHEN p.no_penjualan = 'TRX-20260707-001' AND m.nama_obat = 'Metformin 500mg' THEN 10
    ELSE 0
  END,
  CASE 
    WHEN p.no_penjualan = 'TRX-20260706-001' AND m.nama_obat = 'Paracetamol 500mg' THEN 1500
    WHEN p.no_penjualan = 'TRX-20260706-001' AND m.nama_obat = 'Vitamin B Complex' THEN 6000
    WHEN p.no_penjualan = 'TRX-20260706-002' AND m.nama_obat = 'Amlodipine 5mg' THEN 2500
    WHEN p.no_penjualan = 'TRX-20260706-002' AND m.nama_obat = 'Lansoprazole 30mg' THEN 3500
    WHEN p.no_penjualan = 'TRX-20260707-001' AND m.nama_obat = 'Omeprazole' THEN 1500
    WHEN p.no_penjualan = 'TRX-20260707-001' AND m.nama_obat = 'Metformin 500mg' THEN 1100
    ELSE 0
  END,
  CASE 
    WHEN p.no_penjualan = 'TRX-20260706-001' AND m.nama_obat = 'Paracetamol 500mg' THEN 10*1500
    WHEN p.no_penjualan = 'TRX-20260706-001' AND m.nama_obat = 'Vitamin B Complex' THEN 5*6000
    WHEN p.no_penjualan = 'TRX-20260706-002' AND m.nama_obat = 'Amlodipine 5mg' THEN 30*2500
    WHEN p.no_penjualan = 'TRX-20260706-002' AND m.nama_obat = 'Lansoprazole 30mg' THEN 14*3500
    WHEN p.no_penjualan = 'TRX-20260707-001' AND m.nama_obat = 'Omeprazole' THEN 14*1500
    WHEN p.no_penjualan = 'TRX-20260707-001' AND m.nama_obat = 'Metformin 500mg' THEN 10*1100
    ELSE 0
  END
FROM penjualan p
CROSS JOIN medicines m
WHERE p.no_penjualan IN ('TRX-20260706-001','TRX-20260706-002','TRX-20260707-001')
  AND ((p.no_penjualan = 'TRX-20260706-001' AND m.nama_obat IN ('Paracetamol 500mg','Vitamin B Complex'))
    OR (p.no_penjualan = 'TRX-20260706-002' AND m.nama_obat IN ('Amlodipine 5mg','Lansoprazole 30mg'))
    OR (p.no_penjualan = 'TRX-20260707-001' AND m.nama_obat IN ('Omeprazole','Metformin 500mg')))
ON CONFLICT DO NOTHING;

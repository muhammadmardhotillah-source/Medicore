-- ============================================================
-- MediCore SIMRS — Pembelian (Purchasing) Module
-- Created: 2026-07-06
-- Execute this in Supabase SQL Editor
-- ============================================================

-- 1. TEMPORARY: Run this first if stock_mutations doesn't exist yet
-- CREATE TABLE stock_mutations (...) — from sql/02-stock-mutations.sql

-- 2. Suppliers (Pemasok)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kode TEXT UNIQUE NOT NULL,
    nama_supplier TEXT NOT NULL,
    alamat TEXT,
    no_hp TEXT,
    email TEXT,
    contact_person TEXT,
    status TEXT DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Purchase Orders (Pembelian)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    no_po TEXT UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    tgl_po DATE DEFAULT CURRENT_DATE,
    tgl_jatuh_tempo DATE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'dipesan', 'diterima_sebagian', 'selesai', 'dibatalkan')),
    subtotal INTEGER DEFAULT 0,
    diskon INTEGER DEFAULT 0,
    pajak INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    keterangan TEXT,
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
    medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    harga_satuan INTEGER NOT NULL DEFAULT 0,
    subtotal INTEGER DEFAULT 0,
    qty_diterima INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items(po_id);

-- 6. RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON suppliers FOR ALL TO anon USING (true) WITH CHECK (true);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON purchase_orders FOR ALL TO anon USING (true) WITH CHECK (true);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON purchase_order_items FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON suppliers TO anon;
GRANT ALL ON purchase_orders TO anon;
GRANT ALL ON purchase_order_items TO anon;

-- 7. Seed suppliers
INSERT INTO suppliers (kode, nama_supplier, alamat, no_hp, contact_person) VALUES
('SPL-001', 'PT Kimia Farma Tbk', 'Jl. Veteran No. 9, Jakarta Pusat', '021-3501234', 'Budi Santoso'),
('SPL-002', 'PT Kalbe Farma Tbk', 'Jl. MH Thamrin No. 9, Jakarta Pusat', '021-30421234', 'Dewi Lestari'),
('SPL-003', 'PT Sanbe Farma', 'Jl. Soekarno Hatta No. 189, Bandung', '022-5201234', 'Ahmad Rizki'),
('SPL-004', 'PT Novartis Indonesia', 'Jl. TB Simatupang Kav. 5, Jakarta Selatan', '021-78901234', 'Rina Wijaya'),
('SPL-005', 'PT Dexa Medica', 'Jl. Raya Cimindi No. 123, Cimahi', '022-6654321', 'Hendra Gunawan')
ON CONFLICT (kode) DO NOTHING;

-- ============================================================
-- MediCore SIMRS — Stock Mutations Table
-- Created: 2026-07-06
-- Execute this in Supabase SQL Editor
-- ============================================================

-- 1. Create stock_mutations table
CREATE TABLE IF NOT EXISTS stock_mutations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('masuk', 'keluar', 'opname', 'retur_masuk', 'retur_keluar', 'transfer')),
    qty INTEGER NOT NULL CHECK (qty > 0),
    stok_sebelum INTEGER NOT NULL,
    stok_sesudah INTEGER NOT NULL,
    harga_satuan INTEGER,
    reference TEXT,       -- e.g. PO-001, RES-001, OPN-001
    keterangan TEXT,
    created_by TEXT DEFAULT 'system',  -- bisa diisi user_id atau nama nanti
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stock_mutations_medicine ON stock_mutations(medicine_id);
CREATE INDEX IF NOT EXISTS idx_stock_mutations_type ON stock_mutations(type);
CREATE INDEX IF NOT EXISTS idx_stock_mutations_date ON stock_mutations(created_at DESC);

-- 3. Add stok_akhir column (last known stock) for quick lookup — we'll use medicines.stok
--    But also add a view for convenience
CREATE OR REPLACE VIEW v_stok_saat_ini AS
SELECT
    m.id,
    m.kode,
    m.nama_obat,
    m.kategori,
    m.stok AS stok_saat_ini,
    m.stok_minimum,
    m.satuan,
    m.harga_satuan,
    m.expired_date,
    CASE WHEN m.stok <= m.stok_minimum THEN 'warning'
         WHEN m.stok <= (m.stok_minimum * 0.5) THEN 'danger'
         ELSE 'ok'
    END AS status_stok,
    COALESCE(sm.last_in, m.created_at) AS terakhir_masuk
FROM medicines m
LEFT JOIN LATERAL (
    SELECT MAX(created_at) AS last_in
    FROM stock_mutations sm
    WHERE sm.medicine_id = m.id AND sm.type = 'masuk'
) sm ON true;

-- 4. Auto-update stok via trigger (when mutation is inserted)
CREATE OR REPLACE FUNCTION fn_update_stok_after_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type IN ('masuk', 'retur_masuk') THEN
        UPDATE medicines SET stok = stok + NEW.qty WHERE id = NEW.medicine_id;
    ELSIF NEW.type IN ('keluar', 'retur_keluar') THEN
        UPDATE medicines SET stok = GREATEST(0, stok - NEW.qty) WHERE id = NEW.medicine_id;
    ELSIF NEW.type = 'opname' THEN
        -- For opname, qty = new_stok, and stok_sebelum/stok_sesudah track the delta
        UPDATE medicines SET stok = NEW.stok_sesudah WHERE id = NEW.medicine_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stok ON stock_mutations;
CREATE TRIGGER trg_update_stok
    AFTER INSERT ON stock_mutations
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_stok_after_mutation();

-- 5. RLS: allow anon all for now (same as other tables)
ALTER TABLE stock_mutations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON stock_mutations FOR ALL TO anon USING (true) WITH CHECK (true);

-- 6. Grant usage
GRANT ALL ON stock_mutations TO anon;
GRANT ALL ON v_stok_saat_ini TO anon;

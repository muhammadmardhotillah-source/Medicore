-- =============================================================
-- 09-akuntansi.sql — Accounting Module (COA, Jurnal, Buku Besar)
-- MediCore SIMRS
-- =============================================================

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS akun (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    tipe TEXT NOT NULL CHECK (tipe IN ('Aktiva','Pasiva','Modal','Pendapatan','Beban')),
    saldo_normal TEXT NOT NULL DEFAULT 'Debit' CHECK (saldo_normal IN ('Debit','Kredit')),
    induk_id UUID REFERENCES akun(id),
    aktif BOOLEAN DEFAULT true,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Header
CREATE TABLE IF NOT EXISTS jurnal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_jurnal TEXT NOT NULL UNIQUE,
    tanggal DATE DEFAULT CURRENT_DATE,
    keterangan TEXT,
    dibuat_oleh TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Items (debit/kredit)
CREATE TABLE IF NOT EXISTS jurnal_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurnal_id UUID NOT NULL REFERENCES jurnal(id) ON DELETE CASCADE,
    akun_id UUID NOT NULL REFERENCES akun(id),
    debit NUMERIC DEFAULT 0,
    kredit NUMERIC DEFAULT 0,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE akun ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurnal ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurnal_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_akun" ON akun FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_jurnal" ON jurnal FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_jurnal_item" ON jurnal_item FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed COA
INSERT INTO akun (kode, nama, tipe, saldo_normal) VALUES
('1-000', 'AKTIVA', 'Aktiva', 'Debit'),
  ('1-100', 'Kas', 'Aktiva', 'Debit'),
  ('1-101', 'Bank BCA', 'Aktiva', 'Debit'),
  ('1-200', 'Piutang', 'Aktiva', 'Debit'),
  ('1-300', 'Persediaan Obat', 'Aktiva', 'Debit'),
  ('1-400', 'Aset Tetap', 'Aktiva', 'Debit'),
('2-000', 'PASIVA', 'Pasiva', 'Kredit'),
  ('2-100', 'Utang Dagang', 'Pasiva', 'Kredit'),
  ('2-200', 'Utang Pajak', 'Pasiva', 'Kredit'),
('3-000', 'MODAL', 'Modal', 'Kredit'),
  ('3-100', 'Modal Pemilik', 'Modal', 'Kredit'),
  ('3-200', 'Laba Ditahan', 'Modal', 'Kredit'),
('4-000', 'PENDAPATAN', 'Pendapatan', 'Kredit'),
  ('4-100', 'Pendapatan Rawat Jalan', 'Pendapatan', 'Kredit'),
  ('4-200', 'Pendapatan Rawat Inap', 'Pendapatan', 'Kredit'),
  ('4-300', 'Pendapatan Farmasi', 'Pendapatan', 'Kredit'),
  ('4-400', 'Pendapatan Laboratorium', 'Pendapatan', 'Kredit'),
  ('4-500', 'Pendapatan Radiologi', 'Pendapatan', 'Kredit'),
('5-000', 'BEBAN', 'Beban', 'Debit'),
  ('5-100', 'Beban Gaji', 'Beban', 'Debit'),
  ('5-200', 'Beban Listrik & Air', 'Beban', 'Debit'),
  ('5-300', 'Beban Pembelian Obat', 'Beban', 'Debit'),
  ('5-400', 'Beban Operasional', 'Beban', 'Debit'),
  ('5-500', 'Beban Penyusutan', 'Beban', 'Debit')
ON CONFLICT (kode) DO NOTHING;

-- Seed sample journal
INSERT INTO jurnal (no_jurnal, tanggal, keterangan) VALUES
('JRN-20260701-001', '2026-07-01', 'Pendapatan rawat jalan periode 1 Juli'),
('JRN-20260701-002', '2026-07-01', 'Pembelian obat dari supplier'),
('JRN-20260702-001', '2026-07-02', 'Pembayaran gaji karyawan')
ON CONFLICT (no_jurnal) DO NOTHING;

INSERT INTO jurnal_item (jurnal_id, akun_id, debit, kredit, keterangan)
SELECT j.id, a.id, 
  CASE 
    WHEN j.no_jurnal = 'JRN-20260701-001' AND a.kode = '1-100' THEN 15000000
    WHEN j.no_jurnal = 'JRN-20260701-002' AND a.kode = '5-300' THEN 8000000
    WHEN j.no_jurnal = 'JRN-20260702-001' AND a.kode = '5-100' THEN 25000000
    ELSE 0
  END,
  CASE 
    WHEN j.no_jurnal = 'JRN-20260701-001' AND a.kode = '4-100' THEN 15000000
    WHEN j.no_jurnal = 'JRN-20260701-002' AND a.kode = '2-100' THEN 8000000
    WHEN j.no_jurnal = 'JRN-20260702-001' AND a.kode = '1-100' THEN 25000000
    ELSE 0
  END,
  'Auto seed'
FROM jurnal j
CROSS JOIN akun a
WHERE (j.no_jurnal = 'JRN-20260701-001' AND a.kode IN ('1-100','4-100'))
   OR (j.no_jurnal = 'JRN-20260701-002' AND a.kode IN ('5-300','2-100'))
   OR (j.no_jurnal = 'JRN-20260702-001' AND a.kode IN ('5-100','1-100'))
ON CONFLICT DO NOTHING;

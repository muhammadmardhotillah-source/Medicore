-- =============================================================
-- 04-kas-bank.sql — Kas & Bank Module
-- MediCore SIMRS
-- Execute this in Supabase SQL Editor
-- =============================================================

-- 1. CASH/ACCOUNT MASTER
CREATE TABLE IF NOT EXISTS akun_kas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kode TEXT UNIQUE NOT NULL,
    nama_akun TEXT NOT NULL,
    tipe TEXT NOT NULL CHECK (tipe IN ('kas', 'bank')),
    saldo_awal DECIMAL(15,2) DEFAULT 0,
    nomor_rekening TEXT,
    atas_nama TEXT,
    bank TEXT,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TRANSACTION CATEGORIES
CREATE TABLE IF NOT EXISTS kategori_kas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kode TEXT UNIQUE NOT NULL,
    nama_kategori TEXT NOT NULL,
    tipe TEXT NOT NULL CHECK (tipe IN ('pemasukan', 'pengeluaran')),
    deskripsi TEXT,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRANSACTIONS (cash flow / mutasi)
CREATE TABLE IF NOT EXISTS transaksi_kas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    akun_id UUID REFERENCES akun_kas(id) ON DELETE RESTRICT,
    kategori_id UUID REFERENCES kategori_kas(id) ON DELETE SET NULL,
    tipe TEXT NOT NULL CHECK (tipe IN ('pemasukan', 'pengeluaran', 'transfer')),
    jumlah DECIMAL(15,2) NOT NULL CHECK (jumlah > 0),
    saldo_sebelum DECIMAL(15,2) NOT NULL DEFAULT 0,
    saldo_sesudah DECIMAL(15,2) NOT NULL DEFAULT 0,
    akun_tujuan_id UUID REFERENCES akun_kas(id) ON DELETE RESTRICT,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    keterangan TEXT,
    referensi TEXT,
    dibuat_oleh UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transaksi_kas_akun ON transaksi_kas(akun_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_kas_tanggal ON transaksi_kas(tanggal);
CREATE INDEX IF NOT EXISTS idx_transaksi_kas_tipe ON transaksi_kas(tipe);
CREATE INDEX IF NOT EXISTS idx_akun_kas_aktif ON akun_kas(aktif);

-- Enable RLS
ALTER TABLE akun_kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategori_kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi_kas ENABLE ROW LEVEL SECURITY;

-- Public access (for anon key usage)
CREATE POLICY "Public access" ON akun_kas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON kategori_kas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON transaksi_kas FOR ALL USING (true) WITH CHECK (true);

-- =============================================================
-- SEED DATA
-- =============================================================

-- Akun Kas & Bank
INSERT INTO akun_kas (kode, nama_akun, tipe, saldo_awal, nomor_rekening, atas_nama, bank) VALUES
('KAS-001', 'Kas Kecil', 'kas', 500000, NULL, NULL, NULL),
('KAS-002', 'Bank BCA', 'bank', 50000000, '1234567890', 'Edoy Hospital Management', 'BCA'),
('KAS-003', 'Bank Mandiri', 'bank', 25000000, '0987654321', 'Edoy Hospital Management', 'Mandiri')
ON CONFLICT (kode) DO NOTHING;

-- Kategori Pemasukan
INSERT INTO kategori_kas (kode, nama_kategori, tipe, deskripsi) VALUES
('PM-001', 'Pendaftaran Pasien', 'pemasukan', 'Biaya pendaftaran pasien baru'),
('PM-002', 'Pembayaran Tagihan', 'pemasukan', 'Pembayaran tagihan pasien'),
('PM-003', 'Transfer Masuk', 'pemasukan', 'Transfer antar akun masuk'),
('PM-004', 'Lain-lain Pemasukan', 'pemasukan', 'Pemasukan lainnya')
ON CONFLICT (kode) DO NOTHING;

-- Kategori Pengeluaran
INSERT INTO kategori_kas (kode, nama_kategori, tipe, deskripsi) VALUES
('PG-001', 'Pembelian Obat', 'pengeluaran', 'Pembelian obat dan alat kesehatan'),
('PG-002', 'Gaji Karyawan', 'pengeluaran', 'Pembayaran gaji dan tunjangan'),
('PG-003', 'Operasional', 'pengeluaran', 'Biaya operasional harian'),
('PG-004', 'Utilitas', 'pengeluaran', 'Listrik, air, internet, telepon'),
('PG-005', 'Lain-lain Pengeluaran', 'pengeluaran', 'Pengeluaran lainnya')
ON CONFLICT (kode) DO NOTHING;

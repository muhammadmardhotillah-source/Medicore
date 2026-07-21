-- ============================================================
-- CREATE ALL MISSING TABLES — MediCore SIMRS
-- Execute di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. LABORATORIUM
CREATE TABLE IF NOT EXISTS lab_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_lab TEXT NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patients(id),
    poli_id INTEGER REFERENCES poli(id),
    doctor_id UUID,
    jenis_pemeriksaan TEXT NOT NULL,
    asal TEXT DEFAULT 'RJ', -- RJ/RI/UGD
    catatan TEXT,
    status TEXT DEFAULT 'Menunggu',
    sampel_status TEXT DEFAULT 'Belum',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_request_id UUID NOT NULL REFERENCES lab_requests(id),
    parameter TEXT NOT NULL,
    hasil TEXT,
    nilai_rujukan TEXT,
    satuan TEXT,
    flag TEXT, -- N/T/R (Normal/Tinggi/Rendah)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RADIOLOGI
CREATE TABLE IF NOT EXISTS radiology_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_rad TEXT NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patients(id),
    jenis_pemeriksaan TEXT NOT NULL,
    doctor_id UUID,
    asal TEXT DEFAULT 'RJ',
    catatan_klinis TEXT,
    status TEXT DEFAULT 'Menunggu',
    hasil TEXT,
    kesimpulan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FARMASI — OBAT & RESEP
CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode TEXT NOT NULL UNIQUE,
    nama_obat TEXT NOT NULL,
    kategori TEXT DEFAULT 'Tablet',
    stok INTEGER DEFAULT 0,
    stok_minimum INTEGER DEFAULT 10,
    harga_satuan INTEGER DEFAULT 0,
    satuan TEXT DEFAULT 'tablet',
    expired_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_resep TEXT NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID,
    registration_id UUID REFERENCES registrations(id),
    unit TEXT DEFAULT 'RJ', -- RJ/RI/UGD
    status TEXT DEFAULT 'Menunggu',
    total INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    medicine_id UUID NOT NULL REFERENCES medicines(id),
    jumlah INTEGER DEFAULT 1,
    dosis TEXT,
    harga INTEGER DEFAULT 0,
    subtotal INTEGER DEFAULT 0
);

-- 4. KAMAR OPERASI
CREATE TABLE IF NOT EXISTS surgery_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_operasi TEXT NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patients(id),
    registration_id UUID REFERENCES registrations(id),
    kamar_ok TEXT NOT NULL,
    tindakan TEXT NOT NULL,
    klasifikasi TEXT DEFAULT 'Elektif',
    dokter_operator TEXT,
    dokter_anastesi TEXT,
    diagnosa TEXT,
    status TEXT DEFAULT 'Menunggu',
    waktu_mulai TIMESTAMPTZ,
    waktu_selesai TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. KASIR & PEMBAYARAN
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_reg TEXT NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id),
    registration_id UUID REFERENCES registrations(id),
    penjamin TEXT DEFAULT 'Umum',
    total_tagihan INTEGER DEFAULT 0,
    metode TEXT, -- Tunai/Transfer/QRIS/BPJS
    status TEXT DEFAULT 'Belum Bayar',
    bayar INTEGER DEFAULT 0,
    kembalian INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TAGIHAN / INVOICE
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_tagihan TEXT NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patients(id),
    penjamin TEXT DEFAULT 'BPJS',
    total INTEGER DEFAULT 0,
    terbayar INTEGER DEFAULT 0,
    sisa INTEGER GENERATED ALWAYS AS (total - terbayar) STORED,
    status TEXT DEFAULT 'Belum Bayar',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEED DATA — LAB
INSERT INTO lab_requests (no_lab, patient_id, poli_id, jenis_pemeriksaan, asal, status, sampel_status) 
SELECT 'LAB-240517-001', p.id, 15, 'Darah Lengkap, GDS', 'RJ', 'Selesai', 'Diambil'
FROM patients p WHERE p.nama = 'Ahmad Fauzi' LIMIT 1;

INSERT INTO lab_requests (no_lab, patient_id, poli_id, jenis_pemeriksaan, asal, status, sampel_status) 
SELECT 'LAB-240517-002', p.id, 17, 'Darah Lengkap, SGOT/SGPT', 'RI', 'Diproses', 'Diambil'
FROM patients p WHERE p.nama = 'Siti Rahayu' LIMIT 1;

INSERT INTO lab_requests (no_lab, patient_id, poli_id, jenis_pemeriksaan, asal, status, sampel_status) 
SELECT 'LAB-240517-003', p.id, 16, 'Widal, DL', 'RI', 'Menunggu', 'Belum'
FROM patients p WHERE p.nama = 'Hendra Kusuma' LIMIT 1;

INSERT INTO lab_requests (no_lab, patient_id, jenis_pemeriksaan, asal, status, sampel_status) 
SELECT 'LAB-240517-004', p.id, 'HbA1c, Kolesterol', 'Rujukan', 'Menunggu', 'Belum'
FROM patients p WHERE p.nama = 'Budi Santoso' LIMIT 1;

-- SEED DATA — RADIOLOGI
INSERT INTO radiology_requests (no_rad, patient_id, jenis_pemeriksaan, asal, status) 
SELECT 'RAD-001', p.id, 'Rontgen Thorax AP', 'UGD', 'Hasil Siap'
FROM patients p WHERE p.nama = 'Dewi Lestari' LIMIT 1;

INSERT INTO radiology_requests (no_rad, patient_id, jenis_pemeriksaan, asal, status) 
SELECT 'RAD-002', p.id, 'EKG + Rontgen Thorax', 'RJ', 'Diproses'
FROM patients p WHERE p.nama = 'Rudi Hartono' LIMIT 1;

INSERT INTO radiology_requests (no_rad, patient_id, jenis_pemeriksaan, asal, status) 
SELECT 'RAD-003', p.id, 'USG Abdomen', 'RI', 'Menunggu'
FROM patients p WHERE p.nama = 'Joko Widodo' LIMIT 1;

-- SEED DATA — OBAT
INSERT INTO medicines (kode, nama_obat, kategori, stok, stok_minimum, harga_satuan, expired_date) VALUES
('OBT-001', 'Amlodipine 5mg', 'Tablet', 240, 50, 850, '2027-12-31'),
('OBT-002', 'Metformin 500mg', 'Tablet', 380, 100, 420, '2027-06-30'),
('OBT-003', 'Bisoprolol 5mg', 'Tablet', 42, 50, 1200, '2027-03-31'),
('OBT-004', 'Furosemide inj 10mg', 'Injeksi', 8, 20, 4500, '2026-09-30'),
('OBT-005', 'Omeprazole 20mg', 'Kapsul', 520, 100, 680, '2027-11-30'),
('OBT-006', 'Ceftriaxone inj 1gr', 'Injeksi', 45, 20, 28000, '2026-08-31'),
('OBT-007', 'Paracetamol 500mg', 'Tablet', 1000, 200, 250, '2028-01-31'),
('OBT-008', 'IVFD RL 500ml', 'Infus', 120, 30, 12000, '2027-10-31');

-- SEED DATA — RESEP (pastikan ada registrasi untuk pasien)
INSERT INTO prescriptions (no_resep, patient_id, unit, status, total)
SELECT 'RX-240517-001', p.id, 'RJ', 'Siap Ambil', 79400
FROM patients p WHERE p.nama = 'Rumiah Ny' LIMIT 1;

INSERT INTO prescription_items (prescription_id, medicine_id, jumlah, dosis, harga, subtotal)
SELECT pr.id, m.id, 1, '1x1', 1200, 1200
FROM prescriptions pr, medicines m
WHERE pr.no_resep = 'RX-240517-001' AND m.kode = 'OBT-003';

INSERT INTO prescription_items (prescription_id, medicine_id, jumlah, dosis, harga, subtotal)
SELECT pr.id, m.id, 30, '1x1', 250, 7500
FROM prescriptions pr, medicines m
WHERE pr.no_resep = 'RX-240517-001' AND m.kode = 'OBT-007';

-- SEED DATA — KASIR & TAGIHAN
INSERT INTO payments (no_reg, patient_id, penjamin, total_tagihan, metode, status, bayar, kembalian)
SELECT '974188', p.id, 'Umum', 174400, 'Tunai', 'Lunas', 200000, 25600
FROM patients p WHERE p.nama = 'Rumiah Ny' LIMIT 1;

INSERT INTO payments (no_reg, patient_id, penjamin, total_tagihan, metode, status)
SELECT '974185', p.id, 'BPJS', 0, 'BPJS', 'Lunas'
FROM patients p WHERE p.nama = 'Dewi Lestari' LIMIT 1;

INSERT INTO invoices (no_tagihan, patient_id, penjamin, total, terbayar, status)
SELECT 'TAG-2605-001', p.id, 'BPJS', 450000, 0, 'Belum Bayar'
FROM patients p WHERE p.nama = 'Ahmad Fauzi' LIMIT 1;

INSERT INTO invoices (no_tagihan, patient_id, penjamin, total, terbayar, status)
SELECT 'TAG-2605-002', p.id, 'BPJS', 2800000, 0, 'Klaim Pending'
FROM patients p WHERE p.nama = 'Siti Rahayu' LIMIT 1;

INSERT INTO invoices (no_tagihan, patient_id, penjamin, total, terbayar, status)
SELECT 'TAG-2604-089', p.id, 'Admedika', 1200000, 1200000, 'Lunas'
FROM patients p WHERE p.nama = 'Ny. Kartini' LIMIT 1;

-- SEED DATA — KAMAR OPERASI
INSERT INTO surgery_schedule (no_operasi, patient_id, kamar_ok, tindakan, klasifikasi, dokter_operator, diagnosa, status, waktu_mulai, waktu_selesai) 
SELECT 'OK-240517-001', p.id, 'OK 2', 'Appendektomi', 'Elektif Mayor', 'Dr. Zainuri Miltas, Sp.OG', 'G83A2 H 38 MOG BSC 2X', 'Selesai', '2026-05-17 07:00', '2026-05-17 08:30'
FROM patients p WHERE p.nama = 'Joko Widodo' LIMIT 1;

INSERT INTO surgery_schedule (no_operasi, patient_id, kamar_ok, tindakan, klasifikasi, dokter_operator, diagnosa, status, waktu_mulai)
SELECT 'OK-240517-002', p.id, 'OK 3', 'SC (Sectio Caesarea)', 'Elektif Mayor', 'Dr. Budi Hartono, Sp.OG', 'gll p2 a0 34mg bsc 2x', 'Berjalan', '2026-05-17 10:00'
FROM patients p WHERE p.nama = 'Siti Rahayu' LIMIT 1;

INSERT INTO surgery_schedule (no_operasi, patient_id, kamar_ok, tindakan, klasifikasi, dokter_operator, diagnosa, status, waktu_mulai)
SELECT 'OK-240517-003', p.id, 'OK 1', 'Laparotomi', 'Cito Mayor', 'Dr. Ahmad Yani, Sp.B', 'Ileus Obstruksi', 'Menunggu', '2026-05-17 13:00'
FROM patients p WHERE p.nama = 'Budi Santoso' LIMIT 1;

-- Enable RLS for new tables
ALTER TABLE lab_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Allow anon access for all new tables
CREATE POLICY "anon_all" ON lab_requests FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON lab_results FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON radiology_requests FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON medicines FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON prescriptions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON prescription_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON surgery_schedule FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON payments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON invoices FOR ALL TO anon USING (true) WITH CHECK (true);

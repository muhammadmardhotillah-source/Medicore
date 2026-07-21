-- Master Data: MediCore SIMRS
-- Execute di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. TARIF TINDAKAN
CREATE TABLE IF NOT EXISTS master_tarif (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_tarif TEXT NOT NULL UNIQUE,
    nama_tindakan TEXT NOT NULL,
    kategori TEXT DEFAULT 'Tindakan',
    harga INTEGER DEFAULT 0,
    poli_id INTEGER REFERENCES poli(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ICD-10
CREATE TABLE IF NOT EXISTS icd10 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_icd TEXT NOT NULL UNIQUE,
    nama_penyakit TEXT NOT NULL,
    kategori TEXT DEFAULT 'Lainnya',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. KATEGORI OBAT
CREATE TABLE IF NOT EXISTS kategori_obat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kategori TEXT NOT NULL UNIQUE,
    deskripsi TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE master_tarif ENABLE ROW LEVEL SECURITY;
ALTER TABLE icd10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategori_obat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON master_tarif FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON icd10 FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON kategori_obat FOR ALL TO anon USING (true) WITH CHECK (true);

-- ===== SEED DATA =====

-- ICD-10
INSERT INTO icd10 (kode_icd, nama_penyakit, kategori) VALUES
('I10', 'Essential (primary) hypertension', 'Kardiovaskular'),
('I11', 'Hypertensive heart disease', 'Kardiovaskular'),
('I20', 'Angina pectoris', 'Kardiovaskular'),
('I21', 'Acute myocardial infarction', 'Kardiovaskular'),
('I25', 'Chronic ischaemic heart disease', 'Kardiovaskular'),
('I50', 'Heart failure', 'Kardiovaskular'),
('J15', 'Bacterial pneumonia, not elsewhere classified', 'Respirasi'),
('J18', 'Pneumonia, organism unspecified', 'Respirasi'),
('J45', 'Asthma', 'Respirasi'),
('E11', 'Type 2 diabetes mellitus', 'Endokrin'),
('E14', 'Unspecified diabetes mellitus', 'Endokrin'),
('N18', 'Chronic kidney disease', 'Nefrologi'),
('N20', 'Calculus of kidney and ureter', 'Nefrologi'),
('K29', 'Gastritis and duodenitis', 'Gastroenterologi'),
('K35', 'Acute appendicitis', 'Gastroenterologi'),
('K40', 'Inguinal hernia', 'Gastroenterologi'),
('M54', 'Dorsalgia (back pain)', 'Muskuloskeletal'),
('M17', 'Gonarthrosis [arthrosis of knee]', 'Muskuloskeletal'),
('O80', 'Single spontaneous delivery', 'Kebidanan'),
('O82', 'Delivery by caesarean section', 'Kebidanan'),
('P07', 'Disorders related to short gestation and low birth weight', 'Perinatologi'),
('R50', 'Fever of unknown origin', 'Umum'),
('R51', 'Headache', 'Umum'),
('R10', 'Abdominal and pelvic pain', 'Umum')
ON CONFLICT (kode_icd) DO NOTHING;

-- Kategori Obat
INSERT INTO kategori_obat (nama_kategori, deskripsi) VALUES
('Tablet', 'Obat padat dalam bentuk tablet'),
('Kapsul', 'Obat dalam bentuk kapsul'),
('Sirup', 'Obat cair oral'),
('Injeksi', 'Obat suntik'),
('Infus', 'Cairan infus'),
('Salep', 'Obat oles topikal'),
('Tetes', 'Obat tetes (mata/telinga)'),
('Inhaler', 'Obat hirup'),
('Suppositoria', 'Obat melalui dubur')
ON CONFLICT (nama_kategori) DO NOTHING;

-- Tarif Tindakan
INSERT INTO master_tarif (kode_tarif, nama_tindakan, kategori, harga) VALUES
('TD-001', 'Pemeriksaan Dokter Umum', 'Konsultasi', 150000),
('TD-002', 'Pemeriksaan Dokter Spesialis', 'Konsultasi', 250000),
('TD-003', 'Konsultasi Gizi', 'Konsultasi', 75000),
('TD-004', 'Fisioterapi', 'Tindakan', 100000),
('TD-005', 'EKG', 'Diagnostik', 120000),
('TD-006', 'USG Abdomen', 'Diagnostik', 350000),
('TD-007', 'Rontgen Thorax', 'Diagnostik', 150000),
('TD-008', 'CT Scan Kepala', 'Diagnostik', 850000),
('TD-009', 'Darah Lengkap', 'Laboratorium', 90000),
('TD-010', 'GDS (Gula Darah Sewaktu)', 'Laboratorium', 25000),
('TD-011', 'SGOT/SGPT', 'Laboratorium', 55000),
('TD-012', 'Kolesterol Total', 'Laboratorium', 40000),
('TD-013', 'HbA1c', 'Laboratorium', 120000),
('TD-014', 'Urine Lengkap', 'Laboratorium', 35000),
('TD-015', 'Jahit Luka (5 jahitan)', 'Tindakan', 200000),
('TD-016', 'Bersih Luka', 'Tindakan', 75000),
('TD-017', 'Pasang Infus', 'Tindakan', 50000),
('TD-018', 'Injeksi IM/IV', 'Tindakan', 30000),
('TD-019', 'Nebulizer', 'Tindakan', 60000),
('TD-020', 'Rawat Inap Kelas 1/hari', 'Rawat Inap', 350000),
('TD-021', 'Rawat Inap Kelas 2/hari', 'Rawat Inap', 250000),
('TD-022', 'Rawat Inap Kelas 3/hari', 'Rawat Inap', 150000),
('TD-023', 'ICU/hari', 'Rawat Inap', 1200000),
('TD-024', 'Operasi Appendektomi', 'Operasi', 2500000),
('TD-025', 'Operasi SC', 'Operasi', 4500000),
('TD-026', 'Operasi Hernia', 'Operasi', 3000000),
('TD-027', 'Operasi Laparotomi', 'Operasi', 5000000)
ON CONFLICT (kode_tarif) DO NOTHING;

-- ============================================
-- MediCore SIMRS — Seed Data
-- ============================================

-- 1️⃣ POLI
INSERT INTO poli (nama_poli) VALUES
  ('Umum'),
  ('Anak'),
  ('Jantung'),
  ('Penyakit Dalam'),
  ('Kandungan'),
  ('Bedah Umum'),
  ('Mata'),
  ('THT'),
  ('Paru'),
  ('Gigi'),
  ('Urologi'),
  ('Rehabilitasi Medik')
ON CONFLICT DO NOTHING;

-- 2️⃣ DOKTER
INSERT INTO doctors (nama_dokter, poli_id, jadwal_praktik) 
SELECT 'Dr. Taka Mehi, Sp.JP', id, '13:00–15:00'
FROM poli WHERE nama_poli = 'Jantung'
UNION ALL
SELECT 'Dr. Siti Rahmawati, Sp.PD', id, '08:00–12:00'
FROM poli WHERE nama_poli = 'Penyakit Dalam'
UNION ALL
SELECT 'Dr. Budi Hartono, Sp.OG', id, '09:00–13:00'
FROM poli WHERE nama_poli = 'Kandungan'
UNION ALL
SELECT 'Dr. Ahmad Yani, Sp.B', id, '10:00–14:00'
FROM poli WHERE nama_poli = 'Bedah Umum'
UNION ALL
SELECT 'Dr. Andi Saputra, Sp.An', id, '08:00–16:00 (Shift)'
FROM poli WHERE nama_poli = 'Anak'
UNION ALL
SELECT 'Dr. Yuni Pratiwi, Sp.PD', id, '07:00–14:00'
FROM poli WHERE nama_poli = 'Penyakit Dalam'
UNION ALL
SELECT 'Dr. Zainuri Miltas, Sp.OG', id, 'Jadwal Operasi'
FROM poli WHERE nama_poli = 'Kandungan'
ON CONFLICT DO NOTHING;

-- 3️⃣ PASIEN (sample)
INSERT INTO patients (no_rm, nama, nik, jk, tgl_lahir, alamat, no_hp, agama)
VALUES 
  ('009001461', 'Rumiah Ny', '3602123456780001', 'P', '1958-06-02', 'Jl. Raya Cilegon KM 08, Kramatwatu, Kab. Serang, Banten', '085939004395', 'Islam'),
  ('009002317', 'Ahmad Fauzi', '3602123456780002', 'L', '1981-03-15', 'Jl. Veteran No. 45, Kota Serang, Banten', '081234567890', 'Islam'),
  ('009003882', 'Siti Rahayu', '3602123456780003', 'P', '1994-08-22', 'Perumahan Graha Asri Blok A.5 No. 12, Serang', '087812345678', 'Islam'),
  ('009004115', 'Budi Santoso', '3602123456780004', 'L', '1973-11-30', 'Jl. Raya Jakarta KM 05, Cikupa, Tangerang', '082134567890', 'Kristen'),
  ('009004290', 'Dewi Lestari', '3602123456780005', 'P', '1998-01-10', 'Komp. Bumi Indah No. 8, Cilegon', '085612345678', 'Islam'),
  ('009004301', 'Hendra Kusuma', '3602123456780006', 'L', '1989-07-05', 'Jl. Sultan Agung No. 23, Serang', '081398765432', 'Islam'),
  ('009004412', 'Rudi Hartono', '3602123456780007', 'L', '1975-05-20', 'Perum Puri Cendana Blok C.3, Serang', '087765432198', 'Kristen'),
  ('009004523', 'Joko Widodo', '3602123456780008', 'L', '1955-02-17', 'Jl. Pemuda No. 1, Kota Serang', '081111223344', 'Islam')
ON CONFLICT DO NOTHING;

-- 4️⃣ REGISTRATIONS (kunjungan hari ini)
INSERT INTO registrations (patient_id, poli_id, penjamin, status, no_antrian, loket_id, created_at)
SELECT 
  p.id,
  pol.id,
  'Umum',
  'Selesai',
  'T-45',
  'qa1',
  NOW() - INTERVAL '2 hours'
FROM patients p, poli pol
WHERE p.no_rm = '009001461' AND pol.nama_poli = 'Jantung'

UNION ALL
SELECT p.id, pol.id, 'BPJS', 'Menunggu', 'T-46', 'qa2', NOW() - INTERVAL '1 hour'
FROM patients p, poli pol
WHERE p.no_rm = '009002317' AND pol.nama_poli = 'Penyakit Dalam'

UNION ALL
SELECT p.id, pol.id, 'BPJS', 'Proses', 'T-47', 'qa2', NOW() - INTERVAL '30 minutes'
FROM patients p, poli pol
WHERE p.no_rm = '009003882' AND pol.nama_poli = 'Kandungan'

UNION ALL
SELECT p.id, pol.id, 'Asuransi', 'Menunggu', 'T-48', 'qa3', NOW() - INTERVAL '15 minutes'
FROM patients p, poli pol
WHERE p.no_rm = '009004115' AND pol.nama_poli = 'Bedah Umum'

UNION ALL
SELECT p.id, NULL, 'BPJS', 'URGENT', 'UGD', NULL, NOW() - INTERVAL '10 minutes'
FROM patients p
WHERE p.no_rm = '009004290';

-- 5️⃣ BEDS (tempat tidur)
INSERT INTO beds (nomor, kelas, status) VALUES
  ('ICU-1', 'ICU', 'Terpakai'),
  ('ICU-2', 'ICU', 'Tersedia'),
  ('ICU-3', 'ICU', 'Tersedia'),
  ('217A', 'K-3', 'Tersedia'),
  ('217B', 'K-3', 'Terpakai'),
  ('217C', 'K-3', 'Tersedia'),
  ('217D', 'K-3', 'Terpakai'),
  ('220A', 'K-3', 'Reservasi'),
  ('220B', 'K-3', 'Tersedia'),
  ('220C', 'K-3', 'Tersedia'),
  ('222A', 'K-3', 'Tersedia'),
  ('222B', 'K-3', 'Terpakai'),
  ('222C', 'K-3', 'Terpakai'),
  ('222D', 'K-3', 'Terpakai'),
  ('103A', 'K-2', 'Terpakai'),
  ('103B', 'K-2', 'Tersedia'),
  ('103C', 'K-2', 'Terpakai'),
  ('104A', 'K-2', 'Tersedia'),
  ('104B', 'K-2', 'Reservasi'),
  ('105A', 'K-2', 'Terpakai'),
  ('105B', 'K-2', 'Tersedia'),
  ('105C', 'K-2', 'Terpakai'),
  ('106A', 'K-2', 'Terpakai'),
  ('106B', 'K-2', 'Tersedia'),
  ('101A', 'K-1', 'Tersedia'),
  ('101B', 'K-1', 'Terpakai'),
  ('102A', 'K-1', 'Tersedia'),
  ('102B', 'K-1', 'Terpakai'),
  ('VIP-1', 'VIP', 'Tersedia'),
  ('VIP-2', 'VIP', 'Terpakai')
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFIKASI
-- ============================================
SELECT 'poli' as tbl, COUNT(*) FROM poli
UNION ALL
SELECT 'doctors', COUNT(*) FROM doctors
UNION ALL
SELECT 'patients', COUNT(*) FROM patients
UNION ALL
SELECT 'registrations', COUNT(*) FROM registrations
UNION ALL
SELECT 'beds', COUNT(*) FROM beds;

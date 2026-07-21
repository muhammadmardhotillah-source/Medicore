-- ============================================
-- MediCore SIMRS — Seed Data Tambahan
-- ============================================

-- 1️⃣ RAWAT INAP (registrasi opname)
INSERT INTO registrations (patient_id, poli_id, penjamin, status, no_antrian, loket_id, created_at)
SELECT p.id, pol.id, 'Umum', 'Opname', 'RI-001', NULL, NOW() - INTERVAL '3 days'
FROM patients p, poli pol
WHERE p.no_rm = '009001461' AND pol.nama_poli = 'Jantung'
UNION ALL
SELECT p.id, pol.id, 'BPJS', 'Opname', 'RI-002', NULL, NOW() - INTERVAL '2 days'
FROM patients p, poli pol
WHERE p.no_rm = '009002317' AND pol.nama_poli = 'Penyakit Dalam'
UNION ALL
SELECT p.id, pol.id, 'BPJS', 'Opname', 'RI-003', NULL, NOW() - INTERVAL '1 day'
FROM patients p, poli pol
WHERE p.no_rm = '009003882' AND pol.nama_poli = 'Kandungan'
UNION ALL
SELECT p.id, pol.id, 'Asuransi', 'Opname', 'RI-004', NULL, NOW() - INTERVAL '2 days'
FROM patients p, poli pol
WHERE p.no_rm = '009004115' AND pol.nama_poli = 'Bedah Umum'
UNION ALL
SELECT p.id, pol.id, 'BPJS', 'Opname', 'RI-005', NULL, NOW() - INTERVAL '3 days'
FROM patients p, poli pol
WHERE p.no_rm = '009004301' AND pol.nama_poli = 'Penyakit Dalam';

-- 2️⃣ ANTRIAN LOKET (sedang dilayani)
-- Hapus registrasi calling lama kalo ada
UPDATE registrations SET status = 'Selesai' WHERE status = 'calling';

INSERT INTO registrations (patient_id, poli_id, penjamin, status, no_antrian, loket_id, created_at)
SELECT p.id, NULL::int, 'Umum', 'calling', 'A-47', 'qa1', NOW() - INTERVAL '5 minutes'
FROM patients p WHERE p.no_rm = '009001461'
UNION ALL
SELECT p.id, NULL::int, 'BPJS', 'calling', 'B-23', 'qa2', NOW() - INTERVAL '3 minutes'
FROM patients p WHERE p.no_rm = '009002317'
UNION ALL
SELECT p.id, NULL::int, 'Asuransi', 'calling', 'C-11', 'qa3', NOW() - INTERVAL '2 minutes'
FROM patients p WHERE p.no_rm = '009004115';

-- 3️⃣ TAMBAH KUNJUNGAN RAWAT JALAN (biar angka real)
INSERT INTO registrations (patient_id, poli_id, penjamin, status, no_antrian, created_at)
SELECT p.id, pol.id, 'Umum', 'Selesai', 'T-01', NOW() - INTERVAL '5 hours'
FROM patients p, poli pol
WHERE p.no_rm = '009001461' AND pol.nama_poli = 'Jantung'
UNION ALL
SELECT p.id, pol.id, 'BPJS', 'Selesai', 'T-02', NOW() - INTERVAL '4 hours'
FROM patients p, poli pol
WHERE p.no_rm = '009002317' AND pol.nama_poli = 'Penyakit Dalam'
UNION ALL
SELECT p.id, pol.id, 'BPJS', 'Selesai', 'T-03', NOW() - INTERVAL '4 hours'
FROM patients p, poli pol
WHERE p.no_rm = '009003882' AND pol.nama_poli = 'Kandungan'
UNION ALL
SELECT p.id, pol.id, 'Asuransi', 'Selesai', 'T-04', NOW() - INTERVAL '3 hours'
FROM patients p, poli pol
WHERE p.no_rm = '009004115' AND pol.nama_poli = 'Bedah Umum'
UNION ALL
SELECT p.id, pol.id, 'Umum', 'Menunggu', 'T-05', NOW() - INTERVAL '2 hours'
FROM patients p, poli pol
WHERE p.no_rm = '009004301' AND pol.nama_poli = 'Jantung';

-- 4️⃣ CEK HASIL
SELECT 'Total Registrasi' as info, COUNT(*) FROM registrations
UNION ALL
SELECT 'Rawat Jalan (aktif)', COUNT(*) FROM registrations WHERE poli_id IS NOT NULL AND status NOT IN ('Selesai','Opname')
UNION ALL
SELECT 'Rawat Inap', COUNT(*) FROM registrations WHERE status = 'Opname'
UNION ALL
SELECT 'UGD', COUNT(*) FROM registrations WHERE poli_id IS NULL AND status NOT IN ('Selesai','Opname','calling')
UNION ALL
SELECT 'Antrian Calling', COUNT(*) FROM registrations WHERE status = 'calling';

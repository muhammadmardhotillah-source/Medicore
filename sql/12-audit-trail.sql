-- =============================================================
-- 12-audit-trail.sql — Activity Audit Trail Module
-- MediCore SIMRS
-- =============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_name TEXT NOT NULL DEFAULT 'System',
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    entity_name TEXT,
    detail TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_audit_logs" ON audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed audit logs (sample historical data)
INSERT INTO audit_logs (user_name, action, entity_type, entity_name, detail, created_at) VALUES
('Admin RS', 'Login', 'User', 'Admin RS', 'Login ke sistem', NOW() - INTERVAL '2 hours'),
('Admin RS', 'Buat Registrasi', 'Pasien', 'Budi Santoso', 'Registrasi pasien baru - RM: 009004115', NOW() - INTERVAL '1 hour'),
('Admin RS', 'Buat Penjualan', 'Transaksi', 'TRX-20260707-001', 'Penjualan tunai Rp 150.000', NOW() - INTERVAL '45 minutes'),
('Admin RS', 'Tambah Stok', 'Obat', 'Paracetamol 500mg', 'Tambah stok: +200 dari Pembelian PO-001', NOW() - INTERVAL '30 minutes'),
('Admin RS', 'Proses Permintaan', 'Permintaan Medis', 'PM-20260707-001', 'Proses permintaan Rawat Inap', NOW() - INTERVAL '20 minutes'),
('Admin RS', 'Buat Jurnal', 'Akuntansi', 'JRN-20260707-001', 'Jurnal penyesuaian kas', NOW() - INTERVAL '15 minutes'),
('Admin RS', 'Input Hasil Lab', 'Laboratorium', 'L-09', 'Input hasil lab pasien', NOW() - INTERVAL '10 minutes'),
('Admin RS', 'Update Stok', 'Logistik', 'Kertas A4', 'Mutasi masuk: +10 rim', NOW() - INTERVAL '5 minutes');

-- =============================================================
-- 10-security.sql — Security: Role-Based Access Control Matrix
-- MediCore SIMRS
-- =============================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(module, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    allowed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_roles" ON roles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_permissions" ON permissions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_role_permissions" ON role_permissions FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed roles
INSERT INTO roles (name, description) VALUES
('Administrator', 'Full access to all modules and settings'),
('Dokter', 'Access to medical records, prescriptions, and patient data'),
('Perawat', 'Access to nursing tasks, vital signs, and patient care'),
('Farmasi', 'Access to pharmacy: medicines, prescriptions, inventory'),
('Kasir', 'Access to billing, payments, and cashier functions'),
('Laboratorium', 'Access to lab tests, results, and samples'),
('Radiologi', 'Access to radiology exams and results'),
('Manajemen', 'Read-only access to reports and analytics')
ON CONFLICT (name) DO NOTHING;

-- Seed permissions for each module in the system
INSERT INTO permissions (module, action, description) VALUES
('Dashboard', 'view', 'Melihat dashboard utama'),
('Registrasi', 'create', 'Mendaftarkan pasien baru'),
('Registrasi', 'view', 'Melihat data registrasi'),
('Poli', 'view', 'Melihat antrian poli'),
('Poli', 'process', 'Memproses pasien poli'),
('Rawat Inap', 'view', 'Melihat rawat inap'),
('Rawat Inap', 'manage', 'Mengelola rawat inap (admit/discharge)'),
('UGD', 'view', 'Melihat antrian UGD'),
('UGD', 'process', 'Menangani pasien UGD'),
('Rekam Medis', 'view', 'Melihat rekam medis'),
('Rekam Medis', 'write', 'Menulis rekam medis'),
('Laboratorium', 'view', 'Melihat data lab'),
('Laboratorium', 'input', 'Input hasil laboratorium'),
('Radiologi', 'view', 'Melihat data radiologi'),
('Radiologi', 'input', 'Input hasil radiologi'),
('Farmasi', 'view', 'Melihat data farmasi'),
('Farmasi', 'dispense', 'Menyiapkan / dispensing obat'),
('Kasir', 'view', 'Melihat transaksi kasir'),
('Kasir', 'payment', 'Memproses pembayaran'),
('Tagihan', 'view', 'Melihat tagihan'),
('Laporan', 'view', 'Melihat laporan keuangan'),
('Master Data', 'manage', 'Mengelola master data'),
('Stok', 'view', 'Melihat stok inventory'),
('Stok', 'manage', 'Mengelola stok (mutasi, opname)'),
('Pembelian', 'view', 'Melihat pembelian'),
('Pembelian', 'create', 'Membuat PO / pembelian'),
('Kas & Bank', 'view', 'Melihat transaksi kas & bank'),
('Kas & Bank', 'manage', 'Mengelola transaksi kas & bank'),
('Penjualan', 'view', 'Melihat penjualan'),
('Penjualan', 'create', 'Mencatat penjualan'),
('Permintaan Medis', 'view', 'Melihat permintaan medis'),
('Permintaan Medis', 'process', 'Memproses permintaan medis'),
('Logistik', 'view', 'Melihat logistik'),
('Logistik', 'manage', 'Mengelola logistik'),
('Akuntansi', 'view', 'Melihat akuntansi'),
('Akuntansi', 'manage', 'Mengelola jurnal akuntansi'),
('SDM', 'view', 'Melihat data SDM'),
('SDM', 'manage', 'Mengelola data SDM & jadwal'),
('Pengaturan', 'manage', 'Mengelola pengaturan sistem'),
('Security', 'manage', 'Mengelola role & permission')
ON CONFLICT (module, action) DO NOTHING;

-- Grant all permissions to Administrator
INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Administrator'
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;

-- Specific role permissions
INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'Dokter' AND p.module IN ('Dashboard','Registrasi','Poli','Rawat Inap','UGD','Rekam Medis','Farmasi','Laboratorium','Radiologi','Permintaan Medis') AND p.action IN ('view','write','process','input','dispense')
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'Perawat' AND p.module IN ('Dashboard','Registrasi','Rawat Inap','UGD','Rekam Medis') AND p.action IN ('view')
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'Farmasi' AND p.module IN ('Dashboard','Farmasi','Stok','Pembelian','Permintaan Medis','Penggunaan Obat','Logistik') AND p.action IN ('view','dispense','process','manage')
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'Kasir' AND p.module IN ('Dashboard','Kasir','Tagihan','Penjualan','Kas & Bank')
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'Laboratorium' AND p.module IN ('Dashboard','Laboratorium')
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'Radiologi' AND p.module IN ('Dashboard','Radiologi')
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;

INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'Manajemen' AND p.module IN ('Dashboard','Laporan','Akuntansi') AND p.action IN ('view')
ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = true;

-- ===== TABEL USERS / AKUN KARYAWAN =====
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL DEFAULT '123456',
  nama TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Petugas',
  unit TEXT DEFAULT 'Semua',
  status TEXT DEFAULT 'Aktif',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default users
INSERT INTO users (username, password, nama, role, unit) VALUES
  ('admin', '123456', 'Admin RS', 'Administrator', 'Semua'),
  ('kasir01', '123456', 'Sari Dewi', 'Kasir', 'Kasir'),
  ('farmasi01', '123456', 'Budi Santoso', 'Apoteker', 'Farmasi'),
  ('pendaftaran01', '123456', 'Rini Yuliani', 'Petugas', 'Pendaftaran')
ON CONFLICT (username) DO NOTHING;

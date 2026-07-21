-- Tambah kolom biaya untuk operasi
ALTER TABLE surgery_schedule ADD COLUMN IF NOT EXISTS biaya INTEGER DEFAULT 0;

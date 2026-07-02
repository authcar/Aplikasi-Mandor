-- Run these in your Supabase SQL editor

-- 1. Registry of all supervisors who have ever submitted a report
--    Populated automatically when a report is saved.
CREATE TABLE IF NOT EXISTS supervisor_registry (
  chat_id    TEXT PRIMARY KEY,
  nama       TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Daily checkin — one row per supervisor per day when they submit a report
CREATE TABLE IF NOT EXISTS checkin_harian (
  chat_id TEXT NOT NULL,
  tanggal DATE NOT NULL,
  PRIMARY KEY (chat_id, tanggal)
);

-- Allow anon reads/writes (same as your other tables)
ALTER TABLE supervisor_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all" ON supervisor_registry FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE checkin_harian ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon all" ON checkin_harian FOR ALL TO anon USING (true) WITH CHECK (true);

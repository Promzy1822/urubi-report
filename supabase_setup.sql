-- ============================================================
-- Urubi Group Report System — Supabase Setup
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

DROP TABLE IF EXISTS service_entries;

CREATE TABLE service_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  district TEXT NOT NULL,
  service_date DATE NOT NULL,
  service_day TEXT NOT NULL CHECK (service_day IN ('sunday','monday','thursday')),
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  week_of_month INTEGER NOT NULL,

  -- HCF (Sunday only)
  hcf_count INTEGER DEFAULT 0,
  hcf_present INTEGER DEFAULT 0,
  hcf_new_comers INTEGER DEFAULT 0,

  -- Attendance
  adult_men INTEGER DEFAULT 0,
  adult_women INTEGER DEFAULT 0,
  youth_boys INTEGER DEFAULT 0,
  youth_girls INTEGER DEFAULT 0,
  children_boys INTEGER DEFAULT 0,
  children_girls INTEGER DEFAULT 0,

  -- Offerings
  tithes_offering INTEGER DEFAULT 0,
  special_offering INTEGER DEFAULT 0,

  -- Meta
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(district, service_date)
);

ALTER TABLE service_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read all" ON service_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert" ON service_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update" ON service_entries FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- USER ACCOUNTS (run in Supabase Auth → Users)
-- Set Raw User Meta Data for each user:
--
-- Pastor:   { "role": "admin",    "district": "" }
-- OWOSENI:  { "role": "district", "district": "OWOSENI" }
-- IHOGBE:   { "role": "district", "district": "IHOGBE" }
-- IBIWE:    { "role": "district", "district": "IBIWE" }
-- MERCY:    { "role": "district", "district": "MERCY" }
-- OROEGHENE:{ "role": "district", "district": "OROEGHENE" }
--
-- Or use this SQL to update existing users:
-- UPDATE auth.users SET raw_user_meta_data = '{"role":"admin","district":""}'
--   WHERE email = 'pastor@dlbc.com';
-- ============================================================

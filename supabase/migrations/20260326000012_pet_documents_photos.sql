-- Pet Documents
CREATE TABLE IF NOT EXISTS pet_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Lain-lain',
  date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pet_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own pet_documents" ON pet_documents;
CREATE POLICY "Users manage own pet_documents" ON pet_documents
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Pet Photos
CREATE TABLE IF NOT EXISTS pet_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pet_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own pet_photos" ON pet_photos;
CREATE POLICY "Users manage own pet_photos" ON pet_photos
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Health records RLS (if not already set)
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own health_records" ON health_records;
CREATE POLICY "Users manage own health_records" ON health_records
  FOR ALL USING (
    EXISTS (SELECT 1 FROM pets WHERE pets.id = health_records.pet_id AND pets.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM pets WHERE pets.id = health_records.pet_id AND pets.user_id = auth.uid())
  );

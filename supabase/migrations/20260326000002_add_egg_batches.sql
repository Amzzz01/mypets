CREATE TABLE egg_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_number int NOT NULL,
  egg_count int NOT NULL,
  start_date date NOT NULL,
  hatched_count int DEFAULT 0,
  status text DEFAULT 'incubating' CHECK (status IN ('incubating','hatched','failed')),
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE egg_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own egg_batches" ON egg_batches
  FOR ALL USING (auth.uid() = user_id);

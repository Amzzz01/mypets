CREATE TABLE show_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  location text,
  date date NOT NULL,
  award text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE show_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own show_records" ON show_records
  FOR ALL USING (auth.uid() = user_id);

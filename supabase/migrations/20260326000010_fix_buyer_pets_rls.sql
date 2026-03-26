ALTER TABLE buyer_pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own buyer_pets" ON buyer_pets;
CREATE POLICY "Users manage own buyer_pets" ON buyer_pets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM buyers
      WHERE buyers.id = buyer_pets.buyer_id
        AND buyers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buyers
      WHERE buyers.id = buyer_pets.buyer_id
        AND buyers.user_id = auth.uid()
    )
  );

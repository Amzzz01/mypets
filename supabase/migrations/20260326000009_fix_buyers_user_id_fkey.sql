ALTER TABLE buyers DROP CONSTRAINT IF EXISTS buyers_user_id_fkey;
ALTER TABLE buyers ADD CONSTRAINT buyers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_user_id_fkey;
ALTER TABLE pets ADD CONSTRAINT pets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

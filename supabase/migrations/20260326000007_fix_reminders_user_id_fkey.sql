ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_user_id_fkey;
ALTER TABLE reminders ADD CONSTRAINT reminders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

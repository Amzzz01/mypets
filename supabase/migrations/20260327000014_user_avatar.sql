-- Add avatar_url to users profile table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create a public storage bucket for user profile avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/update/delete their own avatar
DROP POLICY IF EXISTS "Users manage own avatar" ON storage.objects;
CREATE POLICY "Users manage own avatar" ON storage.objects
  FOR ALL TO authenticated
  USING  (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

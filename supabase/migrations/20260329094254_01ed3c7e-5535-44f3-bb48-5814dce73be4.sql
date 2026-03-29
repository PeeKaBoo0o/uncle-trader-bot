-- Create storage bucket for AI-generated news images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('news-images', 'news-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read news images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'news-images');

-- Allow service role to upload
CREATE POLICY "Service role upload news images" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'news-images');
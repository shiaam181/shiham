-- Create table for anti-replay challenge tokens
CREATE TABLE public.attendance_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_challenges ENABLE ROW LEVEL SECURITY;

-- Users can only read their own unexpired, unused challenges
CREATE POLICY "Users can read their own challenges"
ON public.attendance_challenges
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert challenges for themselves (via edge function with service role)
CREATE POLICY "Service role can manage challenges"
ON public.attendance_challenges
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for token lookups
CREATE INDEX idx_attendance_challenges_token ON public.attendance_challenges(token);
CREATE INDEX idx_attendance_challenges_user_expires ON public.attendance_challenges(user_id, expires_at);

-- Create table for multi-image face registration
CREATE TABLE public.face_reference_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_path TEXT NOT NULL,
  embedding JSONB,
  quality_score DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.face_reference_images ENABLE ROW LEVEL SECURITY;

-- Users can read their own face references
CREATE POLICY "Users can read their own face references"
ON public.face_reference_images
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for user lookups
CREATE INDEX idx_face_reference_images_user ON public.face_reference_images(user_id, is_active);

-- Add columns to attendance table for enhanced tracking
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS challenge_token TEXT,
ADD COLUMN IF NOT EXISTS gps_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS face_confidence DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'local';

-- Cleanup function for expired challenges (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.attendance_challenges
  WHERE expires_at < now() - interval '1 hour';
END;
$$;
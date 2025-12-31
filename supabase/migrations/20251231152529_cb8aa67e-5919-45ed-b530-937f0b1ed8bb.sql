-- Add face_embedding column to store face feature vectors
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS face_embedding JSONB;
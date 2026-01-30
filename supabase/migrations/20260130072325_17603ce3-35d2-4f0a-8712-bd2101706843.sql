-- Add unique constraint on phone number (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique 
ON public.profiles (phone) 
WHERE phone IS NOT NULL AND phone != '';

-- Add comment for documentation
COMMENT ON INDEX profiles_phone_unique IS 'Ensures each phone number can only be registered once';
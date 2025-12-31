-- Create trigger to handle new user signup if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also add an RLS policy to allow anonymous users to check if a phone exists (for login flow)
CREATE POLICY "Anyone can check phone existence"
ON public.profiles
FOR SELECT
USING (true);
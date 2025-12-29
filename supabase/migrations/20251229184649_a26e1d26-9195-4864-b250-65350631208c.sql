-- Allow developers to view all profiles for role management
CREATE POLICY "Developers can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (is_developer());
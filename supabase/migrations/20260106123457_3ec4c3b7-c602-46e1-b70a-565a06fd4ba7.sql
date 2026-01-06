-- Create notification_prefs table to store read/dismissed notification IDs per user
CREATE TABLE public.notification_prefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_id TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_id)
);

-- Enable RLS
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notification prefs
CREATE POLICY "Users can view own notification prefs"
ON public.notification_prefs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own notification prefs
CREATE POLICY "Users can insert own notification prefs"
ON public.notification_prefs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own notification prefs
CREATE POLICY "Users can update own notification prefs"
ON public.notification_prefs
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notification prefs
CREATE POLICY "Users can delete own notification prefs"
ON public.notification_prefs
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_notification_prefs_updated_at
BEFORE UPDATE ON public.notification_prefs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
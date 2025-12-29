-- Add overtime_minutes column to attendance table
ALTER TABLE public.attendance ADD COLUMN overtime_minutes INTEGER DEFAULT 0;

-- Enable realtime for leave_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
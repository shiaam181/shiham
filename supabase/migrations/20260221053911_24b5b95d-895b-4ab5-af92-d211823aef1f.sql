-- Add secondary brand color to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS brand_color_secondary text DEFAULT '#64748b';

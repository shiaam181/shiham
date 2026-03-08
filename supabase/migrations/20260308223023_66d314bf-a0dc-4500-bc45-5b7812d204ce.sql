-- Add company-level toggle for separate payroll team role
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS separate_payroll_team_enabled boolean NOT NULL DEFAULT false;
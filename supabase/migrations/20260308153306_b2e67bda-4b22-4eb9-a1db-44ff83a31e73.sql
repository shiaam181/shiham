
ALTER TABLE public.companies 
  ADD COLUMN mood_pulse_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN team_board_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN command_palette_enabled boolean NOT NULL DEFAULT false;

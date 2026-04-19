-- Add progress tracking for the Rosary (Terço)
ALTER TABLE public.user_progress 
ADD COLUMN IF NOT EXISTS last_step_started_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN public.user_progress.last_step_started_at IS 'Data/hora em que o passo atual do terço foi iniciado para controlar o bloqueio de áudio.';

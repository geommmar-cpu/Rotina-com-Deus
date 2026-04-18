-- Adiciona coluna para controle de data da última leitura bíblica
-- Isso evita que o dia avance se o usuário ler mais de uma vez no mesmo dia.
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS bible_last_read_at TIMESTAMPTZ;

-- Tabela para rastrear mensagens já processadas e evitar duplicidade (Idempotência)
CREATE TABLE IF NOT EXISTS public.processed_messages (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index para limpeza periódica se necessário
CREATE INDEX IF NOT EXISTS idx_processed_messages_created_at ON public.processed_messages(created_at);

-- Política de RLS
ALTER TABLE public.processed_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Serviço pode fazer tudo" ON public.processed_messages FOR ALL USING (true);

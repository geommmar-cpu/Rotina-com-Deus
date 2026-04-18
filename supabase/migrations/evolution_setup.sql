-- ═══════════════════════════════════════════════════
-- EVOLUTION API - Tabela de Instâncias + Health Check
-- Rode este SQL no Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. TABELA DE INSTÂNCIAS (Gerenciamento de números)
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_name TEXT NOT NULL UNIQUE,
    phone_number TEXT NOT NULL,
    api_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    status TEXT DEFAULT 'standby' CHECK (status IN ('active', 'standby', 'blocked', 'disconnected')),
    is_primary BOOLEAN DEFAULT false,
    last_health_check TIMESTAMPTZ,
    connected_at TIMESTAMPTZ,
    blocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Serviço gerencia instâncias" ON public.whatsapp_instances FOR ALL TO service_role USING (true);

-- 2. INSERIR INSTÂNCIA PRINCIPAL (atualizar com dados reais após setup)
INSERT INTO public.whatsapp_instances (instance_name, phone_number, api_url, api_key, status, is_primary)
VALUES (
    'rotina-principal',
    '5561999220401',
    'https://evo.rotinacomdeus.online',
    'SUA_API_KEY_AQUI',
    'active',
    true
) ON CONFLICT (instance_name) DO UPDATE SET
    api_url = EXCLUDED.api_url,
    api_key = EXCLUDED.api_key;

-- 3. CRON: Health Check a cada 5 minutos
SELECT cron.schedule(
    'health-check-evolution',
    '*/5 * * * *',
    $$
    SELECT net.http_get(
        url := 'https://oyakfsvettzcwterqgom.supabase.co/functions/v1/whatsapp-health',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWtmc3ZldHR6Y3d0ZXJxZ29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4NzI4NywiZXhwIjoyMDg5ODYzMjg3fQ.8DLWZcjPiIVHCVifX3LEnb-zA5Cj-P7XOz5vAU_tWpA"}'
    );
    $$
);

-- 4. ADICIONAR CAMPOS DE SUBSCRIPTION NA TABELA whatsapp_users (se não existir)
ALTER TABLE public.whatsapp_users 
    ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'expired',
    ADD COLUMN IF NOT EXISTS subscription_valid_until TIMESTAMPTZ;

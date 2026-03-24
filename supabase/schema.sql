-- ═══════════════════════════════════════════════════════════════
-- ROTINA COM DEUS - SETUP SCRIPT (SUPABASE)
-- ═══════════════════════════════════════════════════════════════

-- 1. CONFIGURAÇÃO DE USUÁRIOS DO WHATSAPP
CREATE TABLE IF NOT EXISTS public.whatsapp_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL UNIQUE, -- Formato E.164 (ex: 556193984169)
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, phone_number)
);

ALTER TABLE public.whatsapp_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Serviço gerencia usuários whatsapp" ON public.whatsapp_users FOR ALL TO service_role USING (true);

-- 2. PREFERÊNCIAS DO USUÁRIO
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_user_id UUID NOT NULL REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
    prayer_habit TEXT, -- 'Sim', 'Não', 'Quero melhorar'
    morning_notification_time TIME DEFAULT '07:00:00',
    noon_notification_time TIME DEFAULT '12:00:00',
    night_notification_time TIME DEFAULT '21:00:00',
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Serviço gerencia preferências" ON public.user_preferences FOR ALL TO service_role USING (true);

-- 3. PROGRESSO DO USUÁRIO
CREATE TABLE IF NOT EXISTS public.user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_user_id UUID NOT NULL REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
    bible_365_day INTEGER DEFAULT 1,
    current_novena TEXT,
    novena_day INTEGER DEFAULT 0,
    last_interaction_at TIMESTAMPTZ DEFAULT now(),
    last_prayer_type TEXT, -- 'Rosário', 'Ângelus', 'São José', 'Exame'
    last_prayer_step INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Serviço gerencia progresso" ON public.user_progress FOR ALL TO service_role USING (true);

-- 4. CACHE DE LITURGIA DIÁRIA
CREATE TABLE IF NOT EXISTS public.liturgy_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    title TEXT,
    readings JSONB,
    reflection TEXT,
    saint_of_the_day TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.liturgy_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Serviço gerencia liturgia" ON public.liturgy_cache FOR ALL TO service_role USING (true);

-- 5. LOGS DE INTERAÇÃO
CREATE TABLE IF NOT EXISTS public.interaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_user_id UUID REFERENCES public.whatsapp_users(id) ON DELETE SET NULL,
    phone_number TEXT,
    message_type TEXT, -- 'text', 'audio', 'button'
    raw_message TEXT,
    ai_response TEXT,
    intent TEXT, -- 'onboarding', 'prayer', 'liturgy', 'audio_intention'
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interaction_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Serviço gerencia logs" ON public.interaction_logs FOR ALL TO service_role USING (true);

-- 6. STATUS DE ASSINATURA (Extensão da tabela profiles)
-- Supõe-se que a tabela public.profiles já existe (padrão Supabase/Saldin)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('active', 'trial', 'expired', 'cancelled')),
        ADD COLUMN IF NOT EXISTS subscription_valid_until TIMESTAMPTZ DEFAULT (now() + interval '7 days');
    END IF;
END $$;

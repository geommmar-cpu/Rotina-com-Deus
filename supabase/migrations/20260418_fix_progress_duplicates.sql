-- Limpeza de duplicados na tabela user_progress (mantém apenas o registro mais recente por usuário)
DELETE FROM public.user_progress a
USING public.user_progress b
WHERE a.id < b.id 
  AND a.whatsapp_user_id = b.whatsapp_user_id;

-- Adiciona restrição de unicidade para evitar futuras duplicatas que confundam o bot
ALTER TABLE public.user_progress
ADD CONSTRAINT unique_whatsapp_user_progress UNIQUE (whatsapp_user_id);

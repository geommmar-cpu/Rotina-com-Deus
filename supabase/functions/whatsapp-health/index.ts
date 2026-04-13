import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════
// HEALTH CHECK + AUTO-FAILOVER
// Roda a cada 5 minutos via pg_cron
// ═══════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function checkInstanceHealth(instance: any): Promise<string> {
  try {
    const url = `${instance.api_url}/instance/connectionState/${instance.instance_name}`;
    const response = await fetch(url, {
      headers: { "apikey": instance.api_key }
    });

    if (!response.ok) return "error";

    const data = await response.json();
    const state = data.instance?.state || data.state || "unknown";
    console.log(`[HEALTH] ${instance.instance_name}: ${state}`);
    return state;
  } catch (err: any) {
    console.error(`[HEALTH] Erro ao checar ${instance.instance_name}:`, err.message);
    return "error";
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Buscar todas as instâncias
    const { data: instances, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .order("is_primary", { ascending: false });

    if (error || !instances?.length) {
      console.error("[HEALTH] Nenhuma instância encontrada:", error?.message);
      return new Response("Nenhuma instância configurada", { status: 200, headers: corsHeaders });
    }

    const results: any[] = [];
    let primaryOk = false;
    let primaryInstance = instances.find((i: any) => i.is_primary);

    // 2. Checar saúde de cada instância
    for (const instance of instances) {
      const state = await checkInstanceHealth(instance);
      const isConnected = state === "open" || state === "connected";

      // Atualizar status no banco
      const newStatus = isConnected ? "active" : (state === "close" ? "disconnected" : "blocked");
      await supabase.from("whatsapp_instances").update({
        status: newStatus,
        last_health_check: new Date().toISOString()
      }).eq("id", instance.id);

      if (instance.is_primary && isConnected) {
        primaryOk = true;
      }

      results.push({
        name: instance.instance_name,
        phone: instance.phone_number,
        state,
        is_primary: instance.is_primary,
        status: newStatus
      });
    }

    // 3. AUTO-FAILOVER: Se a primária caiu, ativar a backup
    if (!primaryOk && primaryInstance) {
      console.warn(`🚨 [HEALTH] Instância primária '${primaryInstance.instance_name}' está OFFLINE!`);

      // Buscar backup ativa
      const backup = instances.find((i: any) => !i.is_primary);
      
      if (backup) {
        const backupState = await checkInstanceHealth(backup);
        const backupOk = backupState === "open" || backupState === "connected";

        if (backupOk) {
          console.log(`🔄 [HEALTH] Ativando failover para '${backup.instance_name}'...`);

          // Desativar primária atual
          await supabase.from("whatsapp_instances").update({ 
            is_primary: false 
          }).eq("id", primaryInstance.id);

          // Ativar backup como nova primária
          await supabase.from("whatsapp_instances").update({ 
            is_primary: true,
            status: "active"
          }).eq("id", backup.id);

          // Notificar admin via a instância backup
          const adminPhone = "5561991149453";
          try {
            const alertBody = {
              number: adminPhone,
              text: `🚨 *ALERTA ROTINA COM DEUS*\n\nO número principal (${primaryInstance.phone_number}) ficou OFFLINE.\n\n✅ Failover automático ativado!\nAgora usando: ${backup.phone_number}\n\nVerifique o número original e reconecte quando possível.`
            };

            await fetch(`${backup.api_url}/message/sendText/${backup.instance_name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": backup.api_key },
              body: JSON.stringify(alertBody)
            });
          } catch (e) {
            console.error("[HEALTH] Falha ao notificar admin:", e);
          }

          results.push({ action: "FAILOVER_ACTIVATED", from: primaryInstance.instance_name, to: backup.instance_name });
        } else {
          console.error(`🔥 [HEALTH] CRÍTICO: Primária e backup estão OFFLINE!`);
          results.push({ action: "ALL_OFFLINE", message: "Nenhuma instância disponível!" });
        }
      }
    }

    return new Response(JSON.stringify({ 
      timestamp: new Date().toISOString(),
      primary_ok: primaryOk,
      instances: results 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error("[HEALTH] Erro geral:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

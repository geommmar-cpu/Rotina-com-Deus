import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { whatsappService } from "../whatsapp-webhook/services/whatsapp-service.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-simulator',
};

const ROUTINES: any = {
  morning: {
    text: "Bom dia 🙏\n\nQue Deus abençoe o seu dia.\nAntes de começar suas atividades, vamos entregar este dia nas mãos de Deus.\nRespire fundo... E diga no seu coração:\n\n*Senhor, guia meus passos hoje. Me dá sabedoria, paciência e paz. Que tudo o que eu fizer hoje seja para o bem.*\n\nAmém.",
    audioUrl: "http://localhost:5173/audios/bom_dia.mp3",
    buttons: ["Amém 🙏", "Menu Principal"]
  },
  noon: {
    text: "🕛 O Anjo do Senhor anunciou a Maria... E ela concebeu do Espírito Santo.\n\nAve Maria, cheia de graça...\n\n(Acompanhe o Ângelus completo no áudio guiado abaixo) 🙏",
    audioUrl: "http://localhost:5173/audios/Ângelus.mp3",
    buttons: ["Amém 🙏", "Menu Principal"]
  },
  night: {
    text: "Boa noite 🌙\n\nVamos encerrar o seu dia com Deus.\nRespire fundo... Agora pense no seu dia...\n\nVocê foi paciente? Ajudou alguém? Teve momentos de irritação? Peça perdão a Deus pelas suas falhas... E agradeça pelas coisas boas.\n\n*Senhor, obrigado por este dia. Perdoa minhas falhas e me ajuda a ser melhor amanhã. Amém.*",
    audioUrl: "http://localhost:5173/audios/oracao_noite.mp3",
    buttons: ["Amém 🙏", "Exame Guiado Passo a Passo"]
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const routineType = url.searchParams.get("type") as "morning" | "noon" | "night";

    if (!routineType || !ROUTINES[routineType]) {
      return new Response("Parâmetro 'type' inválido. Use ?type=morning, noon ou night.", { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const isSimulator = req.headers.get("x-simulator") === "true";
    if (isSimulator) {
      whatsappService.isSimulator = true;
      whatsappService.simulatorMessages = [];
    }

    // 1. Obter todos os usuários ativos
    const { data: users, error: userError } = await supabase
      .from("whatsapp_users")
      .select("*, user_preferences(*)");

    if (userError) throw userError;

    let sentCount = 0;
    const intentName = `routine_${routineType}`;
    const today = new Date().toISOString().split("T")[0]; // Data atual YYYY-MM-DD

    for (const user of (users || [])) {
      // Regra 1: O usuário precisa estar ativo (se preferência existir, verifica se quer notificação)
      const prefs = user.user_preferences?.[0];
      if (prefs && prefs.notifications_enabled === false) {
        continue;
      }

      // Regra 2: Evitar repetir mensagem no mesmo dia!
      const { data: logs } = await supabase
        .from("interaction_logs")
        .select("id")
        .eq("whatsapp_user_id", user.id)
        .eq("intent", intentName)
        .gte("created_at", `${today}T00:00:00.000Z`)
        .limit(1);

      if (logs && logs.length > 0) {
        // Já recebeu esta rotina hoje, pula pro próximo usuário
        continue;
      }

      // 3. Preparar a mensagem
      const routineMsg = ROUTINES[routineType];
      
      await whatsappService.sendText({
        number: user.phone_number,
        text: routineMsg.text
      });

      if (routineMsg.audioUrl) {
        await whatsappService.sendAudio({ number: user.phone_number, audioUrl: routineMsg.audioUrl });
      }

      await whatsappService.sendButtons({
        number: user.phone_number,
        text: "Escolha uma opção:",
        buttons: routineMsg.buttons.map((b: string) => ({ displayText: b }))
      });

      // 4. Registrar no log de interações para não enviar novamente
      await supabase.from("interaction_logs").insert({
        whatsapp_user_id: user.id,
        phone_number: user.phone_number,
        message_type: "routine_auto",
        raw_message: `DISPARO CRON: ${routineType}`,
        ai_response: routineMsg.text,
        intent: intentName
      });

      sentCount++;
    }

    // Retorna a resposta adequada para o simulador ou requisição direta
    if (isSimulator) {
      return new Response(JSON.stringify({ 
        message: `Sucesso! Rotina '${routineType}' disparada para ${sentCount} usuários novos.`,
        messages: whatsappService.simulatorMessages 
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(`Sucesso! Rotina '${routineType}' disparada para ${sentCount} usuários.`, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error("Erro no cron:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { whatsappService } from "../whatsapp-webhook/services/whatsapp-service.ts";
import { getBible365Content } from "../whatsapp-webhook/services/bible-service.ts";
import { getDailyLiturgy } from "../whatsapp-webhook/services/liturgy-service.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-simulator',
};

const ROUTINES: any = {
  morning: {
    title: "O PRIMEIRO PENSAMENTO",
    subtitle: "MANHÃ 07:00",
    text: "Bom dia 🙏\n\nQue Deus abençoe o seu dia.\nAntes de começar suas atividades, vamos entregar este dia nas mãos de Deus.\nRespire fundo... E diga no seu coração:\n\n*Senhor, guia meus passos hoje. Me dá sabedoria, paciência e paz. Que tudo o que eu fizer hoje seja para o bem.*\n\nAmém.",
    audioUrl: "https://rotina-com-deus.vercel.app/audios/bom_dia.mp3",
    buttons: ["Amém 🙏", "Menu Principal"]
  },
  noon: {
    title: "PAUSA PARA O CÉU",
    subtitle: "MEIO-DIA 12:00",
    text: "🕛 O Anjo do Senhor anunciou a Maria... E ela concebeu do Espírito Santo.\n\nAve Maria, cheia de graça...\n\n(Acompanhe o Ângelus completo no áudio guiado abaixo) 🙏",
    audioUrl: "https://rotina-com-deus.vercel.app/audios/angelus.mp3",
    buttons: ["Amém 🙏", "Menu Principal"]
  },
  night: {
    title: "EXAME DE CONSCIÊNCIA",
    subtitle: "NOITE 21:00",
    text: "Boa noite 🌙\n\nVamos encerrar o seu dia com Deus.\nRespire fundo... Agora pense no seu dia...\n\nVocê foi paciente? Ajudou alguém? Teve momentos de irritação? Peça perdão a Deus pelas suas falhas... E agradeça pelas coisas boas.\n\n*Senhor, obrigado por este dia. Perdoa minhas falhas e me ajuda a ser melhor amanhã. Amém.*",
    audioUrl: "https://rotina-com-deus.vercel.app/audios/exame_consciencia.mp3",
    buttons: ["Amém 🙏", "Menu Principal"]
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

    // 1. Obter todos os usuários ativos com progresso
    const { data: users, error: userError } = await supabase
      .from("whatsapp_users")
      .select("*, user_preferences(*), user_progress(*)");

    if (userError) throw userError;

    let sentCount = 0;
    const intentName = `routine_${routineType}`;
    const today = new Date().toISOString().split("T")[0]; // Data atual YYYY-MM-DD
    const AUDIO_BASE_URL = Deno.env.get("AUDIO_BASE_URL") || "https://rotina-com-deus.vercel.app/audios/";
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
        continue;
      }

      // 3. Preparar a mensagem
      const routineMsg = ROUTINES[routineType];
      const prodAudioUrl = routineMsg.audioUrl;
      
      // Enviar Cabeçalho e Texto Inicial
      const headerText = `✨ *${routineMsg.title}*\n_${routineMsg.subtitle}_\n\n${routineMsg.text}`;
      await whatsappService.sendText({
        number: user.phone_number,
        text: headerText
      });
      await sleep(1000);

      // Enviar Áudio Principal se houver
      if (routineMsg.audioUrl) {
        await whatsappService.sendAudio({ number: user.phone_number, audioUrl: prodAudioUrl });
        await sleep(1500);
      }

      // Se for de Manhã, enviar Oferecimento do Dia também
      if (routineType === "morning") {
        await whatsappService.sendAudio({ number: user.phone_number, audioUrl: "https://rotina-com-deus.vercel.app/audios/oferecimento_dia.mp3" });
        await sleep(1500);
      }

      // SE FOR DE MANHÃ -> Enviar Liturgia + Bíblia 365 + Lembretes Especiais
      if (routineType === "morning") {
        // 1. Enviar Liturgia
        const liturgy = await getDailyLiturgy();
        if (liturgy) {
          const liturgyText = `📖 *LITURGIA DE HOJE*\n\n*${liturgy.title}*\n\n${liturgy.reflection}\n\n😇 *Santo do Dia:* ${liturgy.saint}`;
          await whatsappService.sendText({ number: user.phone_number, text: liturgyText });
          await sleep(1500);
        }

        // 2. Enviar Bíblia 365
        const userProg = user.user_progress?.[0];
        const nextBibleDay = (userProg?.bible_365_day || 0) + 1;
        const bibleContent = await getBible365Content(nextBibleDay);

        if (bibleContent) {
          await whatsappService.sendText({
            number: user.phone_number,
            text: bibleContent
          });
          await sleep(1500);

          // Atualiza progresso da Bíblia
          const progId = userProg?.id;
          if (progId) {
            await supabase.from("user_progress").update({ bible_365_day: nextBibleDay }).eq("id", progId);
          } else {
            await supabase.from("user_progress").insert({ whatsapp_user_id: user.id, bible_365_day: nextBibleDay });
          }
        }

        // 3. Lembretes de Datas Especiais (Quaresma de São Miguel)
        const miguelStart = new Date(`${new Date().getFullYear()}-08-15`);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        miguelStart.setHours(0, 0, 0, 0);
        
        const diffTime = miguelStart.getTime() - todayDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 7) {
          await whatsappService.sendText({ number: user.phone_number, text: "🔔 *Lembrete:* A Quaresma de São Miguel começa em uma semana (15 de agosto)! Prepare seu coração. 🙏" });
          await sleep(1000);
        } else if (diffDays === 1) {
          await whatsappService.sendText({ number: user.phone_number, text: "⚔️ *Prepare-se:* É amanhã! A Quaresma de São Miguel começa neste dia 15 de agosto. Esteja pronto para a batalha espiritual! 🙏" });
          await sleep(1000);
        } else if (diffDays === 0) {
          await whatsappService.sendText({ number: user.phone_number, text: "🗡️ *Hoje Começamos!* A Quaresma de São Miguel se inicia hoje. Que o Arcanjo nos proteja em nossa jornada de fé! ✨" });
          await sleep(1000);
        }
      }

      // Enviar Botões de Navegação
      await whatsappService.sendButtons({
        number: user.phone_number,
        text: "Como posso te ajudar agora? 🙏",
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

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
    buttons: ["Amém 🙏"]
  },
  noon: {
    title: "PAUSA PARA O CÉU",
    subtitle: "MEIO-DIA 12:00",
    text: "🕛 O Anjo do Senhor anunciou a Maria... E ela concebeu do Espírito Santo.\n\nAve Maria, cheia de graça...\n\n(Acompanhe o Ângelus completo no áudio guiado abaixo) 🙏",
    audioUrl: "https://rotina-com-deus.vercel.app/audios/angelus.mp3",
    buttons: ["Amém 🙏"]
  },
  night: {
    title: "EXAME DE CONSCIÊNCIA",
    subtitle: "NOITE 21:00",
    text: "Boa noite 🌙\n\nVamos encerrar o seu dia com Deus.\nRespire fundo... Agora pense no seu dia...\n\nVocê foi paciente? Ajudou alguém? Teve momentos de irritação? Peça perdão a Deus pelas suas falhas... E agradeça pelas coisas boas.\n\n*Senhor, obrigado por este dia. Perdoa minhas falhas e me ajuda a ser melhor amanhã. Amém.*",
    audioUrl: "https://rotina-com-deus.vercel.app/audios/exame_consciencia.mp3",
    buttons: ["Amém 🙏"]
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const routineType = url.searchParams.get("type") as "morning" | "noon" | "night";
    const force = url.searchParams.get("force") === "true";

    console.log(`[CRON] Recebido disparo: Tipo = ${routineType}`);

    if (!routineType || !ROUTINES[routineType]) {
      console.error(`[CRON] Erro: Tipo de rotina '${routineType}' inválido.`);
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

    if (userError) {
      console.error("[CRON] Erro ao buscar usuários:", userError);
      throw userError;
    }

    console.log(`[CRON] Processando ${users?.length || 0} usuários para a rotina ${routineType}.`);

    let sentCount = 0;
    const intentName = `routine_${routineType}`;
    const nowBRT = new Date(new Date().getTime() - 3 * 3600 * 1000);
    const todayBRT = nowBRT.toISOString().split("T")[0];
    const logStartWindow = `${todayBRT}T03:00:00.000Z`; // UTC-3 (00:00 BRT de hoje)
    const AUDIO_BASE_URL = Deno.env.get("AUDIO_BASE_URL") || "https://rotina-com-deus.vercel.app/audios/";
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const user of (users || [])) {
      // Regra 0: Whitelist de Administradores (Sempre recebem)
      // Normaliza para 12 dígitos (remove o 9° dígito) para comparação segura
      const normalizePhone = (p: string) => {
        const c = p.replace(/\D/g, "");
        return (c.startsWith("55") && c.length === 13) ? c.slice(0, 4) + c.slice(5) : c;
      };
      const adminWhitelist = ["556198416939", "5561939841693", "5561984585912", "5561999220401", "5561995773473"];
      const userNorm = normalizePhone(user.phone_number);
      const isSpecialAdmin = adminWhitelist.some(adm => normalizePhone(adm) === userNorm);

      // Regra 1: Verificação de Assinatura (Somente se não for Admin)
      const isSubscriptionActive = user.subscription_status === "active" || user.subscription_status === "trial";
      
      // Carência: Damos 3 dias (72 horas) de margem geral para evitar cortes por atraso no webhook ou cartão
      const nowForCheck = new Date(new Date().getTime() - 72 * 3600 * 1000);
      const isValidUntil = user.subscription_valid_until ? new Date(user.subscription_valid_until) > nowForCheck : false;

      if (!isSpecialAdmin && (!isSubscriptionActive || !isValidUntil)) {
        console.log(`[CRON] 🚫 Pulando ${user.phone_number}: Status ${user.subscription_status || 'vazio'} | Válido até ${user.subscription_valid_until || 'nunca'}`);
        continue;
      }

      // Regra 2: O usuário precisa estar ativo (se preferência existir, verifica se quer notificação)
      const prefs = user.user_preferences?.[0];
      if (prefs && prefs.notifications_enabled === false) {
        continue;
      }

      // Regra 2: Evitar repetir mensagem no mesmo dia (Fuso Brasília) - Janela a partir de 03:00 UTC
      const { data: logs } = await supabase
        .from("interaction_logs")
        .select("id")
        .eq("whatsapp_user_id", user.id)
        .eq("intent", intentName)
        .gte("created_at", logStartWindow)
        .limit(1);

      if (!force && logs && logs.length > 0) {
        console.log(`[CRON] ⏭️ Ignorando ${user.phone_number}: Já enviada hoje (${todayBRT} desde 03:00 UTC).`);
        continue;
      }

      if (force) {
        console.log(`[CRON] MODO FORÇADO: Enviando rotina ${routineType} para ${user.phone_number} ignorando logs.`);
      } else {
        console.log(`[CRON] Enviando rotina ${routineType} para ${user.phone_number}...`);
      }

      // 3. Preparar a mensagem
      const routineMsg = ROUTINES[routineType];
      const prodAudioUrl = routineMsg.audioUrl;
      
      // Enviar Cabeçalho e Texto (Evolution API = sem janela de 24h!)
      const headerText = `✨ *${routineMsg.title}*\n_${routineMsg.subtitle}_\n\n${routineMsg.text}`;
      await whatsappService.sendText({ number: user.phone_number, text: headerText });
      await sleep(2000);

      // Enviar Áudio Principal
      if (routineMsg.audioUrl) {
        await whatsappService.sendAudio({ number: user.phone_number, audioUrl: prodAudioUrl });
        await sleep(3000); // Espera o áudio ser processado pelo servidor
      }

      // Se for de Manhã, enviar Oferecimento do Dia também
      if (routineType === "morning") {
        await whatsappService.sendAudio({ number: user.phone_number, audioUrl: "https://rotina-com-deus.vercel.app/audios/oferecimento_dia.mp3" });
        await sleep(3000);
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
        const nextBibleDay = (user.bible_day || 0) + 1;
        const bibleContent = await getBible365Content(nextBibleDay);

        if (bibleContent) {
          await whatsappService.sendText({
            number: user.phone_number,
            text: bibleContent
          });
          await sleep(1500);

          // Atualiza progresso da Bíblia diretamente no usuário (Single Source of Truth)
          await supabase
            .from("whatsapp_users")
            .update({ bible_day: nextBibleDay })
            .eq("id", user.id);
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

      // Mensagem de Conclusão por Texto (Infalível)
      await whatsappService.sendText({
        number: user.phone_number,
        text: "👉 *DIGITE 0* - Para ver o Menu Principal"
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

      console.log(`[CRON] Sucesso para ${user.phone_number}`);

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

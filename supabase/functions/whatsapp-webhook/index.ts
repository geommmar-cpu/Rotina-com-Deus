import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateSpiritualResponse, generatePersonalizedPrayer, generateSpecialPeriodDay } from "./services/ai-service.ts";
import { getOnboardingFlow, getNextRosaryStep, getMysteryOfDay, PRAYERS } from "./services/prayer-service.ts";
import { getDailyLiturgy } from "./services/liturgy-service.ts";
import { getBible365Content } from "./services/bible-service.ts";
import { whatsappService } from "./services/whatsapp-service.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-simulator',
};

// Helper: salva progresso com UPDATE se existe, INSERT se não
async function saveProgress(userId: string, data: Record<string, any>) {
  const { data: existing } = await supabase
    .from("user_progress")
    .select("id")
    .eq("whatsapp_user_id", userId)
    .limit(1)
    .single();

  if (existing) {
    await supabase.from("user_progress").update({ ...data, updated_at: new Date().toISOString() }).eq("whatsapp_user_id", userId);
  } else {
    await supabase.from("user_progress").insert({ whatsapp_user_id: userId, ...data, updated_at: new Date().toISOString() });
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const isSimulator = req.headers.get("x-simulator") === "true";
    if (isSimulator) {
      whatsappService.isSimulator = true;
      whatsappService.simulatorMessages = [];
    }

    const payload = await req.json();
    console.log("Payload recebido:", JSON.stringify(payload, null, 2));

    const remoteJid = payload.data?.key?.remoteJid || "";
    const phone = remoteJid.split("@")[0] || "5511999999999";
    const messageText = payload.data?.message?.conversation || payload.data?.message?.extendedTextMessage?.text || payload.data?.message?.buttonsResponseMessage?.selectedButtonId || "";
    const isAudio = !!payload.data?.message?.audioMessage;

    if (!phone) {
      if (isSimulator) return new Response(JSON.stringify({ messages: [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Ok", { status: 200 });
    }

    let { data: waUser } = await supabase
      .from("whatsapp_users")
      .select("*, user_preferences(*), user_progress(*)")
      .eq("phone_number", phone)
      .single();

    if (!waUser) {
      // Registra o usuário no banco para sair do loop de boas-vindas
      const { data: newUser, error: insertError } = await supabase
        .from("whatsapp_users")
        .insert({ phone_number: phone })
        .select()
        .single();
        
      if (!insertError) {
        waUser = newUser;
      }

      const welcome = getOnboardingFlow(0);
      await whatsappService.sendButtons({
        number: phone,
        text: welcome!.text,
        buttons: welcome!.options.map(opt => ({ displayText: opt }))
      });
      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Onboarding iniciado", { status: 200 });
    }

    const userProgress = waUser.user_progress?.[0];

    // Normalização sem acentos para comandos
    const normalizedMsg = messageText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // ====== 🚪 FLUXO DE ONBOARDING ======
    const prefs = waUser.user_preferences?.[0];

    // Passo 0: Frequência
    if (!prefs) {
      if (["sim", "nao", "não", "quero melhorar"].includes(normalizedMsg)) {
        await supabase.from("user_preferences").insert({ whatsapp_user_id: waUser.id, prayer_habit: messageText });
        await whatsappService.sendText({ number: phone, text: "Muito bem! 🙏\n\nComo você prefere **ser chamado(a)**, para que eu possa conversar e interceder por você do jeito certo? (Digite seu nome)" });
        if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response("Preferencia salva", { status: 200 });
      }

      const welcome = getOnboardingFlow(0);
      await whatsappService.sendButtons({ number: phone, text: welcome!.text, buttons: welcome!.options.map(opt => ({ displayText: opt })) });
      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Onboarding repetido", { status: 200 });
    }

    // Passo 1: Nome
    if (!waUser.full_name) {
      // O usuário acabou de digitar o nome
      await supabase.from("whatsapp_users").update({ full_name: messageText }).eq("id", waUser.id);
      
      await whatsappService.sendButtons({ 
        number: phone, 
        text: `Prazer em te conhecer, *${messageText}*! ✨\n\nE qual é o seu principal **Objetivo Espiritual** hoje? Pelo que você mais tem buscado a Deus?`,
        buttons: [{displayText:"Paz na família"}, {displayText:"Fortalecer a fé"}, {displayText:"Saúde"}]
      });
      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Nome salvo", { status: 200 });
    }

    // Passo 2: Objetivo Espiritual
    if (!prefs.spiritual_goal) {
      await supabase.from("user_preferences").update({ spiritual_goal: messageText }).eq("id", prefs.id);
      
      await whatsappService.sendList({
        number: phone,
        title: "Rotina com Deus",
        text: `Tudo pronto, ${waUser.full_name}! Vou interceder todos os dias pela sua intenção de: *${messageText}*.\n\nEscolha o que deseja fazer agora:`,
        buttonText: "Abrir Opções 🔽",
        sections: [{
          title: "Opções de Oração",
          rows: [
            { title: "🙏 Orar agora", description: "Converse e conte com a IA" },
            { title: "📖 Liturgia", description: "Leitura diária" },
            { title: "📿 Terço", description: "Terço guiado passo-a-passo" },
            { title: "🌙 Exame de consciência", description: "Reflexão do fim do dia" },
            { title: "🎤 Enviar intenção", description: "Mande um áudio com o pedido" },
            { title: "✝️ Tempos Especiais", description: "Jornadas de 40 dias" }
          ]
        }]
      });
      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Objetivo salvo", { status: 200 });
    }
    // ======================================

    // === SISTEMA DE DIAS CONSECUTIVOS (STREAK) ===
    let currentStreak = userProgress?.dias_consecutivos || 0;
    const lastInteractionStr = userProgress?.last_interaction_at;
    let showStreakMessage = false;

    const getMidnightUTC = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const todayMidnight = getMidnightUTC(new Date());

    if (lastInteractionStr) {
      const lastDateMidnight = getMidnightUTC(new Date(lastInteractionStr));
      const diffTime = todayMidnight.getTime() - lastDateMidnight.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak += 1;
        showStreakMessage = true; // Bateu ponto no dia seguinte!
      } else if (diffDays > 1) {
        currentStreak = 1; // Pulou mais de um dia, quebrou a sequência
      }
    } else {
      currentStreak = 1; // Primeiríssima vez
    }

    // Atualiza o progresso silenciosamente
    await saveProgress(waUser.id, {
      dias_consecutivos: currentStreak,
      last_interaction_at: new Date().toISOString()
    });

    if (showStreakMessage) {
      await whatsappService.sendText({ number: phone, text: `🙏 Você está no seu ${currentStreak}º dia seguido de oração. Continue assim!` });
    }
    // ==============================================

    if (isAudio) {
      await whatsappService.sendText({ number: phone, text: "🙏 Recebi sua intenção... Um momento enquanto preparo nossa oração." });
      
      const audioMessage = payload.data.message.audioMessage;
      const audioBase64 = audioMessage.base64 || ""; 
      const mimeType = audioMessage.mimetype || "audio/webm";
      
      if (audioBase64) {
        const prayer = await generatePersonalizedPrayer(audioBase64, mimeType);
        await whatsappService.sendText({ number: phone, text: prayer });

        await supabase.from("interaction_logs").insert({
          whatsapp_user_id: waUser.id,
          phone_number: phone,
          message_type: "audio",
          raw_message: "[ÁUDIO MULTIMODAL GEMINI]",
          ai_response: prayer,
          intent: "prayer_audio"
        });
      } else {
        await whatsappService.sendText({ number: phone, text: "Desculpe, não consegui processar seu áudio agora. Pode escrever sua intenção?" });
      }
      
      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Áudio processado", { status: 200 });
    }

    // 🧭 MENU PRINCIPAL E NAVEGAÇÕES COMPLETAS
    
    // 📖 Bíblia em 365 Dias
    if (normalizedMsg.includes("biblia") || normalizedMsg.includes("palavra")) {
      const currentDay = (userProgress?.bible_365_day || 0) + 1;
      const bibleContent = await getBible365Content(currentDay);
      
      await whatsappService.sendButtons({
        number: phone,
        text: bibleContent,
        buttons: [{displayText: "Amém 🙏"}, {displayText: "Menu Principal"}]
      });

      // Salva o progresso para o próximo dia
      await saveProgress(waUser.id, { bible_365_day: currentDay });

      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Bíblia enviada", { status: 200 });
    }

    // ✝️ Comunhão
    if (normalizedMsg.includes("comunhao") || normalizedMsg.includes("eucaristia")) {
      await whatsappService.sendText({ number: phone, text: "✝️ *Oração após a Comunhão*\n\nSenhor Jesus... Eu creio que estás presente em mim. Obrigado por este momento de comunhão.\n\nFica comigo, Senhor... E fortalece minha fé. Que eu leve a tua presença para todos ao meu redor. Amém. 🙏" });
      await sleep(1000);
      await whatsappService.sendAudio({ number: phone, audioUrl: "https://rotinacomdeus.vercel.app/audios/pos_comunhao.mp3" });
      await sleep(1000);
      await whatsappService.sendButtons({
        number: phone,
        text: "Escolha uma opção:",
        buttons: [{displayText: "Amém"}, {displayText: "Menu Principal"}]
      });
      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Comunhão enviada", { status: 200 });
    }

    // 🙏 São José
    if (normalizedMsg.includes("sao jose") || normalizedMsg.includes("jose")) {
      await whatsappService.sendText({ number: phone, text: "🙏 *Oração de São José*\n\nÓ glorioso São José... A quem foi dado o poder de tornar possíveis as coisas humanamente impossíveis... Vinde em nosso auxílio nas dificuldades em que nos achamos...\n\nTomai sob vossa proteção a causa importante que vos confiamos... Para que tenha uma solução favorável. Ó São José muito amado... Em vós depositamos toda a nossa confiança. Amém. ✨" });
      await sleep(1000);
      await whatsappService.sendAudio({ number: phone, audioUrl: "https://rotinacomdeus.vercel.app/audios/oracao_sao_jose.mp3" });
      await sleep(1000);
      await whatsappService.sendButtons({
        number: phone,
        text: "Escolha uma opção:",
        buttons: [{displayText: "Amém"}, {displayText: "Menu Principal"}]
      });
      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("São José enviado", { status: 200 });
    }

    const greetings = ["menu", "oi", "ola", "olá", "inicio", "início", "ajuda", "opcoes", "opções"];
    if (greetings.includes(normalizedMsg) && waUser) {
      await whatsappService.sendList({
        number: phone,
        title: "Rotina com Deus",
        text: "Bem-vindo ao menu principal! Como posso te ajudar agora? 🙏",
        buttonText: "Abrir Opções 🔽",
        sections: [{
          title: "Opções de Oração",
          rows: [
            { title: "🙏 Orar agora", description: "Converse e conte com a IA" },
            { title: "📖 Liturgia", description: "Leitura diária" },
            { title: "📿 Terço", description: "Terço guiado passo-a-passo" },
            { title: "🌙 Exame de consciência", description: "Reflexão do fim do dia" },
            { title: "🎤 Enviar intenção", description: "Mande um áudio com o pedido" },
            { title: "✝️ Tempos Especiais", description: "Jornadas de 40 dias" }
          ]
        }]
      });

      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Menu enviado", { status: 200 });
    }

    // ✝️ TEMPOS ESPECIAIS (Sub-menu)
    if (normalizedMsg.includes("tempos especiais") || normalizedMsg.includes("jornada")) {
      await whatsappService.sendList({
        number: phone,
        title: "Rotina com Deus",
        text: "✝️ *Tempos Especiais*\nEsses são os períodos de jornada de 40 dias que ofereço para aprofundar sua fé. Qual você quer iniciar ou continuar hoje?",
        buttonText: "Escolher Jornada",
        sections: [{
          title: "Jornadas de 40 Dias",
          rows: [
            { title: "💜 Quaresma", description: "Reflexão e penitência (40d)" },
            { title: "⚔️ Qua. de São Miguel", description: "Batalha espiritual (40d)" }
          ]
        }]
      });
      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Menu Tempos Especiais", { status: 200 });
    }

    // ✝️ TEMPOS ESPECIAIS (Geração da Novena)
    const isQuaresma = normalizedMsg.includes("quaresma") && !normalizedMsg.includes("miguel");
    const isSaoMiguel = normalizedMsg.includes("sao miguel") || normalizedMsg.includes("miguel") || normalizedMsg.includes("qua. de");

    if (isQuaresma || isSaoMiguel) {
      const novenaName = isQuaresma ? "Quaresma" : "Quaresma de São Miguel";
      const dbNovenaName = isQuaresma ? "quaresma" : "sao_miguel";
      
      let currentDay = 1;
      if (userProgress?.current_novena === dbNovenaName) {
        currentDay = (userProgress?.novena_day || 0) + 1;
      }

      if (currentDay > 40) {
        await whatsappService.sendText({ number: phone, text: `🎉 Parabéns! Você concluiu com sucesso os 40 dias de oração da jornada de *${novenaName}*! Que Deus te recompense grandemente.`});
        await saveProgress(waUser.id, { current_novena: null, novena_day: 0 });
        if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response("Novena concluída", { status: 200 });
      }

      await whatsappService.sendText({ number: phone, text: `✝️ *${novenaName} - Dia ${currentDay} de 40*\n\nUm momento... Deixe-me preparar a sua reflexão espiritual de hoje. 🙏`});

      // Pede pra IA gerar o conteúdo do dia e salva progresso pra amanhã
      const generationText = await generateSpecialPeriodDay(novenaName, currentDay);
      
      await whatsappService.sendButtons({
        number: phone,
        text: generationText,
        buttons: [{displayText: "Amém 🙏"}, {displayText: "Menu"}]
      });

      await saveProgress(waUser.id, {
        current_novena: dbNovenaName,
        novena_day: currentDay
      });

      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Novena enviada", { status: 200 });
    }

    // 🌙 Início do Exame de Consciência
    if (normalizedMsg.includes("exame") && userProgress?.last_prayer_type !== "exame") {
      await whatsappService.sendText({ 
        number: phone, 
        text: `🌙 *Boa noite*\n\nVamos encerrar o seu dia com Deus.\nRespire fundo...\nAgora pense no seu dia...` 
      });
      await sleep(1000);
      await whatsappService.sendAudio({ number: phone, audioUrl: "https://rotinacomdeus.vercel.app/audios/exame_consciencia.mp3" });
      await sleep(1000);
      await whatsappService.sendText({ 
        number: phone, 
        text: `Como foi o seu dia hoje? (Pode desabafar)` 
      });

      await saveProgress(waUser.id, {
        last_prayer_type: "exame",
        last_prayer_step: 1
      });

      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Exame iniciado", { status: 200 });
    }

    // 🌙 Continuação do Exame de Consciência (Estado)
    if (userProgress?.last_prayer_type === "exame") {
      const step = userProgress.last_prayer_step || 1;
      let nextText = "";
      let nextStep = step + 1;
      
      if (step === 1) {
        nextText = "Você foi paciente e ajudou alguém hoje ou teve momentos de irritação?";
      } else if (step === 2) {
        nextText = "Peça perdão a Deus pelas suas falhas... E agradeça pelas coisas boas desta jornada que passou. (Escreva sua oração espontânea ou só diga 'Amém')";
      } else if (step === 3) {
        nextText = "🙏 *Senhor, obrigado por este dia. Perdoa minhas falhas e me ajuda a ser melhor amanhã. Amém.* ✨\n\n(Digite 'menu' quando quiser voltar)";
        nextStep = 0; // Finaliza o fluxo
      }

      await whatsappService.sendText({ number: phone, text: nextText });

      await saveProgress(waUser.id, {
        last_prayer_type: nextStep === 0 ? null : "exame",
        last_prayer_step: nextStep
      });

      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Exame passo " + step, { status: 200 });
    }

    // Lógica de Botões do Terço (avançar passos)
    const isInTerco = userProgress?.last_prayer_type === "terco";
    if (isInTerco && (messageText.includes("btn_") || normalizedMsg.includes("proximo") || normalizedMsg.includes("intencao") || normalizedMsg.includes("concluir") || normalizedMsg.includes("iniciar"))) {
      const currentStep = userProgress?.last_prayer_step ?? 0;
      const nextStep = getNextRosaryStep(currentStep);

      if (nextStep) {
        if (nextStep.audioUrl) {
          await whatsappService.sendText({ number: phone, text: nextStep.text });
          await sleep(1000);
          await whatsappService.sendAudio({ number: phone, audioUrl: nextStep.audioUrl });
          await sleep(1000);
          await whatsappService.sendButtons({
            number: phone,
            text: "Quando você terminar, escolha a opção abaixo:",
            buttons: nextStep.buttons.map(b => ({ displayText: b }))
          });
        } else {
          await whatsappService.sendButtons({
            number: phone,
            text: nextStep.text,
            buttons: nextStep.buttons.map(b => ({ displayText: b }))
          });
        }

        await saveProgress(waUser.id, {
          last_prayer_type: "terco",
          last_prayer_step: nextStep.id
        });

        if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response("Passo do terço enviado", { status: 200 });
      } else {
        // Terço concluído, limpa o estado
        await saveProgress(waUser.id, {
          last_prayer_type: null,
          last_prayer_step: 0
        });
      }
    }

    if (normalizedMsg.includes("liturgia") || normalizedMsg.includes("santo do dia")) {
      const liturgy = await getDailyLiturgy();
      if (liturgy) {
        let text = `📖 *Liturgia do Dia*\n\n`;
        if (liturgy.title) text += `*${liturgy.title}*\n\n`;
        text += `${liturgy.reflection}\n\n`;
        text += `😇 *Santo do Dia:*\n${liturgy.saint}`;

        await whatsappService.sendButtons({ 
          number: phone, 
          text: text,
          buttons: [{displayText: "Amém 🙏"}, {displayText: "Menu"}]
        });
        if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response("Liturgia enviada", { status: 200 });
      }
    }

    if (normalizedMsg.includes("terco") || normalizedMsg.includes("rosario")) {
      const mystery = getMysteryOfDay(new Date());
      const firstStep = getNextRosaryStep(-1); // Retorna step 0
      
      await whatsappService.sendButtons({
        number: phone,
        text: `📿 *Terço Guiado*\n\nHoje contemplamos os *Mistérios ${mystery.name}*.\n\n${firstStep!.text}`,
        buttons: firstStep!.buttons.map(b => ({ displayText: b }))
      });

      await saveProgress(waUser.id, {
        last_prayer_type: "terco",
        last_prayer_step: firstStep!.id
      });

      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Terço iniciado", { status: 200 });
    }

    // Buscar histórico recente para dar memória à IA
    const { data: recentLogs } = await supabase
      .from("interaction_logs")
      .select("raw_message, ai_response")
      .eq("whatsapp_user_id", waUser.id)
      .order("created_at", { ascending: false })
      .limit(3);

    let memory = "";
    if (recentLogs && recentLogs.length > 0) {
      memory = recentLogs.slice().reverse().map(l => `Usuário: ${l.raw_message}\nIA (Você): ${l.ai_response}`).join("\n\n");
    }

    const context = `Perfil do Usuário: Nome: ${waUser.full_name || "Amigo"}. Hábito de oração: ${waUser.user_preferences?.[0]?.prayer_habit || "N/A"}. Objetivo principal: ${waUser.user_preferences?.[0]?.spiritual_goal || "N/A"}.\nUse esses dados em suas respostas conversacionais para trazer o contexto pessoal dele!\n\nHISTÓRICO DA CONVERSA:\n${memory}`;
    const aiResponse = await generateSpiritualResponse(messageText, context);
    
    const responseText = aiResponse.text || aiResponse;
    const responseButtons = aiResponse.buttons || [];

    if (responseButtons.length > 0) {
      await whatsappService.sendButtons({
        number: phone,
        text: responseText,
        buttons: responseButtons.map((b: string) => ({ displayText: b.substring(0, 20) })) // limite do whatsapp
      });
    } else {
      await whatsappService.sendText({ number: phone, text: responseText });
    }

    await supabase.from("interaction_logs").insert({
      whatsapp_user_id: waUser.id,
      phone_number: phone,
      message_type: isAudio ? "audio" : "text",
      raw_message: messageText,
      ai_response: responseText,
      intent: "general"
    });

    if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response("Ok", { status: 200 });
  } catch (err: any) {
    console.error("Erro no processamento:", err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});



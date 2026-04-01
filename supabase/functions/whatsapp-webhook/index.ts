import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateSpiritualResponse, generatePersonalizedPrayer, generateSpecialPeriodDay, transcribeAudio } from "./services/ai-service.ts";
import { getOnboardingFlow, getNextRosaryStep, getMysteryOfDay } from "./services/prayer-service.ts";
import { getDailyLiturgy } from "./services/liturgy-service.ts";
import { getBible365Content } from "./services/bible-service.ts";
import { whatsappService } from "./services/whatsapp-service.ts";
import { generatePremiumImage } from "./services/image-service.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-simulator',
};

async function sendMainMenu(phone: string, waUser: any) {
  await whatsappService.sendList({
    number: phone,
    title: "Menu Principal 🕊️",
    text: `Olá, *${waUser.full_name || "Amigo"}*! 👋\nComo posso te ajudar no seu caminho com Deus hoje?`,
    buttonText: "Escolha seu momento 🔽",
    sections: [{
      title: "Oração Diária",
      rows: [
        { title: "🚀 Minha Rotina Diária", id: "btn_routine", description: "Liturgia + Bíblia 365" },
        { title: "✝️ Santo Terço", id: "btn_terco", description: "O Rosário completo e guiado" },
        { title: "🙏 Orações Especiais", id: "btn_special_prayers", description: "S. José, S. Miguel e mais" },
        { title: "🗡️ Quaresma de S. Miguel", id: "btn_miguel", description: "Início em 15 de Agosto" },
        { title: "🕊️ Quaresma", id: "btn_quaresma", description: "Acompanhe sua jornada" }
      ]
    }, {
      title: "Configurações",
      rows: [
        { title: "⚙️ Preferências", id: "btn_prefs", description: "Notificações e Horários" }
      ]
    }]
  });
}

async function saveProgress(userId: string, data: Record<string, any>) {
  const { data: existing } = await supabase.from("user_progress").select("id").eq("whatsapp_user_id", userId).limit(1).single();
  if (existing) {
    await supabase.from("user_progress").update({ ...data, updated_at: new Date().toISOString() }).eq("whatsapp_user_id", userId);
  } else {
    await supabase.from("user_progress").insert({ whatsapp_user_id: userId, ...data, updated_at: new Date().toISOString() });
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("hub.mode") === "subscribe") {
      return new Response(url.searchParams.get("hub.challenge"), { status: 200 });
    }
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const isSimulator = req.headers.get("x-simulator") === "true";
    if (isSimulator) { whatsappService.isSimulator = true; whatsappService.simulatorMessages = []; }

    const payload = await req.json();
    if (payload.entry?.[0]?.changes?.[0]?.value?.statuses) return new Response("OK", { status: 200 });

    const value = payload.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message && !isSimulator) return new Response("OK", { status: 200 });

    let phone = message?.from || "5511999999999";
    if (phone.startsWith("55") && phone.length === 13) phone = phone.slice(0, 4) + phone.slice(5);

    let messageText = "";
    let buttonId = "";
    let isAudio = false;

    if (message?.type === "text") {
      messageText = message.text?.body || "";
    } else if (message?.type === "interactive") {
      const interactive = message.interactive;
      messageText = interactive.button_reply?.title || interactive.list_reply?.title || "";
      buttonId = interactive.button_reply?.id || interactive.list_reply?.id || "";
    } else if (message?.type === "audio") {
      isAudio = true;
    }

    let { data: waUser } = await supabase.from("whatsapp_users")
      .select("*, user_preferences(*), user_progress(*), profile:user_id(subscription_status, subscription_valid_until)")
      .eq("phone_number", phone).single();

    if (!waUser) {
      const { data: newUser, error: insertError } = await supabase.from("whatsapp_users").insert({ phone_number: phone }).select().single();
      if (insertError) {
        console.error("❌ Erro ao criar waUser:", insertError.message);
      }
      waUser = newUser;
      await whatsappService.sendText({ number: phone, text: "Bem-vindo ao *Rotina com Deus*! 🙏\n\nComo você prefere ser chamado(a)?" });
      return new Response("OK", { status: 200 });
    }

    if (!waUser.full_name) {
      const { error: updateError } = await supabase.from("whatsapp_users").update({ full_name: messageText }).eq("id", waUser.id);
      if (updateError) {
        console.error("❌ Erro ao atualizar nome do waUser:", updateError.message);
      }
      await whatsappService.sendText({ number: phone, text: `Prazer em te conhecer, *${messageText}*! ✨` });
      await sleep(500);
      await sendMainMenu(phone, { ...waUser, full_name: messageText });
      const { error: prefError } = await supabase.from("user_preferences").insert({ whatsapp_user_id: waUser.id });
      if (prefError && prefError.code !== '23505') { // Ignora se já existir
        console.error("❌ Erro ao criar user_preferences:", prefError.message);
      }
      return new Response("OK", { status: 200 });
    }

    const userProgress = waUser.user_progress?.[0];
    const userProfile = waUser.profile;
    const isSubscriptionActive = userProfile?.subscription_status === "active" || userProfile?.subscription_status === "trial";
    const normalizedMsg = messageText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // ====== 🛑 VERIFICAÇÃO DE ASSINATURA (Paywall) ======
    // Ignora se for o comando de menu ou se já estiver ativo
    const isSpecialAdmin = phone === "556198416939" || phone === "556139841693"; // Exemplo de whitelist
    
    if (!isSubscriptionActive && !isSpecialAdmin && !isSimulator) {
      if (buttonId === "btn_subscribe") {
        const plansText = `⭐ *Escolha seu plano e ative agora:* \n\n🔹 *Anual (Recomendado)*: 12x de R$ 9,90\n🔗 https://pay.kiwify.com.br/PROCESSO_DE_VENDA_ANUAL\n\n🔹 *Semestral*: 6x de R$ 14,90\n🔗 https://pay.kiwify.com.br/PROCESSO_DE_VENDA_SEMESTRAL\n\n🔹 *Mensal*: R$ 19,90\n🔗 https://pay.kiwify.com.br/PROCESSO_DE_VENDA_MENSAL\n\n🛡️ *Garantia Incondicional de 7 dias.*`;
        await whatsappService.sendText({ number: phone, text: plansText });
        return new Response("OK", { status: 200 });
      }

      if (buttonId === "btn_support") {
        await whatsappService.sendText({ number: phone, text: "🙌 *Suporte Rotina com Deus*\n\nPrecisa de ajuda com sua assinatura ou tem alguma dúvida? Fale conosco por aqui ou envie um e-mail para suporte@rotinacomdeus.com.br" });
        return new Response("OK", { status: 200 });
      }

      const renewText = `🙏 Olá! Percebi que sua jornada no *Rotina com Deus* ainda não foi ativada ou sua assinatura expirou.\n\nPara continuar recebendo as orações diárias, acompanhar a Bíblia 365 e ter o suporte da nossa IA espiritual, você pode renovar seu acesso clicando no botão abaixo.`;
      
      await whatsappService.sendButtons({
        number: phone,
        text: renewText,
        buttons: [
          { displayText: "⭐ Renovação Premium", id: "btn_subscribe" },
          { displayText: "Dúvidas / Suporte", id: "btn_support" }
        ]
      });
      return new Response("OK", { status: 200 });
    }

    // ====== 🔥 GATILHOS DO MENU ======
    const isMenuTrigger = buttonId === "btn_menu" || normalizedMsg === "menu" || normalizedMsg === "menu principal";
    const isRoutineTrigger = buttonId === "btn_routine" || normalizedMsg === "rotina de hoje" || normalizedMsg === "minha rotina diaria";
    const isTercoTrigger = buttonId === "btn_terco" || normalizedMsg === "terco" || normalizedMsg === "terço";
    
    if (isRoutineTrigger) {
      await saveProgress(waUser.id, { last_prayer_type: null, last_prayer_step: 0 });
      await whatsappService.sendText({ number: phone, text: "🚀 Preparando sua rotina premium... 🙏" });
      
      const now = new Date();
      now.setHours(now.getHours() - 3);
      const todayStr = now.toISOString().split('T')[0];
      const todayFormat = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      const liturgy = await getDailyLiturgy();
      if (liturgy) {
        await whatsappService.sendText({ number: phone, text: `📖 *${liturgy.title}*\n\n${liturgy.reflection}\n\n😇 *Santo:* ${liturgy.saint}` });
        await sleep(1000);
      }
      
      const lastUpdate = userProgress?.updated_at ? new Date(userProgress.updated_at) : new Date(0);
      lastUpdate.setHours(lastUpdate.getHours() - 3);
      const lastUpdateStr = lastUpdate.toISOString().split('T')[0];

      let currentDay = userProgress?.bible_365_day || 0;
      if (lastUpdateStr !== todayStr) {
        currentDay += 1;
      }
      
      const bibleContent = await getBible365Content(currentDay);
      await whatsappService.sendText({ number: phone, text: `✨ *Leitura do Dia ${currentDay}*\n\n${bibleContent}` });
      await sleep(1000);

      const encText = `🙏 Glória a Deus! Você completou mais um passo na sua jornada de fé hoje.\n\nComo posso te ajudar agora?`;
      
      await whatsappService.sendButtons({ 
        number: phone, 
        text: encText, 
        buttons: [
          { displayText: "Refletir 💡", id: "btn_reflect" }, 
          { displayText: "Intenção 🙏", id: "btn_intent" },
          { displayText: "Amém 🙏", id: "btn_done" }
        ] 
      });
      await saveProgress(waUser.id, { bible_365_day: currentDay });
      return new Response("OK", { status: 200 });
    }

    if (isTercoTrigger) {
      const mystery = getMysteryOfDay(new Date());
      const firstStep = getNextRosaryStep(-1);
      await whatsappService.sendButtons({
        number: phone,
        text: `✝️ *Terço - Mistérios ${mystery.name}*\n\n${firstStep!.text}`,
        buttons: firstStep!.buttons.map(b => ({ displayText: b.displayText, id: b.id }))
      });
      await saveProgress(waUser.id, { last_prayer_type: "terco", last_prayer_step: firstStep!.id });
      return new Response("OK", { status: 200 });
    }

    const isQuaresma = buttonId === "btn_quaresma" || normalizedMsg === "quaresma";
    const isMiguel = buttonId === "btn_miguel" || normalizedMsg === "quaresma de sao miguel";

    if (isQuaresma || isMiguel) {
      await saveProgress(waUser.id, { last_prayer_type: null, last_prayer_step: 0 });
      const novenaName = isQuaresma ? "Quaresma" : "Quaresma de São Miguel";
      const dbName = isQuaresma ? "quaresma" : "sao_miguel";
      
      const today = new Date();
      const currentYear = today.getFullYear();
      const startDates: Record<string, string> = { "quaresma": `${currentYear}-02-18`, "sao_miguel": `${currentYear}-08-15` };
      const start = new Date(startDates[dbName]);
      
      if (today < start) {
        const dateStr = start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
        await whatsappService.sendButtons({
          number: phone,
          text: `🕊️ A *${novenaName}* ainda não começou!\n\nEla será iniciada no dia *${dateStr}*. Fique atento ao menu! 🙏`,
          buttons: [{ displayText: "Menu Principal", id: "btn_menu" }]
        });
        return new Response("OK", { status: 200 });
      }

      const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const day = Math.max(1, diff);
      const maxDays = (dbName === "quaresma") ? 47 : 40;

      if (day > maxDays) {
        await whatsappService.sendButtons({
          number: phone,
          text: `✨ A *${novenaName}* deste ano já foi concluída! 🙏`,
          buttons: [{ displayText: "Menu Principal", id: "btn_menu" }]
        });
        return new Response("OK", { status: 200 });
      }
      
      const content = await generateSpecialPeriodDay(novenaName, day);
      await whatsappService.sendButtons({ number: phone, text: content, buttons: [{displayText: "Refletir 💡", id: "btn_reflect"}, {displayText: "Menu Principal", id: "btn_menu"}] });
      await saveProgress(waUser.id, { current_novena: dbName, novena_day: day });
      return new Response("OK", { status: 200 });
    }

    // ====== 📿 TERÇO PASSO-A-PASSO ======
    if (userProgress?.last_prayer_type === "terco" && buttonId === "terco_next") {
      const next = getNextRosaryStep(userProgress.last_prayer_step || 0);
      if (next) {
        if (next.audioUrl) {
          await whatsappService.sendText({ number: phone, text: next.text });
          await sleep(500);
          await whatsappService.sendAudio({ number: phone, audioUrl: next.audioUrl });
          await sleep(1500);
        }
        await whatsappService.sendButtons({ number: phone, text: next.audioUrl ? "Quando terminar, avance:" : next.text, buttons: next.buttons.map(b => ({ displayText: b.displayText, id: b.id })) });
        await saveProgress(waUser.id, { last_prayer_step: next.id });
      } else {
        await whatsappService.sendText({ number: phone, text: "🎉 Você concluiu o Terço! Que Deus te abençoe." });
        await saveProgress(waUser.id, { last_prayer_type: null, last_prayer_step: 0 });
      }
      return new Response("OK", { status: 200 });
    }

    // ====== 🎤 DIÁLOGO CONTEXTUAL (Reflexão / Intenção / IA) ======
    if (buttonId === "btn_reflect") {
      await saveProgress(waUser.id, { last_prayer_type: "reflection" });
      await whatsappService.sendText({ number: phone, text: "🕊️ O que mais tocou seu coração nessa leitura de hoje? Pode me contar por texto ou áudio." });
      return new Response("OK", { status: 200 });
    }

    if (buttonId === "btn_intent") {
      await saveProgress(waUser.id, { last_prayer_type: "intention" });
      await whatsappService.sendText({ number: phone, text: "🙏 Qual a sua intenção especial para hoje? Vou colocá-la em minhas orações." });
      return new Response("OK", { status: 200 });
    }

    const isDone = buttonId === "btn_done" || normalizedMsg === "amem" || normalizedMsg === "amem 🙏";
    if (isDone) {
      await whatsappService.sendText({ number: phone, text: "Amém! 🙏 Que a paz de Cristo permaneça com você." });
      await sleep(1000);
      await sendMainMenu(phone, waUser);
      return new Response("OK", { status: 200 });
    }

    if (isMenuTrigger) {
      await saveProgress(waUser.id, { last_prayer_type: null, last_prayer_step: 0 });
      await sendMainMenu(phone, waUser);
      return new Response("OK", { status: 200 });
    }

    if (buttonId === "btn_prefs") {
      await whatsappService.sendButtons({
        number: phone,
        text: "⚙️ *Configurações & Preferências*\n\nSuas orações são entregues automaticamente nos horários sagrados:\n\n🌅 *Manhã:* 07:00h\n☀️ *Meio-dia:* 12:00h\n🌙 *Noite:* 21:00h\n\n_Escolhemos esses horários para que toda a nossa comunidade esteja em oração junta!_ 🙏",
        buttons: [{ displayText: "Menu Principal", id: "btn_menu" }]
      });
      return new Response("OK", { status: 200 });
    }

    if (buttonId === "btn_special_prayers") {
      await whatsappService.sendButtons({
        number: phone,
        text: "🙏 *Orações Especiais*\n\nEscolha uma oração para ouvir e acompanhar em silêncio:",
        buttons: [
          { displayText: "São José 🧔‍♂️", id: "btn_sao_jose" },
          { displayText: "São Miguel 🗡️", id: "btn_sao_miguel" },
          { displayText: "Menu Principal", id: "btn_menu" }
        ]
      });
      return new Response("OK", { status: 200 });
    }

    if (buttonId === "btn_sao_jose") {
      await whatsappService.sendAudio({ number: phone, audioUrl: "https://rotina-com-deus.vercel.app/audios/oracao_sao_jose.mp3" });
      return new Response("OK", { status: 200 });
    }

    if (buttonId === "btn_sao_miguel") {
      await whatsappService.sendAudio({ number: phone, audioUrl: "https://rotina-com-deus.vercel.app/audios/oracao_sao_miguel.mp3" });
      return new Response("OK", { status: 200 });
    }

    // ====== 🎤 TRATAMENTO DE ÁUDIO (Contextual) ======
    if (isAudio) {
      const audioId = message.audio?.id;
      const audioData = await whatsappService.downloadMedia(audioId);
      
      if (audioData) {
        const transcription = await transcribeAudio(audioData, message.audio?.mime_type);
        const msg = transcription || "[SEM_FALA]";
        
        let aiPrompt = msg;
        let aiContext = `Usuário: ${waUser.full_name}, Tipo: ÁUDIO`;

        if (userProgress?.last_prayer_type === "reflection" || userProgress?.last_prayer_type === "intention") {
          // Captura Contexto Diário para a IA
          const liturgy = await getDailyLiturgy();
          const bible = await getBible365Content(userProgress?.bible_365_day || 1);
          const dailyContext = `LITURGIA: ${liturgy?.title} - ${liturgy?.reflection}\nBÍBLIA: ${bible.substring(0, 300)}`;
          
          if (userProgress.last_prayer_type === "reflection") {
            aiPrompt = `O usuário enviou uma REFLEXÃO EM ÁUDIO sobre a leitura de hoje.\nCONTEÚDO DO DIA:\n${dailyContext}\n\nO QUE ELE DISSE (Transcrição): "${msg}".\nResponda como guia espiritual católico, comentando a reflexão dele.`;
          } else {
            aiPrompt = `O usuário enviou uma INTENÇÃO EM ÁUDIO: "${msg}".\nReze por ele de forma breve e acolhedora.`;
          }
          
          const aiRes = await generateSpiritualResponse(aiPrompt, aiContext);
          await whatsappService.sendButtons({ number: phone, text: aiRes.text, buttons: aiRes.buttons.slice(0, 2).map((b: string) => ({ displayText: b })) });
          await saveProgress(waUser.id, { last_prayer_type: null });
        } else {
          // Comportamento original se não for reflexão/intenção
          const prayerResult = await generatePersonalizedPrayer(audioData, message.audio?.mime_type);
          await whatsappService.sendButtons({ number: phone, text: prayerResult.text, buttons: prayerResult.buttons.map((b: string) => ({ displayText: b })) });
        }
      } else {
        await whatsappService.sendText({ number: phone, text: "🙏 Perdoe-me, não consegui ouvir seu áudio agora. Pode tentar novamente ou escrever?" });
      }
      return new Response("OK", { status: 200 });
    }

    // ====== 🕊️ IA CONVERSACIONAL (Reflexão / Intenção / Geral) ======
    let aiPrompt = messageText;
    let aiContext = `Nome: ${waUser.full_name}, Tipo: ${userProgress?.last_prayer_type || "conversa"}`;

    if (userProgress?.last_prayer_type === "reflection" || userProgress?.last_prayer_type === "intention") {
      // Captura Contexto Diário para a IA
      const liturgy = await getDailyLiturgy();
      const bible = await getBible365Content(userProgress?.bible_365_day || 1);
      const dailyContext = `LITURGIA: ${liturgy?.title} - ${liturgy?.reflection}\nBÍBLIA: ${bible.substring(0, 300)}`;

      if (userProgress.last_prayer_type === "reflection") {
        aiPrompt = `O usuário está REFLETINDO sobre a leitura de hoje.\nCONTEÚDO DO DIA:\n${dailyContext}\n\nO QUE ELE ESCREVEU: "${messageText}".\nResponda como guia espiritual católico, conectando o que ele disse com a palavra de hoje.`;
      } else if (userProgress.last_prayer_type === "intention") {
        aiPrompt = `O usuário enviou uma INTENÇÃO DE ORAÇÃO: "${messageText}".\nReze por ele agora de forma breve e acolhedora.`;
      }
    }

    const aiRes = await generateSpiritualResponse(aiPrompt, aiContext);
    await whatsappService.sendButtons({ 
      number: phone, 
      text: aiRes.text, 
      buttons: aiRes.buttons.slice(0, 2).map((b: string) => ({ displayText: b.substring(0, 20) })) 
    });

    // Se foi uma reflexão ou intenção, voltamos ao estado neutro após a resposta
    if (userProgress?.last_prayer_type === "reflection" || userProgress?.last_prayer_type === "intention") {
      await saveProgress(waUser.id, { last_prayer_type: null });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response("Error", { status: 500 });
  }
});

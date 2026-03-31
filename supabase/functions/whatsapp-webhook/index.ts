import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateSpiritualResponse, generatePersonalizedPrayer, generateSpecialPeriodDay } from "./services/ai-service.ts";
import { getOnboardingFlow, getNextRosaryStep, getMysteryOfDay, PRAYERS } from "./services/prayer-service.ts";
import { getDailyLiturgy } from "./services/liturgy-service.ts";
import { getBible365Content, searchBible } from "./services/bible-service.ts";
import { whatsappService } from "./services/whatsapp-service.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-simulator',
};

// Helper: Envia o Menu Principal centralizado
async function sendMainMenu(phone: string, waUser: any) {
  await whatsappService.sendList({
    number: phone,
    title: "Painel de Controle",
    text: `Olá, *${waUser.full_name || "Amigo"}*! 👋\nComo posso te ajudar no seu caminho com Deus hoje? Escolha uma opção abaixo:`,
    buttonText: "Abrir Opções 🔽",
    sections: [{
      title: "Rotina Diária",
      rows: [
        { title: "🚀 Rotina de Hoje", id: "btn_routine", description: "Liturgy + Bible Journey" },
        { title: "📖 Bíblia 365", id: "btn_bible_365", description: "Continue sua jornada" },
        { title: "📿 Terço Guiado", id: "btn_terco", description: "Contemplação passo-a-passo" },
      ]
    }, {
      title: "Utilidades",
      rows: [
        { title: "🔍 Buscar na Bíblia", id: "btn_search", description: "Pesquisar tema ou verso" },
        { title: "🌙 Exame do Dia", id: "btn_exame", description: "Reflexão da noite" },
        { title: "🎤 Enviar Intenção", id: "btn_audio", description: "Mande um áudio de oração" },
        { title: "✝️ Tempos Especiais", id: "btn_jornadas", description: "Quaresma / S. Miguel" }
      ]
    }, {
      title: "Outros",
      rows: [
        { title: "⚙️ Configurações", id: "btn_settings", description: "Mudar nome ou reiniciar" }
      ]
    }]
  });
}

// Helper: salva progresso com UPDATE se existe, INSERT se não
async function saveProgress(userId: string, data: Record<string, any>) {
  const { data: existing } = await supabase
    .from("user_progress")
    .select("id")
    .eq("whatsapp_user_id", userId)
    .limit(1)
    .single();

  if (existing) {
    await supabase.from("user_progress")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("whatsapp_user_id", userId);
  } else {
    await supabase.from("user_progress")
      .insert({ whatsapp_user_id: userId, ...data, updated_at: new Date().toISOString() });
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  const { method } = req;
  const url = new URL(req.url);

  // ====== 🛠️ VERIFICAÇÃO DO WEBHOOK (GET) ======
  if (method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN") || "rotina_com_deus_webhook_2024";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verificado com sucesso!");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (method === 'OPTIONS') {
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

    if (payload.entry?.[0]?.changes?.[0]?.value?.statuses) {
      return new Response("Status ignored", { status: 200 });
    }

    const value = payload.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    
    if (!message && !isSimulator) return new Response("No message", { status: 200 });

    let phone = message?.from || "5511999999999";
    if (phone.startsWith("55") && phone.length === 13) {
      phone = phone.slice(0, 4) + phone.slice(5);
    }
    console.log(`📱 Processando mensagem de: ${phone}`);

    let messageText = "";
    let buttonId = "";
    let isAudio = false;
    let audioId = "";

    if (message?.type === "text") {
      messageText = message.text?.body || "";
      console.log(`💬 Texto: "${messageText}"`);
    } else if (message?.type === "interactive") {
      const interactive = message.interactive;
      if (interactive.type === "button_reply") {
        messageText = interactive.button_reply?.title || "";
        buttonId = interactive.button_reply?.id || "";
      } else if (interactive.type === "list_reply") {
        messageText = interactive.list_reply?.title || "";
        buttonId = interactive.list_reply?.id || "";
      }
      console.log(`🔘 Interação: "${messageText}" (ID: ${buttonId})`);
    } else if (message?.type === "audio") {
      isAudio = true;
      audioId = message.audio?.id || "";
      (message as any).audioMimeType = message.audio?.mime_type || "audio/ogg";
    }

    let { data: waUser, error: queryError } = await supabase
      .from("whatsapp_users")
      .select("*, user_preferences(*), user_progress(*)")
      .eq("phone_number", phone)
      .single();

    if (!waUser) {
      const { data: newUser } = await supabase.from("whatsapp_users").insert({ phone_number: phone }).select().single();
      waUser = newUser;
      const welcome = getOnboardingFlow(0);
      await whatsappService.sendButtons({ number: phone, text: welcome!.text, buttons: welcome!.options.map(opt => ({ displayText: opt })) });
      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Onboarding iniciado", { status: 200 });
    }

    const userProgress = waUser.user_progress?.[0];
    const prefs = waUser.user_preferences?.[0];
    const normalizedMsg = messageText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // ====== 🚪 FLUXO DE ONBOARDING ======
    if (!prefs) {
      if (["sim", "nao", "não", "quero melhorar"].includes(normalizedMsg)) {
        await supabase.from("user_preferences").insert({ whatsapp_user_id: waUser.id, prayer_habit: messageText });
        await whatsappService.sendText({ number: phone, text: "Como você prefere **ser chamado(a)**? (Digite seu nome)" });
        return new Response("OK", { status: 200 });
      }
      const welcome = getOnboardingFlow(0);
      await whatsappService.sendButtons({ number: phone, text: welcome!.text, buttons: welcome!.options.map(opt => ({ displayText: opt })) });
      return new Response("OK", { status: 200 });
    }

    if (!waUser.full_name) {
      await supabase.from("whatsapp_users").update({ full_name: messageText }).eq("id", waUser.id);
      await whatsappService.sendButtons({ 
        number: phone, 
        text: `Prazer, *${messageText}*! Qual seu objetivo espiritual?`,
        buttons: [{displayText:"Paz na família"}, {displayText:"Fortalecer a fé"}, {displayText:"Saúde"}]
      });
      return new Response("OK", { status: 200 });
    }

    if (!prefs.spiritual_goal) {
      await supabase.from("user_preferences").update({ spiritual_goal: messageText }).eq("id", prefs.id);
      await whatsappService.sendText({ number: phone, text: `Anotado! Vou interceder por: *${messageText}*. 🙏` });
      await sleep(500);
      await sendMainMenu(phone, waUser);
      return new Response("OK", { status: 200 });
    }

    // ====== 🔍 MODO DE BUSCA BÍBLICA ======
    if (userProgress?.last_prayer_type === "search_bible" && !buttonId.includes("menu")) {
      await whatsappService.sendText({ number: phone, text: "🔍 Buscando na Bíblia por você..." });
      const searchResult = await searchBible(messageText);
      await whatsappService.sendButtons({
        number: phone,
        text: searchResult,
        buttons: [{displayText: "Amém 🙏"}, {displayText: "Fazer nova busca"}, {displayText: "Menu Principal"}]
      });
      await saveProgress(waUser.id, { last_prayer_type: null });
      return new Response("Busca concluída", { status: 200 });
    }

    // ====== 🚀 ROTINA DE HOJE (Gatilho Manual) ======
    if (normalizedMsg.includes("rotina de hoje") || buttonId === "btn_routine") {
      await whatsappService.sendText({ number: phone, text: "🚀 Preparando sua rotina de hoje... Um momento de paz. 🙏" });
      const liturgy = await getDailyLiturgy();
      if (liturgy) {
        await whatsappService.sendText({ number: phone, text: `📖 *Liturgia do Dia*\n\n*${liturgy.title}*\n\n${liturgy.reflection}\n\n😇 *Santo do Dia:* ${liturgy.saint}` });
      }
      await sleep(2000);
      const currentDay = (userProgress?.bible_365_day || 0) + 1;
      const bibleContent = await getBible365Content(currentDay);
      await whatsappService.sendButtons({
        number: phone,
        text: bibleContent,
        buttons: [{displayText: "Amém 🙏"}, {displayText: "Menu Principal"}]
      });
      await saveProgress(waUser.id, { bible_365_day: currentDay });
      return new Response("Rotina enviada", { status: 200 });
    }

    // ====== 🔍 INICIAR BUSCA BÍBLICA ======
    if (normalizedMsg.includes("buscar na biblia") || buttonId === "btn_search" || normalizedMsg === "fazer nova busca") {
      await whatsappService.sendText({ number: phone, text: "🔍 O que você deseja buscar na Bíblia?\n\nEx: 'Paz', 'João 3:16', 'Sobre o perdão'..." });
      await saveProgress(waUser.id, { last_prayer_type: "search_bible" });
      return new Response("Busca iniciada", { status: 200 });
    }

    // ====== ⚙️ CONFIGURAÇÕES ======
    if (normalizedMsg.includes("configuracoes") || buttonId === "btn_settings") {
      await whatsappService.sendButtons({
        number: phone,
        text: "⚙️ *Configurações*\nO que você deseja fazer?",
        buttons: [{displayText: "Reiniciar Cadastro"}, {displayText: "Mudar meu Nome"}, {displayText: "Menu Principal"}]
      });
      return new Response("OK", { status: 200 });
    }

    if (normalizedMsg.includes("reiniciar cadastro")) {
      await supabase.from("user_preferences").delete().eq("whatsapp_user_id", waUser.id);
      await supabase.from("whatsapp_users").update({ full_name: null }).eq("id", waUser.id);
      await whatsappService.sendText({ number: phone, text: "Cadastro reiniciado! Digite 'Oi' para recomeçar." });
      return new Response("OK", { status: 200 });
    }

    // ====== 🎤 ÁUDIO ======
    if (isAudio && audioId) {
      await whatsappService.sendText({ number: phone, text: "🙏 Ouvindo sua intenção..." });
      const audioBase64 = await whatsappService.downloadMedia(audioId);
      if (audioBase64) {
        const prayer = await generatePersonalizedPrayer(audioBase64, (message as any).audioMimeType);
        await whatsappService.sendText({ number: phone, text: prayer });
      }
      return new Response("OK", { status: 200 });
    }

    // ====== 👋 SAUDAÇÕES E MENU ======
    const greetings = ["menu", "oi", "ola", "olá", "inicio", "ajuda"];
    if (greetings.some(g => normalizedMsg.includes(g)) || buttonId.includes("menu")) {
      await sendMainMenu(phone, waUser);
      return new Response("OK", { status: 200 });
    }

    // Fluxo Padrão: IA Espiritual
    const context = `Nome: ${waUser.full_name || "Amigo"}. Objetivo: ${prefs.spiritual_goal || ""}.`;
    const aiResponse = await generateSpiritualResponse(messageText, context);
    const responseText = aiResponse.text || aiResponse;
    const responseButtons = aiResponse.buttons || [];

    if (responseButtons.length > 0) {
      await whatsappService.sendButtons({
        number: phone,
        text: responseText,
        buttons: responseButtons.map((b: string) => ({ displayText: b.substring(0, 20) }))
      });
    } else {
      await whatsappService.sendText({ number: phone, text: responseText });
    }

    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("Erro:", err);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});

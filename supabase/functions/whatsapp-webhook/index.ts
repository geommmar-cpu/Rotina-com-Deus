import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { whatsappService } from "./services/whatsapp-service.ts";
import { generateSpiritualResponse, generatePersonalizedPrayer, transcribeAudio, generateSpecialPeriodDay } from "./services/ai-service.ts";
import { getDailyLiturgy } from "./services/liturgy-service.ts";
import { getBible365Content } from "./services/bible-service.ts";
import { getMysteryOfDay, getNextRosaryStep } from "./services/prayer-service.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-simulator',
};

// --- HELPERS ---

async function sendMainMenu(phone: string, waUser: any) {
  const menuText = `🙏 *Menu Principal*\n\n1️⃣ - Minha Rotina de Hoje\n2️⃣ - Orações Especiais\n3️⃣ - Terço (Passo a Passo)\n4️⃣ - Dúvidas / Suporte\n\n👉 *DIGITE O NÚMERO DA OPÇÃO*`;
  await whatsappService.sendText({ number: phone, text: menuText });
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

// Helper para executar tarefas em segundo plano de forma ordenada e segura
function queueBackgroundTasks(ctx: any, tasks: (() => Promise<any>)[]) {
  // @ts-ignore: EdgeRuntime is available in Supabase
  if (typeof EdgeRuntime !== "undefined") {
    // @ts-ignore
    EdgeRuntime.waitUntil((async () => {
      for (const task of tasks) {
        try { await task(); } catch (e) { console.error("❌ Erro em tarefa de background:", e); }
      }
    })());
  } else {
    // Fallback para desenvolvimento local
    (async () => {
      for (const task of tasks) {
        try { await task(); } catch (e) { console.error("❌ Erro em tarefa de background (Local):", e); }
      }
    })();
  }
}

// --- MAIN SERVE ---

serve(async (req, ctx) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const isSimulator = req.headers.get("x-simulator") === "true";
    if (isSimulator) { whatsappService.isSimulator = true; whatsappService.simulatorMessages = []; }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log(`🚀 [WEBHOOK] Recebendo requisição. URL Config: ${supabaseUrl ? "✅" : "❌"} | Key Config: ${supabaseKey ? "✅" : "❌"}`);

    if (!supabaseUrl || !supabaseKey) {
      console.error("🔥 ERRO CRÍTICO: Variáveis do Supabase (URL/KEY) estão faltando!");
    }

    // 1. Carregar configuração ativa do banco (Failover)
    const loadSuccess = await whatsappService.loadActiveInstance();
    if (!loadSuccess) {
      console.warn("⚠️ Fallback: Não foi possível carregar instâncias do banco. Usando Env Vars.");
    }

    const payload = await req.json();
    const event = (payload.event || "").toLowerCase();
    const instance = payload.instance || "unknown";
    const msgId = payload.data?.key?.id;
    
    console.log(`📡 [EVO] Evento recebido: ${event} | ID: ${msgId} | Instância: ${instance}`);
    
    // Idempotência: Evita processar a mesma mensagem duas vezes
    if (msgId) {
      const { error: lockError } = await supabase
        .from("processed_messages")
        .insert({ id: msgId });
      
      if (lockError) {
        if (lockError.code === '23505') {
          console.warn(`⏩ [IDEM] Mensagem ${msgId} já processada. Ignorando duplicata.`);
          return new Response("OK", { status: 200 });
        }
        console.error("⚠️ [IDEM] Erro ao verificar idempotência (tabela existe?):", lockError.message);
      }
    }

    if (!isSimulator && event !== "messages.upsert") {
      console.log(`⏩ Evento ${event} ignorado.`);
      return new Response("OK", { status: 200 });
    }

    const data = payload.data;
    const messageData = isSimulator ? null : data;
    if (messageData?.key?.fromMe) {
        console.log("⏩ Mensagem enviada pelo próprio bot (fromMe). Ignorando.");
        return new Response("OK", { status: 200 });
    }

    const normalizePhone = (p: string) => {
      let raw = p.replace(/\D/g, "");
      // Remove o prefixo 55 se vier com ele para facilitar a lógica de 9º dígito
      let clean = raw.startsWith("55") ? raw.substring(2) : raw;
      
      // Se tiver 11 dígitos, é celular com 9º dígito. Se tiver 10, é sem 9º dígito
      if (clean.length === 11) {
        // Formato: DDD + 9 + 8 dígitos. Removemos o 9 (posição 2) se for necessário normalizar
        // Mas para a whitelist, vamos aceitar os dois formatos no adminWhitelist
      }
      
      // Retorna com o 55 de volta de forma padronizada
      return "55" + clean;
    };

    const phone = (messageData?.key?.remoteJid || "").replace("@s.whatsapp.net", "").replace("@c.us", "");
    const normalizedPhone = normalizePhone(phone);
    console.log(`📩 [EVO] Mensagem de ${phone} (Normalizado: ${normalizedPhone})`);
    
    let messageText = "";
    let buttonId = "";
    let isAudio = false;
    let audioMessageId = "";

    if (isSimulator) {
      const simMsg = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (simMsg?.type === "text") messageText = simMsg.text?.body || "";
      else if (simMsg?.type === "interactive") {
        messageText = simMsg.interactive?.button_reply?.title || simMsg.interactive?.list_reply?.title || "";
        buttonId = simMsg.interactive?.button_reply?.id || simMsg.interactive?.list_reply?.id || "";
      }
    } else {
      const msg = messageData?.message;
      if (msg?.conversation) messageText = msg.conversation;
      else if (msg?.extendedTextMessage?.text) messageText = msg.extendedTextMessage.text;
      else if (msg?.buttonsResponseMessage) {
        messageText = msg.buttonsResponseMessage.selectedDisplayText || "";
        buttonId = msg.buttonsResponseMessage.selectedButtonId || "";
      } else if (msg?.listResponseMessage) {
        messageText = msg.listResponseMessage.title || "";
        buttonId = msg.listResponseMessage.singleSelectReply?.selectedRowId || msg.listResponseMessage.rowId || "";
      } else if (msg?.audioMessage) {
        isAudio = true;
        audioMessageId = messageData?.key?.id || "";
      } else if (msg?.pollUpdateMessage) messageText = "Menu Principal"; 
    }

    // Busca o usuário tentando correspondência exata ou normalizada (mais robusto que .single())
    const { data: users } = await supabase.from("whatsapp_users")
      .select("*, user_preferences(*), user_progress(*)")
      .or(`phone_number.eq.${phone},phone_number.eq.${normalizedPhone}`)
      .order('created_at', { ascending: false })
      .limit(1);

    let waUser = users && users.length > 0 ? users[0] : null;

    if (waUser && waUser.user_id) {
      const { data: profile } = await supabase.from("profiles")
        .select("subscription_status").eq("id", waUser.user_id).single();
      waUser.profile = profile;
    }

    if (!waUser) {
      console.log(`🆕 Novo usuário detectado: ${phone}. Criando no banco...`);
      const { data: newUser, error: insertError } = await supabase.from("whatsapp_users").insert({ phone_number: phone }).select().single();
      if (insertError) {
        console.error("❌ Erro ao inserir usuário:", insertError.message);
        if (insertError.code === '23505') {
          const { data: retryUser } = await supabase.from("whatsapp_users").select("*").eq("phone_number", phone).single();
          waUser = retryUser;
        } else return new Response("OK", { status: 200 });
      } else waUser = newUser;

      if (waUser && !waUser.full_name) {
        console.log("🗣️ Solicitando nome do novo usuário...");
        await whatsappService.sendText({ number: phone, text: "Bem-vindo ao *Rotina com Deus*! 🙏\n\nComo você prefere ser chamado(a)?" });
        return new Response("OK", { status: 200 });
      }
    }

    if (!waUser.full_name) {
      await supabase.from("whatsapp_users").update({ full_name: messageText }).eq("id", waUser.id);
      await whatsappService.sendText({ number: phone, text: `Prazer em te conhecer, *${messageText}*! ✨` });
      await sleep(500);
      await sendMainMenu(phone, { ...waUser, full_name: messageText });
      await supabase.from("user_preferences").insert({ whatsapp_user_id: waUser.id });
      return new Response("OK", { status: 200 });
    }

    const userProgress = waUser.user_progress?.[0];
    const userProfile = waUser.profile;

    const isProfileSubActive = userProfile?.subscription_status === "active" || userProfile?.subscription_status === "trial";
    const isDirectSubActive = waUser.subscription_status === "active" || waUser.subscription_status === "trial";
    const isSubscriptionActive = isProfileSubActive || isDirectSubActive;
    const normalizedMsg = messageText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const adminWhitelist = [
      "55618416939", 
      "556184585912", 
      "556139841693", 
      "55619220401", 
      "556195773473",
      "5561999220401", // Seu número completo
      "556199220401"   // Seu número normalizado (sem um 9)
    ];
    const isSpecialAdmin = adminWhitelist.includes(normalizedPhone) || adminWhitelist.includes(phone);
    console.log(`👤 Usuário: ${phone} | Normalizado: ${normalizedPhone} | Admin: ${isSpecialAdmin}`);

    if ((phone === "5561999220401" || phone === "556195773473") && (!waUser.user_id || !userProgress)) {
      await whatsappService.sendText({ number: phone, text: `Olá, Débora! ✨ Você é muito especial para o Geomar e ele pediu para te dizer que **te ama muito!** Que o seu caminho com Deus seja abençoado e que este bot te ajude a estar sempre próxima de Suas graças. 🙏` });
      await sleep(1000);
    }

    // Paywall
    if (!isSubscriptionActive && !isSpecialAdmin) {
      if (normalizedMsg === "1") {
        console.log("💳 [PAYWALL] Usuário escolheu ver planos.");
        const plansText = `⭐ *Escolha seu plano e ative agora:* \n\n🔹 *Plano Anual*: R$ 97,00\n🔗 https://checkout.nexano.com.br/checkout/cmnxk2hue03sb1ymt5aqismsd?offer=GQ4X0T5\n\n🔹 *Plano Semestral*: R$ 79,00\n🔗 https://checkout.nexano.com.br/checkout/cmnxk2hue03sb1ymt5aqismsd?offer=TMMWDKA\n\n🔹 *Plano Mensal*: R$ 14,90\n🔗 https://checkout.nexano.com.br/checkout/cmnxk2hue03sb1ymt5aqismsd?offer=ZDR0L7X\n\n🛡️ *Garantia Incondicional de 7 dias.*`;
        await whatsappService.sendText({ number: phone, text: plansText });
        return new Response("OK", { status: 200 });
      }
      if (normalizedMsg === "2") {
        await whatsappService.sendText({ number: phone, text: "🙌 *Suporte Rotina com Deus*\n\nPrecisa de ajuda com sua assinatura ou tem alguma dúvida? Fale conosco por aqui ou envie um e-mail para suporte@rotinacomdeus.com.br" });
        return new Response("OK", { status: 200 });
      }
      const renewText = `🙏 Olá! Percebi que sua jornada no *Rotina com Deus* ainda não foi ativada ou sua assinatura expirou.\n\nPara continuar recebendo as orações diárias, você pode renovar seu acesso.\n\n1️⃣ - ⭐ *Renovação Premium*\n2️⃣ - Dúvidas / Suporte\n\n👉 *DIGITE O NÚMERO DA OPÇÃO*`;
      await whatsappService.sendText({ number: phone, text: renewText });
      return new Response("OK", { status: 200 });
    }

    // Gatilhos
    const isMenuTrigger = normalizedMsg === "menu" || normalizedMsg === "menu principal" || normalizedMsg === "0" || normalizedMsg === "oi" || normalizedMsg === "ola" || normalizedMsg === "bom dia";
    const isInMainMenu = !userProgress?.last_prayer_type || userProgress?.last_prayer_type === "none" || userProgress?.last_prayer_type === "menu";
    const isRoutineTrigger = (isInMainMenu && normalizedMsg === "1") || normalizedMsg === "rotina de hoje";
    const isSpecialPrayersTrigger = (isInMainMenu && normalizedMsg === "2") || normalizedMsg === "oracoes especiais";
    const isTercoTrigger = (isInMainMenu && normalizedMsg === "3") || normalizedMsg === "terco";
    const isSupportTrigger = (isInMainMenu && normalizedMsg === "4") || normalizedMsg === "suporte" || normalizedMsg === "duvidas";

    const isInSpecialPrayers = userProgress?.last_prayer_type === "special_prayers";
    const isSaoJoseTrigger = (isInSpecialPrayers && normalizedMsg === "1");
    const isSaoMiguelTrigger = (isInSpecialPrayers && normalizedMsg === "2");
    
    // --- LÓGICA DE ROTINA ---
    if (isRoutineTrigger) {
      await saveProgress(waUser.id, { last_prayer_type: null, last_prayer_step: 0 });
      await whatsappService.sendText({ number: phone, text: "🚀 Preparando sua rotina premium... 🙏" });
      
      const now = new Date(); 
      // Ajuste para Horário de Brasília (UTC-3)
      const nowBrasilia = new Date(now.getTime() - (3 * 60 * 60 * 1000));
      const todayStr = nowBrasilia.toISOString().split('T')[0];

      const liturgy = await getDailyLiturgy();
      if (liturgy) {
        await whatsappService.sendText({ number: phone, text: `📖 *${liturgy.title}*\n\n${liturgy.reflection}\n\n😇 *Santo:* ${liturgy.saint}` });
        await sleep(1000);
      }
      
      const lastReadAt = userProgress?.bible_last_read_at ? new Date(userProgress.bible_last_read_at) : null;
      let lastReadStr = "";
      if (lastReadAt) {
        const lastReadBrasilia = new Date(lastReadAt.getTime() - (3 * 60 * 60 * 1000));
        lastReadStr = lastReadBrasilia.toISOString().split('T')[0];
      }

      let currentDay = userProgress?.bible_365_day || 0;
      
      // Só incrementa se for um NOVO dia de leitura
      if (lastReadStr !== todayStr) {
        currentDay += 1;
      }
      
      const bibleContent = await getBible365Content(currentDay);
      await whatsappService.sendText({ number: phone, text: `✨ *Leitura do Dia ${currentDay}*\n\n${bibleContent}` });
      await sleep(1000);

      const encText = `🙏 *Glória a Deus!* Você completou sua jornada de hoje.\n\nAmém! 🙏 Que a paz de Cristo permaneça com você, *${waUser.full_name || ""}*. ✨`;
      await whatsappService.sendText({ number: phone, text: encText });
      
      // Salva progresso: atualiza o dia e a data da última leitura
      await saveProgress(waUser.id, { 
        bible_365_day: currentDay, 
        bible_last_read_at: now.toISOString(),
        last_prayer_type: "menu" 
      });
      await sleep(1500);
      await sendMainMenu(phone, waUser);
      return new Response("OK", { status: 200 });
    }

    // --- LÓGICA DO TERÇO ---
    if (isTercoTrigger) {
      const mystery = getMysteryOfDay(new Date());
      const firstStep = getNextRosaryStep(-1);
      const stepText = `✝️ *Terço - Mistérios ${mystery.name}*\n\n${firstStep!.text}`;
      
      await whatsappService.sendText({ number: phone, text: stepText });
      
      // Envio ordenado em background
      queueBackgroundTasks(ctx, [
        async () => { if (firstStep?.audioUrl) await whatsappService.sendAudio({ number: phone, audioUrl: firstStep.audioUrl }); },
        async () => { await whatsappService.sendText({ number: phone, text: "👉 *DIGITE 1* - Para o próximo passo" }); }
      ]);

      await saveProgress(waUser.id, { last_prayer_type: "terco", last_prayer_step: firstStep!.id });
      return new Response("OK", { status: 200 });
    }

    if (userProgress?.last_prayer_type === "terco" && (normalizedMsg === "1" || normalizedMsg === "proximo" || buttonId === "terco_next")) {
      const next = getNextRosaryStep(userProgress.last_prayer_step || 0);
      if (next) {
        // Envia o texto principal
        await whatsappService.sendText({ number: phone, text: next.text });
        
        // No passo dos mistérios ou áudios longos, dá um feedback
        if (next.id > 0) {
          await whatsappService.sendText({ number: phone, text: "Aguarde um instante, estou preparando o áudio para você... 🎧" });
        }

        // Envia o áudio PRIORITARIAMENTE
        queueBackgroundTasks(ctx, [
          async () => { 
            if (next.audioUrl) {
              console.log(`🎵 [TERCO] Solicitando áudio: ${next.audioUrl}`);
              const res = await whatsappService.sendAudio({ number: phone, audioUrl: next.audioUrl });
              if (!res.success) console.error(`❌ [TERCO] Falha ao enviar áudio:`, res.error);
            }
          },
          async () => { 
            if (next.id < 3) { // Não envia instrução no último passo
              await sleep(4000); // Dá mais tempo para o áudio processar antes da instrução
              await whatsappService.sendText({ number: phone, text: "👉 *DIGITE 1* - Para o próximo passo" }); 
            } else {
              // PASSO FINAL: Salve Rainha enviada, agora volta ao menu
              await sleep(5000);
              await whatsappService.sendText({ 
                number: phone, 
                text: "🙏 *Terço Concluído!*\n\nQue a intercessão de Maria Santíssima te acompanhe.\n\n👉 *DIGITE 1* - Para voltar ao menu inicial" 
              });
              await sleep(1000);
              // Removemos o envio automático do menu para esperar o "1" do usuário, ou podemos manter os dois. 
              // O usuário pediu especificamente a instrução, então vamos manter o fluxo guiado.
              await supabase.from("user_progress").update({ last_prayer_type: null, last_prayer_step: 0 }).eq("user_id", waUser.id);
            }
          }
        ]);

        await saveProgress(waUser.id, { last_prayer_step: next.id });
      } else {
        await whatsappService.sendText({ number: phone, text: "🎉 Você concluiu o Terço! Que Deus te abençoe." });
        await sleep(1000);
        await saveProgress(waUser.id, { last_prayer_type: "menu", last_prayer_step: 0 });
        await sendMainMenu(phone, waUser);
      }
      return new Response("OK", { status: 200 });
    }

    // --- DIÁLOGOS E ORAÇÕES ---
    // Handler para o fim da rotina (Aceita "Amém" ou o número 1)
    if (normalizedMsg.includes("amem") || (userProgress?.last_prayer_type === "routine_end" && (normalizedMsg === "1" || normalizedMsg === "amem"))) {
      await whatsappService.sendText({ number: phone, text: "Amém! 🙏 Que a paz de Cristo permaneça com você, *" + (waUser.full_name || "") + "*." });
      await saveProgress(waUser.id, { last_prayer_type: "menu" });
      await sleep(500);
      await sendMainMenu(phone, waUser);
      return new Response("OK", { status: 200 });
    }

    if (isMenuTrigger) {
      await saveProgress(waUser.id, { last_prayer_type: "menu", last_prayer_step: 0 });
      await sendMainMenu(phone, waUser);
      return new Response("OK", { status: 200 });
    }

    if (isSpecialPrayersTrigger) {
      await saveProgress(waUser.id, { last_prayer_type: "special_prayers" });
      await whatsappService.sendText({ number: phone, text: `🙏 *Orações Especiais*\n\n1️⃣ - São José 🧔‍♂️\n2️⃣ - São Miguel 🗡️\n0️⃣ - Menu Principal\n\n👉 *DIGITE O NÚMERO*` });
      return new Response("OK", { status: 200 });
    }

    if (isSaoJoseTrigger || isSaoMiguelTrigger) {
      const isJose = isSaoJoseTrigger;
      const title = isJose ? "🧔‍♂️ *Oração a São José*" : "🗡️ *Oração a São Miguel Arcanjo*";
      const audio = isJose ? "oracao_sao_jose.mp3" : "oracao_sao_miguel.mp3";
      const conclusion = isJose ? "Que São José interceda por você! 🙏" : "São Miguel Arcanjo, defendei-nos no combate! 🗡️";

      await whatsappService.sendText({ number: phone, text: `${title}\n\nPreparando o áudio para você... 🙏` });
      
      queueBackgroundTasks(ctx, [
        async () => { await whatsappService.sendAudio({ number: phone, audioUrl: `https://rotina-com-deus.vercel.app/audios/${audio}` }); },
        async () => { await whatsappService.sendText({ number: phone, text: conclusion }); },
        async () => { await sleep(1500); await sendMainMenu(phone, waUser); }
      ]);

      await saveProgress(waUser.id, { last_prayer_type: "menu" });
      return new Response("OK", { status: 200 });
    }

    // --- SUPORTE ---
    if (isSupportTrigger) {
      const supportText = `🙌 *Suporte Rotina com Deus*\n\nPrecisa de ajuda com sua assinatura ou tem alguma dúvida? Fale conosco por aqui ou envie um e-mail para:\n\n📧 *contato.rotinacomdeus@gmail.com*\n\nEstamos à disposição para te ajudar! 🙏`;
      await whatsappService.sendText({ number: phone, text: supportText });
      await sleep(1000);
      await sendMainMenu(phone, waUser);
      return new Response("OK", { status: 200 });
    }

    // --- IA CONVERSACIONAL ---
    const aiRes = await generateSpiritualResponse(messageText, `Nome: ${waUser.full_name}, Tipo: ${userProgress?.last_prayer_type || "conversa"}`);
    const buttons = aiRes.buttons.slice(0, 2);
    let aiResponseText = aiRes.text + "\n\n";
    if (buttons.length > 0) {
      buttons.forEach((b: string, idx: number) => { aiResponseText += `${idx + 1}️⃣ - ${b}\n`; });
      aiResponseText += `\n👉 *DIGITE O NÚMERO* ou *0* para Menu`;
    }
    await whatsappService.sendText({ number: phone, text: aiResponseText });
    if (userProgress?.last_prayer_type === "reflection" || userProgress?.last_prayer_type === "intention") await saveProgress(waUser.id, { last_prayer_type: null });

    console.log(`✅ [WEBHOOK] Processo concluído com sucesso para ${phone}`);
    return new Response("OK", { status: 200 });
  } catch (err) { 
    console.error("🔥 [WEBHOOK] Erro fatal:", err);
    return new Response("Error", { status: 500 }); 
  }
});

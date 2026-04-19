import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { whatsappService } from "./services/whatsapp-service.ts";
import { generateSpiritualResponse } from "./services/ai-service.ts";
import { getDailyLiturgy } from "./services/liturgy-service.ts";
import { getBible365Content } from "./services/bible-service.ts";
import { getMysteryOfDay, getNextRosaryStep } from "./services/prayer-service.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-simulator",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Phone normalization ───────────────────────────────────────────────────
// Strips country code + removes the optional 9th digit so every Brazilian
// mobile number has a single canonical form: "55" + DDD + 8 digits.
function canonicalize(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits.startsWith("55") || digits.length < 12) return digits;
  const ddd = digits.slice(2, 4);
  const local = digits.slice(4); // 8 or 9 digits
  const body = local.length === 9 && local.startsWith("9") ? local.slice(1) : local;
  return "55" + ddd + body; // always 12 digits
}

// ─── User lookup – fetches ALL accounts matching any phone variant ─────────
async function findUser(phone: string) {
  const canonical = canonicalize(phone);
  const withNinth = canonical.slice(0, 4) + "9" + canonical.slice(4);

  const { data: allUsers } = await supabase
    .from("whatsapp_users")
    .select("id, full_name, phone_number, user_id, subscription_status, bot_state, bot_step, bot_started_at, bible_day, user_preferences(*)")
    .in("phone_number", [phone, canonical, withNinth])
    .order("created_at", { ascending: true }); // oldest = canonical account

  if (!allUsers || allUsers.length === 0) return null;

  const primary = allUsers[0];
  primary._allUserIds = allUsers.map((u: any) => u.id);
  return primary;
}

// ─── Save progress to ALL user IDs – updates whatsapp_users directly ──────
async function saveProgress(waUser: any, data: Record<string, unknown>) {
  // Map old keys to new columns
  const updateData: any = {};
  if (data.last_prayer_type !== undefined) updateData.bot_state = data.last_prayer_type;
  if (data.last_prayer_step !== undefined) updateData.bot_step = data.last_prayer_step;
  if (data.last_step_started_at !== undefined) updateData.bot_started_at = data.last_step_started_at;
  if (data.bible_365_day !== undefined) updateData.bible_day = data.bible_365_day;

  const userIds: string[] = waUser._allUserIds ?? [waUser.id];
  console.log(`💾 saveState | userIds=${JSON.stringify(userIds)} | state=${updateData.bot_state}`);

  for (const userId of userIds) {
    const { error } = await supabase
      .from("whatsapp_users")
      .update(updateData)
      .eq("id", userId);
    if (error) console.error(`❌ saveState error (${userId}):`, error.message);
  }
}


// ─── Menu ──────────────────────────────────────────────────────────────────
async function sendMainMenu(phone: string) {
  await whatsappService.sendText({
    number: phone,
    text: "🙏 *Menu Principal*\n\n1️⃣ - Minha Rotina de Hoje\n2️⃣ - Orações Especiais\n3️⃣ - Terço (Passo a Passo)\n4️⃣ - Dúvidas / Suporte\n\n👉 *DIGITE O NÚMERO DA OPÇÃO*",
  });
}

// ─── Background queue ──────────────────────────────────────────────────────
function background(tasks: (() => Promise<unknown>)[]) {
  const run = async () => {
    for (const t of tasks) {
      try { await t(); } catch (e) { console.error("background task error:", e); }
    }
  };
  // @ts-ignore EdgeRuntime exists in Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(run());
  else run();
}

// ─── Admin list ────────────────────────────────────────────────────────────
const ADMINS = new Set([
  "55618416939",
  "556184585912",
  "556139841693",
  "55619220401",
  "556195773473",
  "5561999220401",
  "556199220401",
]);

function isAdmin(phone: string): boolean {
  const c = canonicalize(phone);
  // Check both raw and canonical form, and also check if any admin number ends the same way
  return ADMINS.has(phone) || ADMINS.has(c) || [...ADMINS].some(a => phone.endsWith(a.slice(-8)) || c.endsWith(a.slice(-8)));
}

// ═══════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const isSimulator = req.headers.get("x-simulator") === "true";
    if (isSimulator) { whatsappService.isSimulator = true; whatsappService.simulatorMessages = []; }

    await whatsappService.loadActiveInstance();

    const payload = await req.json();
    const event: string = (payload.event || "").toLowerCase();
    const msgId: string | undefined = payload.data?.key?.id;

    console.log(`📡 evento=${event} id=${msgId}`);

    // ── Idempotency lock ──
    if (msgId) {
      const { error } = await supabase.from("processed_messages").insert({ id: msgId });
      if (error?.code === "23505") {
        console.log(`⏩ already processed ${msgId}`);
        return new Response("OK", { status: 200 });
      }
    }

    if (!isSimulator && event !== "messages.upsert")
      return new Response("OK", { status: 200 });

    const msgData = isSimulator ? null : payload.data;
    if (msgData?.key?.fromMe) return new Response("OK", { status: 200 });

    // ── Phone ──
    const rawPhone = (msgData?.key?.remoteJid ?? "")
      .replace("@s.whatsapp.net", "")
      .replace("@c.us", "");

    // ── Message text ──
    let messageText = "";
    let buttonId = "";

    if (isSimulator) {
      const m = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (m?.type === "text") messageText = m.text?.body ?? "";
      else if (m?.type === "interactive") {
        messageText = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
        buttonId = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? "";
      }
    } else {
      const msg = msgData?.message;
      if (msg?.conversation) messageText = msg.conversation;
      else if (msg?.extendedTextMessage?.text) messageText = msg.extendedTextMessage.text;
      else if (msg?.buttonsResponseMessage) {
        messageText = msg.buttonsResponseMessage.selectedDisplayText ?? "";
        buttonId = msg.buttonsResponseMessage.selectedButtonId ?? "";
      } else if (msg?.listResponseMessage) {
        messageText = msg.listResponseMessage.title ?? "";
        buttonId =
          msg.listResponseMessage.singleSelectReply?.selectedRowId ??
          msg.listResponseMessage.rowId ?? "";
      } else if (msg?.pollUpdateMessage) messageText = "menu";
    }

    if (!messageText && !buttonId) return new Response("OK", { status: 200 });

    const nm = messageText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const msgTypes = msgData?.message ? Object.keys(msgData.message).join(",") : "unknown";
    console.log(`📩 phone=${rawPhone} nm="${nm}" btnId="${buttonId}" types=${msgTypes}`);

    // ── Find or create user ──
    let waUser = await findUser(rawPhone);

    if (!waUser) {
      const { data: nu } = await supabase
        .from("whatsapp_users")
        .insert({ phone_number: rawPhone })
        .select()
        .single();
      waUser = nu;
      if (waUser && !waUser.full_name) {
        await whatsappService.sendText({
          number: rawPhone,
          text: "Bem-vindo ao *Rotina com Deus*! 🙏\n\nComo você prefere ser chamado(a)?",
        });
        return new Response("OK", { status: 200 });
      }
    }

    if (!waUser) return new Response("OK", { status: 200 });

    // ── Collect name if missing ──
    if (!waUser.full_name) {
      await supabase.from("whatsapp_users").update({ full_name: messageText }).eq("id", waUser.id);
      await whatsappService.sendText({ number: rawPhone, text: `Prazer, *${messageText}*! ✨` });
      await sleep(500);
      await sendMainMenu(rawPhone);
      await supabase.from("user_preferences").insert({ whatsapp_user_id: waUser.id });
      return new Response("OK", { status: 200 });
    }

    // ── State & subscription ──
    const progress: any = {
      last_prayer_type: waUser.bot_state,
      last_prayer_step: waUser.bot_step,
      last_step_started_at: waUser.bot_started_at,
      bible_365_day: waUser.bible_day
    };
    
    console.log(`📊 STATE | bot_state=${progress.last_prayer_type ?? 'NULL'} step=${progress.last_prayer_step ?? 'NULL'}`);
    const state: string = progress.last_prayer_type ?? "menu";

    // Subscription check
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", waUser.user_id)
      .single();

    const subActive =
      profile?.subscription_status === "active" ||
      profile?.subscription_status === "trial" ||
      waUser.subscription_status === "active" ||
      waUser.subscription_status === "trial";

    const admin = isAdmin(rawPhone);

    console.log(`👤 state=${state} admin=${admin} sub=${subActive}`);

    // ── Paywall ──
    if (!subActive && !admin) {
      if (nm === "1") {
        await whatsappService.sendText({
          number: rawPhone,
          text: "⭐ *Planos disponíveis:*\n\n🔹 Anual R$97 → https://checkout.nexano.com.br/checkout/cmnxk2hue03sb1ymt5aqismsd?offer=GQ4X0T5\n🔹 Semestral R$79 → https://checkout.nexano.com.br/checkout/cmnxk2hue03sb1ymt5aqismsd?offer=TMMWDKA\n🔹 Mensal R$14,90 → https://checkout.nexano.com.br/checkout/cmnxk2hue03sb1ymt5aqismsd?offer=ZDR0L7X\n\n🛡️ Garantia de 7 dias.",
        });
      } else if (nm === "2") {
        await whatsappService.sendText({
          number: rawPhone,
          text: "🙌 *Suporte Rotina com Deus*\n\nPrecisa de ajuda com sua assinatura ou tem alguma dúvida?\n\n📧 *contato.rotinacomdeus@gmail.com*\n\nEstamos à disposição! 🙏",
        });
      } else {
        await whatsappService.sendText({
          number: rawPhone,
          text: "🙏 Sua assinatura não está ativa.\n\n1️⃣ - Renovar acesso\n2️⃣ - Suporte\n\n👉 DIGITE O NÚMERO",
        });
      }

      return new Response("OK", { status: 200 });
    }

    // ══════════════════════════════════════════════════════════════
    // ROUTING — active states have ABSOLUTE priority over menu triggers
    // ══════════════════════════════════════════════════════════════
    console.log(`🔀 ROTEAMENTO | state='${state}' stepId=${progress?.last_prayer_step ?? 'null'} msg='${nm}'`);

    // ── MENU reset ──
    if (nm === "0" || nm === "menu" || nm === "oi" || nm === "ola") {
      await saveProgress(waUser, { last_prayer_type: "menu", last_prayer_step: 0 });
      await sendMainMenu(rawPhone);
      return new Response("OK", { status: 200 });
    }

    // nm command helpers – match digit, keyword, or full option title from list responses
    const isCmd1    = nm === "1" || nm.includes("rotina");
    const isCmd2    = nm === "2" || nm.includes("oracoes") || nm.includes("especiais");
    const isCmd3    = nm === "3" || nm === "terco" || nm.includes("terco");
    const isCmd4    = nm === "4" || nm.includes("suporte") || nm.includes("duvida");
    const isCmdAndar = nm === "1" || nm === "proximo" || buttonId === "terco_next";

    // ── TERCO state (priority 1) ──
    if (state === "terco") {
      if (!isCmdAndar) {
        // Not a valid rosary advance — gentle reminder
        await whatsappService.sendText({ number: rawPhone, text: "🙏 Você está no Terço.\n\n👉 *DIGITE 1* para continuar\n👉 *DIGITE 0* para o Menu" });
        return new Response("OK", { status: 200 });
      }

      const stepId: number = progress?.last_prayer_step ?? 0;

      // Time lock
      if (progress?.last_step_started_at && !admin) {
        const elapsed = (Date.now() - new Date(progress.last_step_started_at).getTime()) / 1000;
        const prevStep = getNextRosaryStep(stepId - 1);
        const dur = prevStep?.duration ?? 0;
        const minimum = dur - 20;
        if (elapsed < minimum) {
          const remaining = Math.ceil(minimum - elapsed);
          await whatsappService.sendText({ number: rawPhone, text: `🙏 *Ainda em oração...* Aguarde *${remaining}s* para avançar.` });
          return new Response("OK", { status: 200 });
        }
      }

      const next = getNextRosaryStep(stepId);
      if (!next) {
        await saveProgress(waUser, { last_prayer_type: "menu", last_prayer_step: 0 });
        await sendMainMenu(rawPhone);
        return new Response("OK", { status: 200 });
      }

      await whatsappService.sendText({ number: rawPhone, text: next.text });

      background([
        async () => {
          if (next.audioUrl) {
            await whatsappService.sendText({ number: rawPhone, text: "🎧 Preparando áudio..." });
            await whatsappService.sendAudio({ number: rawPhone, audioUrl: next.audioUrl });
          }
        },
        async () => {
          await sleep(4000);
          if (getNextRosaryStep(next.id)) {
            let promptText = "👉 *DIGITE 1* - Próximo mistério";
            if (next.id === 1) {
              promptText = "👉 *DIGITE 1* - Iniciar os ritos de introdução do Terço";
            } else if (next.id === 7) {
              promptText = "👉 *DIGITE 1* - Iniciar Salve Rainha";
            }
            await whatsappService.sendText({ number: rawPhone, text: promptText });
          } else {
            await whatsappService.sendText({ number: rawPhone, text: "🙏 *Terço Concluído!* Que Maria interceda por você.\n\n👉 *DIGITE 0* - Menu principal" });
            await saveProgress(waUser, { last_prayer_type: "menu", last_prayer_step: 0 });
          }
        },
      ]);

      await saveProgress(waUser, {
        last_prayer_step: next.id,
        last_step_started_at: new Date().toISOString(),
        last_prayer_type: "terco",
      });

      return new Response("OK", { status: 200 });
    }

    // ── ROUTINE end state ──
    if (state === "routine_end" && (nm === "1" || nm.includes("amem"))) {
      await saveProgress(waUser, { last_prayer_type: "menu" });
      await whatsappService.sendText({ number: rawPhone, text: "Amém! 🙏" });
      await sleep(500);
      await sendMainMenu(rawPhone);
      return new Response("OK", { status: 200 });
    }

    // ── SPECIAL PRAYERS state ──
    if (state === "special_prayers") {
      if (nm === "1" || nm.includes("jose")) {
        await whatsappService.sendText({ number: rawPhone, text: "🙏 *Oração a São José*\n\nOuça e reze com o coração." });
        background([
          async () => {
             await whatsappService.sendText({ number: rawPhone, text: "🎧 Preparando áudio..." });
             await whatsappService.sendAudio({ number: rawPhone, audioUrl: "https://rotina-com-deus.vercel.app/audios/oracao_sao_jose.mp3" });
          },
          async () => {
             await sleep(3000);
             await whatsappService.sendText({ number: rawPhone, text: "👉 *DIGITE 0* - Voltar ao Menu" });
          }
        ]);
        await saveProgress(waUser, { last_prayer_type: "menu" });
        return new Response("OK", { status: 200 });
      } else if (nm === "2" || nm.includes("miguel")) {
        await whatsappService.sendText({ number: rawPhone, text: "🙏 *Oração a São Miguel Arcanjo*\n\nOuça e reze com o coração." });
        background([
          async () => {
             await whatsappService.sendText({ number: rawPhone, text: "🎧 Preparando áudio..." });
             await whatsappService.sendAudio({ number: rawPhone, audioUrl: "https://rotina-com-deus.vercel.app/audios/oracao_sao_miguel.mp3" });
          },
          async () => {
             await sleep(3000);
             await whatsappService.sendText({ number: rawPhone, text: "👉 *DIGITE 0* - Voltar ao Menu" });
          }
        ]);
        await saveProgress(waUser, { last_prayer_type: "menu" });
        return new Response("OK", { status: 200 });
      } else {
         await saveProgress(waUser, { last_prayer_type: "menu" });
         await sendMainMenu(rawPhone);
         return new Response("OK", { status: 200 });
      }
    }

    // ── Menu triggers — ONLY fire when there is NO active prayer state ──
    const ACTIVE_STATES = new Set(["terco", "special_prayers", "routine_active"]);
    const canTriggerMenu = !ACTIVE_STATES.has(state);

    if (isCmd1 && canTriggerMenu) {
      await saveProgress(waUser, { last_prayer_type: "routine_active" });
      await whatsappService.sendText({ number: rawPhone, text: "🚀 Preparando sua rotina... 🙏" });

      const liturgy = await getDailyLiturgy();
      if (liturgy) {
        await whatsappService.sendText({ number: rawPhone, text: `📖 *${liturgy.title}*\n\n${liturgy.reflection}` });
        await sleep(1000);
      }

      const day = (progress?.bible_365_day ?? 0) + 1;
      const bible = await getBible365Content(day);
      await whatsappService.sendText({ number: rawPhone, text: `✨ *Leitura do Dia ${day}*\n\n${bible}` });
      await sleep(1000);

      await whatsappService.sendText({ number: rawPhone, text: `🙏 *Glória a Deus!* Jornada completa.\n\n👉 *DIGITE 0* - Menu` });
      await saveProgress(waUser, { bible_365_day: day, last_prayer_type: "routine_end" });
      return new Response("OK", { status: 200 });
    }

    if (isCmd3 && canTriggerMenu) {
      const mystery = getMysteryOfDay(new Date());
      const first = getNextRosaryStep(-1);
      if (!first) return new Response("OK", { status: 200 });

      await whatsappService.sendText({ number: rawPhone, text: `✝️ *Terço - Mistérios ${mystery.name}*\n\n${first.text}` });

      background([
        async () => {
          if (first.audioUrl) {
            await whatsappService.sendText({ number: rawPhone, text: "🎧 Preparando áudio..." });
            await whatsappService.sendAudio({ number: rawPhone, audioUrl: first.audioUrl });
          }
        },
        async () => {
          await sleep(4000);
          await whatsappService.sendText({ number: rawPhone, text: "👉 *DIGITE 1* - Próximo passo" });
        },
      ]);

      await saveProgress(waUser, {
        last_prayer_type: "terco",
        last_prayer_step: first.id,
        last_step_started_at: new Date().toISOString(),
      });
      return new Response("OK", { status: 200 });
    }

    if (isCmd2 && canTriggerMenu) {
      await saveProgress(waUser, { last_prayer_type: "special_prayers" });
      await whatsappService.sendText({
        number: rawPhone,
        text: "🙏 *Orações Especiais*\n\n1️⃣ - São José\n2️⃣ - São Miguel\n0️⃣ - Menu\n\n👉 DIGITE O NÚMERO",
      });
      return new Response("OK", { status: 200 });
    }

    if (isCmd4 && canTriggerMenu) {
      await whatsappService.sendText({
          number: rawPhone,
          text: "🙌 *Suporte Rotina com Deus*\n\nPrecisa de ajuda com sua assinatura ou tem alguma dúvida?\n\n📧 *contato.rotinacomdeus@gmail.com*\n\nEstamos à disposição! 🙏",
        });
      await sleep(500);
      await sendMainMenu(rawPhone);
      return new Response("OK", { status: 200 });
    }

    // ── Fallback: AI ──
    const aiRes = await generateSpiritualResponse(messageText, `Nome: ${waUser.full_name}`);
    await whatsappService.sendText({ number: rawPhone, text: aiRes.text });
    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("🔥 ERRO FATAL:", err);
    return new Response("Error", { status: 500 });
  }
});

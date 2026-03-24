import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateSpiritualResponse, generatePersonalizedPrayer } from "./services/ai-service.ts";
import { getOnboardingFlow, getNextRosaryStep, getMysteryOfDay } from "./services/prayer-service.ts";
import { getDailyLiturgy } from "./services/liturgy-service.ts";
import { whatsappService } from "./services/whatsapp-service.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-simulator',
};

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

    if (isAudio) {
      await whatsappService.sendText({ number: phone, text: "🙏 Recebi seu áudio. Um momento enquanto preparo nossa oração..." });
      
      const audioMessage = payload.data.message.audioMessage;
      // Simulação de obtenção de base64 (em produção, Evolution API envia ou requer fetch)
      // Aqui usamos um placeholder ou tentamos extrair se estiver no payload
      const audioData = audioMessage.url ? await fetchMedia(audioMessage.url) : ""; 
      
      if (audioData) {
        const prayer = await generatePersonalizedPrayer(audioData, audioMessage.mimetype, "Intenção Particular");
        await whatsappService.sendText({ number: phone, text: prayer });
      } else {
        await whatsappService.sendText({ number: phone, text: "Desculpe, não consegui processar seu áudio agora. Pode escrever sua intenção?" });
      }
      
      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Áudio processado", { status: 200 });
    }

    // Lógica de Botões do Terço
    if (messageText.includes("btn_") || messageText.toLowerCase().includes("próximo")) {
      const currentStep = userProgress?.last_prayer_step || 0;
      const nextStep = getNextRosaryStep(currentStep);

      if (nextStep) {
        await whatsappService.sendButtons({
          number: phone,
          text: nextStep.text,
          buttons: nextStep.buttons.map(b => ({ displayText: b }))
        });

        await supabase.from("user_progress").upsert({
          whatsapp_user_id: waUser.id,
          last_prayer_step: nextStep.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'whatsapp_user_id' });

        if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response("Passo do terço enviado", { status: 200 });
      }
    }

    if (messageText.toLowerCase().includes("liturgia")) {
      const liturgy = await getDailyLiturgy();
      if (liturgy) {
        await whatsappService.sendText({ 
          number: phone, 
          text: `📖 *Liturgia do Dia*\n\n*${liturgy.title}*\n\n${liturgy.reflection}\n\n🙏 *Santo do Dia: ${liturgy.saint}*` 
        });
        if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response("Liturgia enviada", { status: 200 });
      }
    }

    if (messageText.toLowerCase().includes("terço") || messageText.toLowerCase().includes("rosário")) {
      const mystery = getMysteryOfDay(new Date());
      const firstStep = getNextRosaryStep(-1); // Início
      
      await whatsappService.sendButtons({
        number: phone,
        text: `📿 *Terço Guiado*\n\nHoje contemplamos os *Mistérios ${mystery.name}*.\n\n${firstStep!.text}`,
        buttons: firstStep!.buttons.map(b => ({ displayText: b }))
      });

      await supabase.from("user_progress").upsert({
        whatsapp_user_id: waUser.id,
        last_prayer_step: 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'whatsapp_user_id' });

      if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response("Terço iniciado", { status: 200 });
    }

    const context = `Usuário: ${waUser.full_name || "Amigo"}. Hábito: ${waUser.user_preferences?.[0]?.prayer_habit || "N/A"}.`;
    const aiResponse = await generateSpiritualResponse(messageText, context);
    await whatsappService.sendText({ number: phone, text: aiResponse });

    await supabase.from("interaction_logs").insert({
      whatsapp_user_id: waUser.id,
      phone_number: phone,
      message_type: isAudio ? "audio" : "text",
      raw_message: messageText,
      ai_response: aiResponse,
      intent: "general"
    });

    if (isSimulator) return new Response(JSON.stringify({ messages: whatsappService.simulatorMessages }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response("Ok", { status: 200 });
  } catch (err) {
    console.error("Erro no processamento:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

async function fetchMedia(url: string): Promise<string> {
  // Em produção, aqui buscaria o arquivo da Evolution API e converteria para base64
  // Como não temos acesso externo real, retornamos vazio para segurança ou logamos
  console.log("Tentando buscar mídia:", url);
  return ""; 
}

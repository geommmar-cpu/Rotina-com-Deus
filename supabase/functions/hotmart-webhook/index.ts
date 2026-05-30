import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { whatsappService } from "../whatsapp-webhook/services/whatsapp-service.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const HOTMART_HOTTOK = Deno.env.get("HOTMART_HOTTOK") || "NBDuUhnNvCXjBXInL93FdkuwpTzg6o3056306";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hotmart-hottok',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method === 'GET') {
      return new Response("Hotmart Webhook Active", { status: 200 });
    }

    const bodyText = await req.text();
    if (!bodyText) {
      return new Response("Empty body received", { status: 400 });
    }

    const payload = JSON.parse(bodyText);
    const incomingToken = (req.headers.get('x-hotmart-hottok') || payload.hottok || "").trim();
    
    // 1. Validar Token de Segurança da Hotmart
    if (HOTMART_HOTTOK && incomingToken !== HOTMART_HOTTOK.trim()) {
      console.error(`❌ Token Hotmart Inválido! Recebido: ${incomingToken}`);
      return new Response("Unauthorized", { status: 401 });
    }

    console.log("📦 Hotmart Webhook Received Event:", payload.event);

    const event = payload.event;
    const data = payload.data;

    // Apenas processamos aprovações ou reembolsos
    if (event !== "PURCHASE_APPROVED" && event !== "PURCHASE_REFUNDED" && event !== "PURCHASE_CANCELED" && event !== "PURCHASE_CHARGEBACK") {
      console.log(`ℹ️ Ignorando evento não gerenciado: ${event}`);
      return new Response("Event ignored", { status: 200 });
    }

    const customerPhone = data?.buyer?.checkout_phone || data?.buyer?.phone;
    if (!customerPhone && event === "PURCHASE_APPROVED") {
      console.warn("⚠️ Sem telefone no payload do cliente na aprovação");
      return new Response("No phone provided", { status: 400 });
    }

    const customerName = data?.buyer?.name || "Abençoado(a)";

    // 2. Normalizar o telefone (E.164)
    let phone = customerPhone ? customerPhone.toString().replace(/\D/g, "") : "";
    if (phone && !phone.startsWith("55") && phone.length <= 11) phone = "55" + phone;

    // --- Tratamento de Cancelamentos / Reembolsos ---
    if (event === "PURCHASE_REFUNDED" || event === "PURCHASE_CANCELED" || event === "PURCHASE_CHARGEBACK") {
      if (phone) {
        console.log(`❌ Cancelando assinatura para ${phone} (Evento: ${event})`);
        
        const { data: waUser } = await supabase
          .from("whatsapp_users")
          .select("*")
          .eq("phone_number", phone)
          .single();

        if (waUser) {
          await supabase.from("whatsapp_users").update({
            subscription_status: "inactive"
          }).eq("id", waUser.id);

          if (waUser.user_id) {
            await supabase.from("profiles").update({
              subscription_status: "inactive"
            }).eq("id", waUser.user_id);
          }
        }
      }
      return new Response(JSON.stringify({ success: true, action: "cancelled" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- Tratamento de Compra Aprovada ---
    // 3. Determinar validade da assinatura baseada na oferta
    let validUntil = new Date();
    const offerCode = data?.purchase?.offer?.code?.toUpperCase() || "";
    const productName = data?.product?.name?.toLowerCase() || "";

    if (offerCode === "ANUAL" || productName.includes("anual") || productName.includes("yearly")) {
      validUntil.setFullYear(validUntil.getFullYear() + 1);
      console.log("📅 Plano ANUAL detectado");
    } else if (offerCode === "SEMESTRAL" || productName.includes("semestral")) {
      validUntil.setMonth(validUntil.getMonth() + 6);
      console.log("📅 Plano SEMESTRAL detectado");
    } else {
      validUntil.setMonth(validUntil.getMonth() + 1);
      console.log("📅 Plano MENSAL detectado (ou padrão)");
    }

    // 4. Atualizar ou Criar Usuário no Banco
    console.log(`✅ Ativando assinatura para ${phone} até ${validUntil.toISOString()}`);

    const { data: waUser, error: findError } = await supabase
      .from("whatsapp_users")
      .select("*")
      .eq("phone_number", phone)
      .single();

    if (findError && findError.code !== "PGRST116") {
      throw findError;
    }

    if (!waUser) {
      // Criar novo usuário
      await supabase.from("whatsapp_users").insert({
        phone_number: phone,
        full_name: customerName,
        subscription_status: "active",
        subscription_valid_until: validUntil.toISOString()
      });
    } else {
      // Atualizar existente
      await supabase.from("whatsapp_users").update({
        full_name: customerName,
        subscription_status: "active",
        subscription_valid_until: validUntil.toISOString()
      }).eq("id", waUser.id);

      // Sincronizar com profiles se houver vínculo
      if (waUser.user_id) {
        await supabase.from("profiles").update({
          subscription_status: "active",
          subscription_valid_until: validUntil.toISOString()
        }).eq("id", waUser.user_id);
      }
    }

    // 5. Enviar Mensagem de Boas-vindas via Evolution API
    try {
      await whatsappService.loadActiveInstance();
      
      const welcomeMessage = `✨ *Acesso Premium Liberado!* ✨\n\nOlá, *${customerName}*! Seu pagamento foi aprovado na Hotmart e sua jornada no *Rotina com Deus* foi ativada com sucesso. 🙏\n\nSua constância começa agora. Estamos muito felizes em ter você conosco!\n\nDigite *MENU* para ver as opções e iniciar sua caminhada!`;
      
      await whatsappService.sendText({
        number: phone,
        text: welcomeMessage
      });
      
      console.log(`✉️ Boas-vindas enviada para ${phone}`);
    } catch (msgError: any) {
      console.error("❌ Erro ao enviar mensagem de boas-vindas:", msgError.message);
      // Não falha a requisição do webhook se apenas a mensagem falhar
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("🔥 Hotmart Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

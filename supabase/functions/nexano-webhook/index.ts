import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { whatsappService } from "../whatsapp-webhook/services/whatsapp-service.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const NEXANO_WEBHOOK_TOKEN = Deno.env.get("NEXANO_WEBHOOK_TOKEN") || "";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method === 'GET') {
      return new Response("Nexano Webhook Active", { status: 200 });
    }

    const bodyText = await req.text();
    if (!bodyText) {
      return new Response("Empty body received", { status: 400 });
    }

    const payload = JSON.parse(bodyText);
    console.log("📦 Nexano Webhook Received:", JSON.stringify(payload, null, 2));

    const { event, token, offerCode, client, transaction } = payload;

    // 1. Validar Token de Segurança
    if (NEXANO_WEBHOOK_TOKEN && token !== NEXANO_WEBHOOK_TOKEN) {
      console.error("❌ Token Nexano Inválido!");
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Verificar se a transação foi completada
    if (transaction?.status !== "COMPLETED") {
      console.log(`ℹ️ Ignorando transação com status: ${transaction?.status}`);
      return new Response("Status ignored", { status: 200 });
    }

    const customerPhone = client?.phone;
    if (!customerPhone) {
      console.warn("⚠️ Sem telefone no payload do cliente");
      return new Response("No phone provided", { status: 400 });
    }

    const customerName = client?.name || "Abençoado(a)";

    // 3. Normalizar o telefone (E.164)
    let phone = customerPhone.toString().replace(/\D/g, "");
    if (!phone.startsWith("55")) phone = "55" + phone;

    // 4. Determinar validade da assinatura baseada no offerCode
    // Mensal: ZDR0L7X, Anual: GQ4X0T5, Semestral: TMMWDKA
    let validUntil = new Date();
    const code = offerCode?.toUpperCase();

    if (code === "GQ4X0T5") {
      validUntil.setFullYear(validUntil.getFullYear() + 1);
      console.log("📅 Plano ANUAL detectado");
    } else if (code === "TMMWDKA") {
      validUntil.setMonth(validUntil.getMonth() + 6);
      console.log("📅 Plano SEMESTRAL detectado");
    } else {
      validUntil.setMonth(validUntil.getMonth() + 1);
      console.log("📅 Plano MENSAL detectado (ou padrão)");
    }

    // 5. Atualizar ou Criar Usuário no Banco
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
        subscription_status: "active",
        subscription_valid_until: validUntil.toISOString()
      });
    } else {
      // Atualizar existente
      await supabase.from("whatsapp_users").update({
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

    // 6. Enviar Mensagem de Boas-vindas via Evolution API
    try {
      await whatsappService.loadActiveInstance();
      
      const welcomeMessage = `✨ *Acesso Premium Liberado!* ✨\n\nOlá, *${customerName}*! Sua jornada no *Rotina com Deus* foi ativada com sucesso. 🙏\n\nSua constância começa agora. Estamos muito felizes em ter você conosco!\n\nDigite *MENU* para ver as opções e iniciar sua caminhada!`;
      
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
    console.error("🔥 Nexano Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

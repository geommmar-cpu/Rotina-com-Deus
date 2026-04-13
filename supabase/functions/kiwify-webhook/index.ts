import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const WHATSAPP_API_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
const PHONE_NUMBER_ID = Deno.env.get("META_PHONE_NUMBER_ID") || "";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KIWIFY_SECRET = Deno.env.get("KIWIFY_SECRET") || "";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("X-Kiwify-Signature");

    // 🛡️ VERIFICAÇÃO DE ASSINATURA KIWIFY
    if (KIWIFY_SECRET && signature) {
      const hmac = crypto.subtle.importKey(
        "raw", new TextEncoder().encode(KIWIFY_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false, ["sign"]
      ).then(key => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)))
       .then(signed => Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, "0")).join(""));
      
      const computedSignature = await hmac;
      if (computedSignature !== signature) {
        console.error("❌ Assinatura Kiwify Inválida!");
        return new Response("Invalid signature", { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    console.log("📦 Kiwify Webhook Data:", JSON.stringify(payload));

    const { order_status, customer_mobile, product_name } = payload;
    
    if (!customer_mobile) {
      console.warn("⚠️ Sem número de celular no payload");
      return new Response("No mobile number provided", { status: 400 });
    }

    // Formata o número para padrão E.164
    let phone = customer_mobile.toString().replace(/\D/g, "");
    if (!phone.startsWith("55")) phone = "55" + phone;

    // 1. Busca usuário
    let { data: waUser } = await supabase.from("whatsapp_users").select("*").eq("phone_number", phone).single();

    if (!waUser) {
       const { data: newUser } = await supabase.from("whatsapp_users").insert({ phone_number: phone }).select().single();
       waUser = newUser;
    }

    // 2. Determina o Status da Assinatura
    const normalizedStatus = order_status?.toLowerCase();
    let subStatus = "expired";
    let validUntil = new Date();

    if (["approved", "paid"].includes(normalizedStatus)) {
        subStatus = "active";
        const lowerProd = product_name?.toLowerCase() || "";
        if (lowerProd.includes("anual")) {
            validUntil.setFullYear(validUntil.getFullYear() + 1);
        } else if (lowerProd.includes("semestral")) {
            validUntil.setMonth(validUntil.getMonth() + 6);
        } else {
            validUntil.setMonth(validUntil.getMonth() + 1);
        }
        console.log(`✅ Ativando: ${phone} até ${validUntil.toISOString()}`);
    } else if (["refunded", "chargedback", "expired"].includes(normalizedStatus)) {
        subStatus = "expired";
        validUntil = new Date(); // Expira agora
        console.log(`🚫 Bloqueando: ${phone} (Motivo: ${normalizedStatus})`);
    } else {
        return new Response(JSON.stringify({ success: true, message: "Status ignored" }), { status: 200, headers: corsHeaders });
    }

    // 3. Atualiza o Banco de Dados
    if (waUser?.id) {
        // Atualiza na whatsapp_users (Direto)
        await supabase.from("whatsapp_users").update({ 
            subscription_status: subStatus, 
            subscription_valid_until: validUntil.toISOString() 
        }).eq("id", waUser.id);

        // Sincroniza com profiles se existir
        if (waUser.user_id) {
            await supabase.from("profiles").update({ 
                subscription_status: subStatus, 
                subscription_valid_until: validUntil.toISOString() 
            }).eq("id", waUser.user_id);
        }

        // Envia mensagem se for aprovação
        if (subStatus === "active") {
            const welcomeMessage = `✨ *Acesso Premium Liberado!* ✨\n\nOlá! Sua jornada no *Rotina com Deus* foi ativada com sucesso.\n\nAgora você tem acesso ilimitado a todas as ferramentas. 🙏\n\nDigite *MENU* para começar agora.`;
            await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${WHATSAPP_API_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: welcomeMessage } })
            });
        }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("🔥 Kiwify Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

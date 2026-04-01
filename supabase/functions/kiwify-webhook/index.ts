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

    // 🛡️ VERIFICAÇÃO DE ASSINATURA (SG-PRO-MAX)
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
    } else if (KIWIFY_SECRET && !signature) {
       console.warn("⚠️ Webhook recebido sem assinatura, mas secret está configurada!");
       return new Response("Missing signature", { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    console.log("📦 Kiwify Webhook Approved & Validated:", JSON.stringify(payload));

    const { order_status, customer_mobile, customer_email, product_name } = payload;
    
    if (!customer_mobile) {
      console.warn("⚠️ Sem número de celular no payload");
      return new Response("No mobile number provided", { status: 400 });
    }

    // Formata o número (Kiwify costuma mandar com +55 ou apenas DDD)
    let phone = customer_mobile.toString().replace(/\D/g, "");
    if (!phone.startsWith("55")) phone = "55" + phone;

    // 1. Localiza o usuário do WhatsApp
    let { data: waUser } = await supabase
      .from("whatsapp_users")
      .select("id, full_name, user_id")
      .eq("phone_number", phone)
      .single();

    if (!waUser) {
       console.log("👤 Usuário não encontrado no WhatsApp:", phone, ". Criando base para ativação posterior...");
       // Criar apenas para ter o registro e ativar depois
       const { data: newUser } = await supabase.from("whatsapp_users").insert({ phone_number: phone }).select().single();
       waUser = newUser;
    }

    // 2. Atualiza o status da assinatura
    let status = "expired";
    let validUntil = new Date();

    if (["approved", "paid"].includes(order_status?.toLowerCase())) {
        status = "active";
        
        // Define data com base no produto
        const lowerProd = product_name?.toLowerCase() || "";
        if (lowerProd.includes("anual")) {
            validUntil.setFullYear(validUntil.getFullYear() + 1);
        } else if (lowerProd.includes("semestral")) {
            validUntil.setMonth(validUntil.getMonth() + 6);
        } else {
            validUntil.setMonth(validUntil.getMonth() + 1); // Mensal padrão
        }

        console.log(`✅ Ativando assinatura para: ${phone} até ${validUntil.toISOString()}`);

        if (waUser?.id) {
            // Se tiver user_id vinculado (profiles), atualiza lá
            if (waUser.user_id) {
               await supabase.from("profiles").update({ 
                    subscription_status: status, 
                    subscription_valid_until: validUntil.toISOString() 
               }).eq("id", waUser.user_id);
            }
            
            // Log de interação para histórico de pagamento
            await supabase.from("interaction_logs").insert({
                whatsapp_user_id: waUser.id,
                message_type: "system",
                raw_message: `Pagamento Kiwify: ${order_status}`,
                intent: "payment_activation"
            });
        }

        // 3. Envia mensagem de confirmação no WhatsApp
        const welcomeMessage = `✨ *Acesso Premium Liberado!* ✨\n\nOlá! Sua jornada no *Rotina com Deus* foi ativada com sucesso.\n\nAgora você tem acesso ilimitado a todas as ferramentas de oração e espiritualidade. 🙏\n\nQue Deus te abençoe! Digite *MENU* para começar agora.`;
        
        await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone,
                type: "text",
                text: { body: welcomeMessage }
            })
        });
    }

    return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("🔥 Error in Kiwify Webhook:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

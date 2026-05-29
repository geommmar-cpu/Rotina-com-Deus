import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Please provide SUPABASE_URL and SUPABASE_KEY environment variables.");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const usersToFix = [
  "556199960291", // 6199960291
  "556191149453"  // 61991149453
];

async function run() {
  for (const phone of usersToFix) {
    console.log(`Verificando/inserindo o número: ${phone}...`);
    
    // Tenta achar o usuário primeiro
    const { data: existing, error: err } = await supabase
      .from("whatsapp_users")
      .select("id")
      .eq("phone_number", phone)
      .single();

    if (existing) {
      console.log(`Usuário ${phone} já existe. Atualizando status...`);
      const { error: updateErr } = await supabase
        .from("whatsapp_users")
        .update({
          subscription_status: "active",
          subscription_valid_until: "2027-12-31T23:59:59Z"
        })
        .eq("id", existing.id);
      
      if (updateErr) console.error("Erro ao atualizar:", updateErr.message);
      else console.log("Atualizado com sucesso!");
    } else {
      console.log(`Usuário ${phone} não existe. Inserindo novo...`);
      const { error: insertErr } = await supabase
        .from("whatsapp_users")
        .insert({
          phone_number: phone,
          subscription_status: "active",
          subscription_valid_until: "2027-12-31T23:59:59Z"
        });
      
      if (insertErr) console.error("Erro ao inserir:", insertErr.message);
      else console.log("Inserido com sucesso!");
    }
  }
}

run();

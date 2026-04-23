import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://oyakfsvettzcwterqgom.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWtmc3ZldHR6Y3d0ZXJxZ29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4NzI4NywiZXhwIjoyMDg5ODYzMjg3fQ.8DLWZcjPiIVHCVifX3LEnb-zA5Cj-P7XOz5vAU_tWpA";

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const phone = "5561991149453";
  const name = "Débora";
  const validUntil = "2027-04-21T23:59:59Z";

  console.log(`Processing ${phone} - ${name}`);

  // 1. Update/Upsert User
  const { data: user, error: findError } = await supabase
    .from("whatsapp_users")
    .select("*")
    .eq("phone_number", phone)
    .single();

  if (findError && findError.code !== "PGRST116") {
      console.error("Error finding user:", findError);
      return;
  }

  if (!user) {
    console.log("Creating new user...");
    // Inserting without user_id since Nexano webhook does it too. 
    // This implies user_id might have a default or the NOT NULL was removed.
    const { error: insError } = await supabase.from("whatsapp_users").insert({
        phone_number: phone,
        full_name: name,
        subscription_status: "active",
        subscription_valid_until: validUntil
    });
    if (insError) {
        console.error("Insert error:", insError);
        // Fallback: If user_id is required, we might need to find a dummy one or handle it.
    } else {
        console.log("User created successfully.");
    }
  } else {
    console.log("Updating existing user...");
    const { error: updError } = await supabase.from("whatsapp_users").update({
        full_name: name,
        subscription_status: "active",
        subscription_valid_until: validUntil
    }).eq("phone_number", phone);
    if (updError) console.error("Update error:", updError);
    else console.log("User updated successfully.");
  }

  // 2. Fetch Evolution Credentials
  const { data: instance, error: instError } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("is_primary", true)
    .eq("status", "active")
    .single();

  if (instError || !instance) {
      console.error("Could not find active primary instance:", instError);
      return;
  }

  console.log(`Using instance: ${instance.instance_name} at ${instance.api_url}`);

  // 3. Send Messages
  const welcomeMsg = `✨ *Acesso Premium Liberado!* ✨\n\nOlá, *${name}*! Sua jornada no *Rotina com Deus* foi ativada com sucesso. 🙏\n\nSua constância começa agora. Estamos muito felizes em ter você conosco!\n\nDigite *MENU* para ver as opções e iniciar sua caminhada!`;
  
  const personalMsg = `🌹 *Uma mensagem especial do Geomar:* 🌹\n\nDébora, o Geomar pediu para te dizer que ele te ama muito. Você é a dona deste número e a dona do coração dele! ❤️✨\n\nQue sua caminhada com Deus seja leve e abençoada. Bem-vinda!`;

  async function sendMessage(text: string) {
      const url = `${instance.api_url}/message/sendText/${instance.instance_name}`;
      console.log(`Sending to ${url}...`);
      const res = await fetch(url, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "apikey": instance.api_key
          },
          body: JSON.stringify({
              number: phone,
              text: text
          })
      });
      return res.json();
  }

  console.log("Sending welcome message...");
  const res1 = await sendMessage(welcomeMsg);
  console.log("Welcome message result:", JSON.stringify(res1));

  console.log("Sending personal message...");
  const res2 = await sendMessage(personalMsg);
  console.log("Personal message result:", JSON.stringify(res2));
}

run();

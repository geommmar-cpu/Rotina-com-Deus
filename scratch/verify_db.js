
import { createClient } from '@supabase/supabase-js';

async function verifyDB() {
  const url = "https://oyakfsvettzcwterqgom.supabase.co";
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWtmc3ZldHR6Y3d0ZXJxZ29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4NzI4NywiZXhwIjoyMDg5ODYzMjg3fQ.8DLWZcjPiIVHCVifX3LEnb-zA5Cj-P7XOz5vAU_tWpA";
  const supabase = createClient(url, key);

  const phone = "5561999220401";
  console.log("🔍 Verificando status do usuário:", phone);

  const { data, error } = await supabase
    .from("whatsapp_users")
    .select("*")
    .eq("phone_number", phone)
    .single();

  if (error) {
    console.error("❌ Erro ao consultar banco:", error.message);
    return;
  }

  console.log("📊 Dados do Usuário:");
  console.log(JSON.stringify(data, null, 2));

  if (data.subscription_status === 'active') {
    console.log("✅ ASSINATURA ATIVA detectada no banco!");
  } else {
    console.log("❌ Assinatura NÃO está ativa.");
  }
}

verifyDB();

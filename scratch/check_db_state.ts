
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = "https://oyakfsvettzcwterqgom.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWtmc3ZldHR6Y3d0ZXJxZ29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4NzI4NywiZXhwIjoyMDg5ODYzMjg3fQ.8DLWZcjPiIVHCVifX3LEnb-zA5Cj-P7XOz5vAU_tWpA";
const supabase = createClient(url, key);

async function checkDB() {
  console.log("📊 Verificando estado do banco de dados...");
  
  const { data: instances, error: err1 } = await supabase.from("whatsapp_instances").select("*");
  console.log("🔹 Instâncias:", JSON.stringify(instances, null, 2));
  
  const { data: users, error: err2 } = await supabase.from("whatsapp_users").select("*").eq("phone_number", "5561999220401");
  console.log("👤 Usuário Admin (...220401):", JSON.stringify(users, null, 2));
}

checkDB();

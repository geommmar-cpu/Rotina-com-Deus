
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

async function test() {
  console.log("🔍 Verificando instâncias no banco...");
  const { data, error } = await supabase.from("whatsapp_instances").select("*");
  if (error) {
    console.error("❌ Erro ao buscar instâncias:", error);
  } else {
    console.log("✅ Instâncias encontradas:", data);
  }

  const apiUrl = Deno.env.get("EVOLUTION_API_URL");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  console.log("🌐 Configurações de Ambiente:");
  console.log("- URL:", apiUrl ? "OK" : "MISSING");
  console.log("- Key:", apiKey ? "OK" : "MISSING");
  console.log("- Instance:", instanceName);

  if (apiUrl && apiKey && instanceName) {
    try {
      const res = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
        headers: { "apikey": apiKey }
      });
      const state = await res.json();
      console.log("🔌 Estado da Conexão Evolution API:", state);
    } catch (e) {
      console.error("❌ Erro ao conectar na Evolution API:", e.message);
    }
  }
}

test();

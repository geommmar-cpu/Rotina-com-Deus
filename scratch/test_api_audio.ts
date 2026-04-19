import { WhatsAppService } from "../supabase/functions/whatsapp-webhook/services/whatsapp-service.ts";

// Configurações manuais para o teste local (pegando do .env.local se possível)
const SUPABASE_URL = "https://oyakfsvettzcwterqgom.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "REDACTED"; 

async function test() {
  const service = new WhatsAppService();
  
  // Como não temos as envs, vamos mockar para teste direto na API do Evolution
  // @ts-ignore
  service.apiUrl = "https://evo.rotinacomdeus.online";
  // @ts-ignore
  service.apiKey = "REDACTED"; 
  // @ts-ignore
  service.instanceName = "rotina-principal";

  const target = "5561984585912"; // Número do usuário
  const audioUrl = "https://rotina-com-deus.vercel.app/audios/terco_misterios_gozosos_1.ogg";

  console.log("🚀 Enviando áudio de teste para:", target);
  console.log("🔗 URL:", audioUrl);

  const res = await service.sendAudio({ number: target, audioUrl });
  console.log("Resultado:", JSON.stringify(res, null, 2));
}

test();

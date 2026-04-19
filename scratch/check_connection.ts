import { WhatsAppService } from "../supabase/functions/whatsapp-webhook/services/whatsapp-service.ts";

async function test() {
  const service = new WhatsAppService();
  await service.loadActiveInstance();
  const state = await service.checkConnection();
  console.log("Instance State:", state);
}

test();


const url = "https://oyakfsvettzcwterqgom.supabase.co/functions/v1/whatsapp-health";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWtmc3ZldHR6Y3d0ZXJxZ29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4NzI4NywiZXhwIjoyMDg5ODYzMjg3fQ.8DLWZcjPiIVHCVifX3LEnb-zA5Cj-P7XOz5vAU_tWpA";

async function trigger() {
  console.log("🚀 Disparando Health Check para restaurar o Webhook...");
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      }
    });
    const data = await res.json();
    console.log("✅ Resposta do Health Check:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("❌ Erro ao disparar Health Check:", e.message);
  }
}

trigger();

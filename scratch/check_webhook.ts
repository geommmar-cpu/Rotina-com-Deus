
const apiUrl = "https://evo.rotinacomdeus.online";
const apiKey = "D4645C1C1645-420E-8553-62589098ADF2"; // Peguei de um log/arquivo anterior se disponível, senão usarei placeholder
const instanceName = "rotina-principal";

async function check() {
  console.log(`🔍 Verificando configurações de Webhook para ${instanceName}...`);
  try {
    const res = await fetch(`${apiUrl}/webhook/find/${instanceName}`, {
      headers: { "apikey": apiKey }
    });
    if (!res.ok) {
        console.error("❌ Erro ao buscar webhook:", await res.text());
        return;
    }
    const data = await res.json();
    console.log("✅ Configuração Atual do Webhook:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("❌ Falha crítica:", e.message);
  }
}

check();

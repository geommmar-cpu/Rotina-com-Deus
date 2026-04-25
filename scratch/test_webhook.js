
async function testWebhook() {
  const url = "https://oyakfsvettzcwterqgom.supabase.co/functions/v1/nexano-webhook";
  const payload = {
    event: "transaction.completed",
    token: "TOKEN_ERRADO",
    offerCode: "GQ4X0T5", // Anual
    client: {
      name: "Geomar Teste",
      phone: "5561999220401"
    },
    transaction: {
      status: "COMPLETED"
    }
  };

  console.log("🚀 Enviando payload para:", url);
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const status = response.status;
    const text = await response.text();

    console.log("📊 Status:", status);
    console.log("📄 Resposta:", text);

    if (status === 200) {
      console.log("✅ Webhook processado com sucesso!");
    } else if (status === 401) {
      console.log("❌ Erro de autenticação: Token necessário.");
    } else {
      console.log("⚠️ Resposta inesperada.");
    }
  } catch (error) {
    console.error("🔥 Erro na requisição:", error.message);
  }
}

testWebhook();

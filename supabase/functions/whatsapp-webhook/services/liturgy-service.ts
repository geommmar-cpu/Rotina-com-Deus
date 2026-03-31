import { generateLiturgyReflection, generateStructuredLiturgy } from "./ai-service.ts";

const CANCAO_NOVA_URL = "https://liturgia.cancaonova.com/pb/";

export async function getDailyLiturgy() {
  try {
    console.log("📡 Buscando liturgia na Canção Nova...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s pois scraping pode ser mais lento
    
    const response = await fetch(CANCAO_NOVA_URL, { 
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const html = await response.text();
    
    // Limpeza básica para não estourar o limite de tokens do prompt, focando na área de conteúdo
    const mainContent = html.split('id="liturgia-1"')[1]?.split('id="relacionados"')[0] || html.substring(0, 15000);
    
    console.log("🧬 Extraindo dados estruturados via IA...");
    const structuredData = await generateStructuredLiturgy(mainContent);

    if (!structuredData || !structuredData.evangelho) {
      throw new Error("Falha na extração estruturada da IA");
    }

    // Gerar reflexão baseada no que foi extraído
    const summary = `Título: ${structuredData.title}. Salmo: ${structuredData.salmo}. Evangelho: ${structuredData.evangelho.substring(0, 500)}.`;
    const reflection = await generateLiturgyReflection(summary);

    return {
      title: structuredData.title || "Liturgia do Dia",
      readings: structuredData,
      reflection: reflection,
      saint: structuredData.saint || "Santo do Dia"
    };

  } catch (error: any) {
    console.warn("⚠️ Falha total na busca de Liturgia, ativando Fallback Genérico:", error.message || error);
    
    // Fallback Final: Oração e Reflexão baseada no dia da semana para nunca deixar o usuário na mão
    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const todayName = days[new Date().getDay()];
    
    const fallbackPrompt = `
      Hoje é ${todayName}. O sistema de liturgia está temporariamente indisponível.
      Aja como "Rotina com Deus" e traga uma pequena palavra de conforto e uma oração curta (2 frases) para este dia da semana.
      
      Formato:
      📖 *Um Momento com Deus*
      
      [Sua palavra de conforto e oração]
    `;
    
    const reflection = await generateLiturgyReflection(fallbackPrompt);

    return {
      title: "📖 Momento de Paz",
      reflection: reflection,
      saint: "São José (Protetor das Famílias)"
    };
  }
}

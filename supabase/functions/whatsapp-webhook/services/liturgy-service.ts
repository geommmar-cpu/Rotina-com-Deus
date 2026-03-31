import { generateLiturgyReflection, generateStructuredLiturgy } from "./ai-service.ts";

const CANCAO_NOVA_URL = "https://liturgia.cancaonova.com/pb/";
const SECONDARY_API = "https://liturgiadiaria-com-br.vercel.app/api/v1/liturgia"; // API alternativa estável

export async function getDailyLiturgy() {
  try {
    // TENTATIVA 1: CANÇÃO NOVA (Scraping Inteligente)
    console.log("📡 TENTATIVA 1: Buscando na Canção Nova...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(CANCAO_NOVA_URL, { 
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const html = await response.text();
      
      if (html.includes("challenge-running") || html.length < 500) {
         console.warn("⚠️ Bloqueio detectado na Canção Nova.");
      } else {
        // Agora pegamos um pedaço muito maior e menos filtrado
        const mainContent = html.split('<div id="content"')[1]?.split('<footer')[0] || html.substring(0, 30000);
        
        console.log("🧬 Extraindo dados via Camada de IA (Tripla)...");
        const structuredData = await generateStructuredLiturgy(mainContent);

        if (structuredData && (structuredData.evangelho || structuredData.primeiraLeitura)) {
          const summary = `Título: ${structuredData.title}. Leituras: ${structuredData.primeiraLeitura?.substring(0,100)}. Evangelho: ${structuredData.evangelho?.substring(0,100)}.`;
          const reflection = await generateLiturgyReflection(summary);

          return {
            title: structuredData.title || "Liturgia do Dia",
            readings: structuredData,
            reflection: reflection,
            saint: structuredData.saint || "Santo do Dia"
          };
        }
      }
    }

    // TENTATIVA 2: API SECUNDÁRIA (Se a 1 falhar)
    console.log("📡 TENTATIVA 2: Buscando na API Secundária...");
    const resp2 = await fetch(SECONDARY_API);
    if (resp2.ok) {
      const data = await resp2.json();
      if (data && data.evangelho) {
        const summary = `Evangelho: ${data.evangelho.texto.substring(0, 200)}`;
        const reflection = await generateLiturgyReflection(summary);
        return {
          title: data.evangelho.titulo || "Liturgia do Dia",
          readings: data,
          reflection: reflection,
          saint: data.santoDoDia || "Santo do Dia"
        };
      }
    }

    throw new Error("Todas as fontes de liturgia falharam");

  } catch (error: any) {
    console.warn("⚠️ Falha total na liturgia:", error.message);
    
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
      title: "📖 Momento de Paz (Diagnóstico)",
      reflection: `${reflection}\n\n⚠️ Erro Técnico: ${error.message || "Desconhecido"}`,
      saint: "São José (Protetor das Famílias)"
    };
  }
}

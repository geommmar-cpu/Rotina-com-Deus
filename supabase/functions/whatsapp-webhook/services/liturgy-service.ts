import { generateLiturgyReflection, generateStructuredLiturgy } from "./ai-service.ts";

const CANCAO_NOVA_URL = "https://liturgia.cancaonova.com/pb/";
const SECONDARY_API = "https://liturgiadiaria-com-br.vercel.app/api/v1/liturgia";

export async function getDailyLiturgy() {
  try {
    // TENTATIVA 1: CANÇÃO NOVA (Scraping Inteligente por IDs)
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
      
      // Captura o Santo do Dia (Refinado: procura o rótulo e o título subsequente)
      let saintSearch = html.split('Santo do Dia:')[1]?.split('<')[0]?.trim();
      if (!saintSearch || saintSearch.length < 3) {
         saintSearch = html.split('<h1 class="entry-title">')[1]?.split('</h1>')[0]?.replace('Santo do dia:', '').trim() || "Santo do Dia";
      }

      // Captura as leituras (liturgia-1, 2, 4)
      const mainContent = html.split('id="liturgia-1"')[1]?.split('<footer')[0] || 
                         html.split('class="liturgia')[1]?.split('<footer')[0] ||
                         html.substring(0, 10000);
      
      // Limpeza profunda para economizar tokens
      const cleanContent = `SANTO: ${saintSearch}\n\n` + 
                           mainContent.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
                                      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "")
                                      .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gmi, "")
                                      .substring(0, 8000);
      
      console.log("🧬 Extraindo dados via Camada de IA (Tripla)...");
      const structuredData = await generateStructuredLiturgy(cleanContent);

      if (structuredData && (structuredData.evangelho || structuredData.primeiraLeitura)) {
        // Se a IA não encontrou o santo ou deu erro, usamos o nosso saintSearch manual
        if (!structuredData.saint || structuredData.saint.toLowerCase().includes("conferência")) {
            structuredData.saint = saintSearch;
        }

        const pLeitura = typeof structuredData.primeiraLeitura === 'string' ? structuredData.primeiraLeitura : (structuredData.primeiraLeitura?.texto || "");
        const evan = typeof structuredData.evangelho === 'string' ? structuredData.evangelho : (structuredData.evangelho?.texto || "");
        
        const summary = `Título: ${structuredData.title}. Leituras: ${pLeitura.substring(0,100)}. Evangelho: ${evan.substring(0,100)}.`;
        const reflection = await generateLiturgyReflection(summary);

        return {
          title: structuredData.title || "Liturgia do Dia",
          readings: structuredData,
          reflection: reflection,
          saint: structuredData.saint || saintSearch
        };
      }
    }

    // TENTATIVA 2: API SECUNDÁRIA
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
    
    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const todayName = days[new Date().getDay()];
    
    const reflection = await generateLiturgyReflection(`Hoje é ${todayName}. O sistema está em manutenção, traga calma e fé.`);

    return {
      title: "📖 Momento de Paz",
      reflection: `${reflection}`,
      saint: "São José"
    };
  }
}

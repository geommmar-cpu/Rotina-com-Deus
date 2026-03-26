import { generateLiturgyReflection } from "./ai-service.ts";

const LITURGY_API = "https://liturgiadiaria.site/api/v1/liturgia/";

export async function getDailyLiturgy() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(LITURGY_API, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("Falha ao buscar liturgia");
    }
    const data = await response.json();
    if (!data || !data.primeiraLeitura) throw new Error("API não retornou dados da primeira leitura");

    // Gerar reflexão via IA
    const summary = `Título: ${data.primeiraLeitura.titulo}. Salmo: ${data.salmo.refrao}. Evangelho: ${data.evangelho.titulo}.`;
    const reflection = await generateLiturgyReflection(summary);

    // Limpar o nome do santo se vier com tags HTML ou lixo
    const saintName = data.santoDoDia ? data.santoDoDia.replace(/<[^>]*>?/gm, '').trim() : "Santo do Dia";

    return {
      title: data.primeiraLeitura.titulo,
      readings: data,
      reflection: reflection,
      saint: saintName
    };
  } catch (error) {
    console.warn("Aviso: API de Liturgia falhou, ativando fallback de IA:", error);
    
    // Fallback: IA seleciona uma leitura do dia e cria a reflexão baseada nela dinamicamente
    const today = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date());
    const fallbackPrompt = `Hoje é ${today}. Escolha uma leitura bíblica curta (1 a 2 versículos) inspiradora e adequada para hoje. Formato esperado: "[Livro Capítulo:Versículo] - [Texto]". O usuário quer ler a Palavra do dia.`;
    
    const reflection = await generateLiturgyReflection(fallbackPrompt);

    return {
      title: "📖 A Palavra de Hoje",
      reflection: reflection,
      saint: "São José (Protetor das Famílias)"
    };
  }
}

import { generateLiturgyReflection } from "./ai-service.ts";

const LITURGY_API = "https://liturgiadiaria.site/api/v1/liturgia/";

export async function getDailyLiturgy() {
  const response = await fetch(LITURGY_API);
  if (!response.ok) {
    throw new Error("Falha ao buscar liturgia");
  }
  const data = await response.ok ? await response.json() : null;
  
  if (!data) return null;

  // Gerar reflexão via IA
  const summary = `Título: ${data.primeiraLeitura.titulo}. Salmo: ${data.salmo.refrao}. Evangelho: ${data.evangelho.titulo}.`;
  const reflection = await generateLiturgyReflection(summary);

  return {
    title: data.primeiraLeitura.titulo,
    readings: data,
    reflection: reflection,
    saint: data.santoDoDia
  };
}

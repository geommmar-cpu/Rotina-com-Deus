import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function getBible365Content(day: number) {
  const prompt = `
    Você é o "Rotina com Deus", um companheiro espiritual de WhatsApp calmo e acolhedor.
    O usuário está na jornada "Bíblia em 365 Dias" e hoje é o DIA ${day} de 365.

    Sua missão:
    1. Selecione um trecho bíblico (1 a 3 versículos) que seja inspirador e faça parte de uma sequência lógica de leitura da Bíblia (começando do Gênesis e percorrendo os grandes marcos da história da salvação ao longo dos 365 dias).
    2. No dia ${day}, em que ponto da história estaríamos? (Ex: Dia 1: Criação, Dia 50: Êxodo, Dia 200: Profetas, etc). Selecione um trecho condizente.
    3. Crie o conteúdo neste formato exato:

    📖 *Bíblia em 365 Dias - Dia ${day}*
    
    "[Texto do Versículo]"
    — [Livro Capítulo:Versículo]

    ✨ *Reflexão de hoje*
    [Escreva uma mensagem de até 3 frases que ajude o usuário a aplicar essa palavra na vida dele hoje, com foco em paz e espiritualidade.]

    NÃO DEVOLVA JSON. Retorne apenas o texto puro formatado como acima.
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error: any) {
    console.error(`Erro no Gemini (Bíblia 365 - Dia ${day}):`, error);
    return `📖 *Bíblia em 365 Dias - Dia ${day}*\n\n"O Senhor é meu pastor, nada me faltará."\n— Salmo 23:1\n\n✨ *Reflexão de hoje*\nConfie no cuidado de Deus para o seu dia. Ele guia seus passos com amor. 🙏`;
  }
}

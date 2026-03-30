import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function getBible365Content(day: number) {
  const prompt = `
    Você é o "Rotina com Deus", um companheiro espiritual de WhatsApp calmo e acolhedor.
    O usuário está na jornada "Bíblia em 365 Dias" e hoje é o DIA ${day} de 365.

    Sua missão:
    1. Selecione um trecho bíblico (1 a 3 versículos) que seja inspirador e faça parte de uma sequência lógica de leitura da Bíblia, percorrendo toda a história da salvação em 365 dias.
    2. Use este cronograma como referência para o Dia ${day}:
       - Dias 1-50: Gênesis e Êxodo (A Criação, Patriarcas e a Saída do Egito)
       - Dias 51-100: Deserto, Leis e Conquista (Levítico a Josué)
       - Dias 101-150: Juízes e o Reino Unido (Saul, Davi e Salomão)
       - Dias 151-200: Reino Dividido e Profetas Pré-Exílio
       - Dias 201-250: Exílio, Retorno e Sabedoria (Salmos, Provérbios, Eclesiastes)
       - Dias 251-300: Vida de Jesus (Evangelhos)
       - Dias 301-330: Atos dos Apóstolos e Início da Igreja
       - Dias 331-365: Epístolas e Apocalipse
    3. Crie o conteúdo neste formato exato (usando emojis):

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

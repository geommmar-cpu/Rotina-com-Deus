import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function getBible365Content(day: number) {
  const prompt = `
    Você é o "Rotina com Deus", um companheiro espiritual de WhatsApp calmo e acolhedor.
    O usuário está na jornada "Bíblia em 365 Dias" e hoje é o DIA ${day} de 365.

    Sua missão:
    1. Selecione um trecho bíblico (1 a 3 versículos) que seja inspirador e faça parte de uma sequência lógica de leitura da Bíblia Católica (73 livros), percorrendo toda a história da salvação em 365 dias. Inclua livros deuterocanônicos como Tobias, Judite, Sabedoria, Eclesiástico, Baruc e 1 e 2 Macabeus nos ciclos apropriados.
    2. Use este cronograma como referência para o Dia ${day}:
       - Dias 1-60: Gênesis, Jó e Êxodo (A Criação e a Aliança)
       - Dias 61-120: Deserto, Leis e Conquista (Levítico a Josué, incluindo Juízes e Rute)
       - Dias 121-170: O Reino e a Sabedoria (Samuel, Reis, Salmos, Provérbios, Eclesiástico e Sabedoria)
       - Dias 171-220: Profetas e os Livros de Tobias, Judite e Ester
       - Dias 221-250: Crônicas, Esdras, Neemias e 1 e 2 Macabeus (O Retorno e a Resistência)
       - Dias 251-300: Vida de Jesus (Evangelhos)
       - Dias 301-330: Atos dos Apóstolos e Epístolas Paulinas
       - Dias 331-365: Epístolas Católicas e Apocalipse
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

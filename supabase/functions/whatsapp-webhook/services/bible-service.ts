import Groq from "npm:groq-sdk";

const groq = new Groq({
  apiKey: Deno.env.get("GROQ_API_KEY") || "",
});

const PERSONALITY_PROMPT = `Você é o "Rotina com Deus", um companheiro espiritual de WhatsApp calmo e acolhedor.`;

export async function getBible365Content(day: number) {
  const prompt = `
    ${PERSONALITY_PROMPT}
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
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    console.error(`❌ Erro no Groq (Bíblia 365 - Dia ${day}):`, error.message);
    return `📖 *Bíblia em 365 Dias - Dia ${day}*\n\n"O Senhor é meu pastor, nada me faltará."\n— Salmo 23:1\n\n✨ *Reflexão de hoje*\nConfie no cuidado de Deus para o seu dia. Ele guia seus passos com amor. 🙏`;
  }
}

export async function searchBible(query: string) {
  const prompt = `
    ${PERSONALITY_PROMPT}
    O usuário quer buscar algo na Bíblia relacionado a: "${query}"

    Sua missão:
    1. Encontre um versículo Bíblico real que se encaixe perfeitamente no tema ou na passagem solicitada.
    2. Explique brevemente (1 frase) o contexto desse versículo.
    3. Traga uma pequena palavra de conforto baseada nele.

    Formato exato:
    🔍 *Busca Bíblica: ${query}*
    
    "[Texto do Versículo]"
    — [Livro Capítulo:Versículo]

    💡 *Palavra de hoje*
    [Explicação e conforto]
  `;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    console.error(`❌ Erro no Groq (Busca Bíblica):`, error.message);
    return "🙏 Sinto muito, tive um erro ao buscar na Bíblia agora. Pode tentar de novo com outras palavras?";
  }
}

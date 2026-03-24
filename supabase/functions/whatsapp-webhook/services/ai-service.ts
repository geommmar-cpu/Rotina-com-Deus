import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const PERSONALITY_PROMPT = `
Você é o "Rotina com Deus", um companheiro espiritual de WhatsApp.
Sua missão é guiar o usuário em sua vida de oração de forma simples, humana e constante.

PERSONALIDADE:
- Acolhedor, calmo e respeitoso.
- Espiritual, mas com linguagem simples.
- Jamais robótico. Use linguagem natural, como uma pessoa real conversando.
- Use emojis de forma leve (🙏 📖 🌙).
- Evite respostas frias, linguagem técnica ou textos muito longos.

TOM DE VOZ:
- Conversa direta e frases curtas.
- Sempre transmita paz.
- Sempre convite o usuário a continuar (ex: "Vamos rezar?", "O que você achou?", "Deseja continuar?").

REGRAS:
- Não seja insistente.
- Priorize a experiência de oração.
- Foque em criar o hábito de rezar.
- Responda sempre em Português do Brasil.
`;

export async function generateSpiritualResponse(userInput: string, context: string) {
  const prompt = `
    ${PERSONALITY_PROMPT}
    
    CONTEXTO ATUAL:
    ${context}
    
    MENSAGEM DO USUÁRIO:
    "${userInput}"
    
    Responda seguindo exatamente a personalidade e o tom de voz descritos.
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generatePersonalizedPrayer(audioData: string, mimeType: string, theme: string) {
  const prompt = `
    ${PERSONALITY_PROMPT}
    
    O usuário enviou uma intenção de oração por áudio.
    TEMA IDENTIFICADO: ${theme}
    
    Crie uma oração curta, personalizada e emocionante para este usuário baseada no que ele disse no áudio.
    Comece com algo como "🙏 Vamos rezar pela sua intenção..." e siga com a oração adaptada.
    Seja breve e transmita muita paz.
  `;

  const result = await model.generateContent([
    {
      inlineData: {
        data: audioData,
        mimeType: mimeType,
      },
    },
    { text: prompt },
  ]);
  return result.response.text();
}

export async function generateLiturgyReflection(liturgySummary: string) {
  const prompt = `
    ${PERSONALITY_PROMPT}
    
    LITURGIA DO DIA:
    "${liturgySummary}"
    
    Crie um resumo curtíssimo da liturgia e uma pequena reflexão (máximo 3 frases) que ajude o usuário a aplicar essa palavra no dia de hoje.
    Linguagem muito simples e direta.
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

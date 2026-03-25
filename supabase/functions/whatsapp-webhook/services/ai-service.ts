import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

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

MUITO IMPORTANTE:
Responda OBRIGATORIAMENTE com um objeto JSON válido. Use o campo "text" para a sua mensagem.
ATENÇÃO: Nunca dê um "Enter" ou quebra de linha literal dentro da mensagem! Para quebrar linhas, escreva obrigatoriamente "\\n" (duas barras mais n) no texto.
O campo "buttons" deve conter até 3 opções curtas.

Exemplo Exato:
{
  "text": "Que a paz de Deus ilumine sua tarde.\\n\\nQue tal um momento de oração agora?",
  "buttons": ["Vamos sim", "Agora não"]
}
NUNCA retorne texto fora da estrutura JSON.
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

  try {
    const result = await model.generateContent(prompt);
    let output = result.response.text();
    
    // Garantir que é um JSON parseável
    output = output.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    try {
      const parsed = JSON.parse(output);
      return parsed; // { text: string, buttons?: string[] }
    } catch (parseError) {
      // Fallback de segurança avançado com Regex se o JSON quebrar por causa de quebras de linha
      const textMatch = output.match(/"text"\s*:\s*"([\s\S]*?)"\s*(,|})/);
      const buttonsMatch = output.match(/"buttons"\s*:\s*\[(.*?)\]/);
      
      let fallbackText = "Aqui estou para guiar suas orações.";
      let fallbackButtons = ["Sim", "Não"];
      
      if (textMatch && textMatch[1]) {
        fallbackText = textMatch[1].replace(/\\n/g, '\n');
      }
      if (buttonsMatch && buttonsMatch[1]) {
        const btnTexts = buttonsMatch[1].split(',').map(b => b.trim().replace(/"/g, ''));
        if (btnTexts.length > 0 && btnTexts[0] !== '') fallbackButtons = btnTexts;
      }
      
      return { text: fallbackText, buttons: fallbackButtons };
    }
  } catch (error: any) {
    // Diagnóstico: Se o modelo falhar, vamos listar quais modelos esta chave EXATAMENTE permite.
    const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!apiKey) throw new Error("A chave GEMINI_API_KEY está vazia na nuvem.");
    
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();
    
    if (listData.models) {
      const availableModels = listData.models.map((m: any) => m.name).filter((m: string) => m.includes("gemini")).join(", ");
      throw new Error(`Erro: ${error.message}\nModelos liberados na sua chave do Google: ${availableModels}`);
    } else {
      throw new Error(`Erro: ${error.message}\n(Não foi possível listar, erro da API: ${JSON.stringify(listData)})`);
    }
  }
}

export async function generatePersonalizedPrayer(audioData: string, mimeType: string) {
  const prompt = `
    Você é o "Rotina com Deus", um companheiro espiritual calmo e empático.
    O usuário enviou uma mensagem de voz/áudio. Ouça a transcrição nativa da voz dele.

    Sua Tarefa EXCLUSIVA:
    1. Entenda profundamente a intenção, a dor, o agradecimento ou pedido do áudio.
    2. Responda ESTRITAMENTE com um texto neste formato exato (apenas substituindo os cochetes com empatia):

    "Recebi sua intenção 🙏
    
    Vamos rezar juntos...
    
    Senhor, olha por essa intenção...
    Tu conheces o coração dessa pessoa e sabes do que ela precisa.
    
    [Escreva 1 parágrafo curto, profundo e super empático orando especificamente pela causa que a pessoa falou. Peça força, paz e consolo para ela especificamente.]
    
    Derrama tua paz, tua força e tua presença nesse momento.
    
    Amém."

    REGRAS:
    - NUNCA dê uma resposta genérica. Cite fatos ou o sentimento que o usuário expressou no áudio.
    - Aja com MUITA empatia e afeto humano.
    - NÃO retorne em formato JSON. Retorne apenas o texto puro da mensagem de oração.
  `;

  try {
    const result = await model.generateContent([
      { inlineData: { data: audioData, mimeType: mimeType } },
      { text: prompt },
    ]);
    return result.response.text().trim();
  } catch (error: any) {
    console.error("Erro no Gemini Multimodal Audio:", error);
    return "🙏 Recebi sua intenção... mas algo deu errado ao ouvir seu áudio. Deus sabe o que vai no seu coração. Se quiser, pode me contar digitando!";
  }
}

export async function generateLiturgyReflection(liturgySummary: string) {
  const prompt = `
    Você é o "Rotina com Deus", um companheiro espiritual de WhatsApp.
    O usuário pediu a liturgia/palavra de hoje.
    
    CONTEÚDO BASE:
    "${liturgySummary}"
    
    Crie um texto PURO e SIMPLES contendo um curtíssimo resumo da palavra, seguido de uma pequena reflexão (máximo 3 frases) que ajude o usuário a aplicar isso no dia de hoje.
    Linguagem muito simples e direta.
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateSpecialPeriodDay(periodName: string, day: number) {
  const prompt = `
    Você é o "Rotina com Deus", um companheiro espiritual de WhatsApp calmo e acolhedor.
    O usuário está fazendo a jornada de 40 dias de "${periodName}" e hoje é o DIA ${day} de 40.

    Crie ESTRITAMENTE o conteúdo para hoje neste formato exato (usando emojis de forma leve):

    📖 *Reflexão do Dia ${day}*
    [Escreva uma meditação bonita e profunda sobre o tema desta jornada, com até 2 parágrafos curtos]

    🙌 *Prática Espiritual*
    [Dê uma sugestão prática e simples para o dia de hoje: ex. uma pequena privação, um ato de caridade, perdoar alguém ou uma oração rápida]

    NÃO DEVOLVA JSON. Retorne apenas o texto acima.
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error: any) {
    console.error(`Erro no Gemini (Periodo Especial - ${periodName}):`, error);
    return `✝️ *${periodName} - Dia ${day}*\n\nDeus abençoe sua jornada. Reserve um momento hoje para fazer uma oração silenciosa e praticar um pequeno ato de caridade. 🙏`;
  }
}

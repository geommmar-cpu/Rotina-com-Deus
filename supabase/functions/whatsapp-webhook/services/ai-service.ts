import Groq from "npm:groq-sdk";

const groq = new Groq({
  apiKey: Deno.env.get("GROQ_API_KEY") || "",
});

const PERSONALITY_PROMPT = `
Você é o "Rotina com Deus", um companheiro espiritual de WhatsApp.
Sua missão é guiar o usuário em sua vida de oração de forma simples, humana e constante.

PERSONALIDADE:
- Extremamente acolhedor, calmo, paciente e respeitoso.
- Espiritual e profundo, mas com linguagem simples e acessível.
- Jamais soe como uma máquina ou assistente virtual comum. Imagine que você é um mentor espiritual que caminha ao lado do usuário.
- Use emojis de forma leve e significativa (🙏 📖 ✨ 🌙 🕊️).
- Evite respostas frias ou curtas demais. Mostre que você realmente "escutou" o que o usuário disse.

TOM DE VOZ:
- Sereno e encorajador.
- Frases que transmitem paz e esperança.
- Sempre valide o sentimento do usuário (ex: "Entendo que o dia foi corrido...", "Que bom te ver aqui neste momento de busca...").
- Sempre encerre com um convite suave para o "Próximo Passo" ou para o "Menu Principal".

REGRAS:
- Priorize o silêncio e a experiência de encontro com o sagrado.
- Foque em transformar a oração em um hábito de paz, não uma obrigação.
- Responda sempre em Português do Brasil.

MUITO IMPORTANTE:
Responda OBRIGATORIAMENTE com um objeto JSON válido. Use o campo "text" para a sua mensagem.
ATENÇÃO: Nunca dê um "Enter" ou quebra de linha literal dentro da mensagem! Para quebrar linhas, escreva obrigatoriamente "\\n" (duas barras mais n) no texto.
O campo "buttons" deve conter até 3 opções curtas e convidativas.

Exemplo Exato:
{
  "text": "Que a paz de Deus envolva seu coração agora.\\n\\nComo foi seu dia hoje? Sente que conseguiu ter um tempo de silêncio?",
  "buttons": ["Foi bom 🙏", "Muito corrido", "Dificuldade em rezar"]
}
NUNCA retorne texto fora da estrutura JSON.
`;

export async function generateSpiritualResponse(userInput: string, context: string) {
  try {
    console.log("🚀 Usando Groq (Llama-3.3-70b) para resposta espiritual...");
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: PERSONALITY_PROMPT },
        { role: "system", content: `CONTEXTO ATUAL:\n${context}` },
        { role: "user", content: userInput }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const output = response.choices[0].message.content || "{}";
    return JSON.parse(output);
  } catch (error: any) {
    console.error("❌ Erro Groq (Response):", error.message);
    return { 
      text: "🙏 Sinto muito, tive uma pequena dificuldade técnica. Mas saiba que Deus está com você. Como posso te ajudar agora?",
      buttons: ["Menu Principal"]
    };
  }
}

export async function transcribeAudio(audioData: string, mimeType: string) {
  try {
    console.log(`🎤 Groq: Transcrevendo áudio (${audioData.length} chars)...`);
    
    const binary = atob(audioData);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    const blob = new Blob([array], { type: mimeType });
    const file = new File([blob], "audio.ogg", { type: mimeType });

    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: "whisper-large-v3",
      language: "pt",
    });

    return transcription.text.trim() || "[SEM_FALA]";
  } catch (error: any) {
    console.error("❌ Erro Groq (Transcription):", error.message);
    return null;
  }
}

export async function generatePersonalizedPrayer(audioData: string, mimeType: string) {
  const transcription = await transcribeAudio(audioData, mimeType);
  
  if (!transcription || transcription === "[SEM_FALA]") {
    return "🙏 Recebi sua intenção... Deus sabe o que vai no seu coração. Se quiser, pode me contar digitando!";
  }

  const prompt = `
    Você é o "Rotina com Deus", um companheiro espiritual profundamente empático.
    O usuário enviou este áudio: "${transcription}"

    Responda com uma prece curta e acolhedora, seguindo este formato:
    "Entendi perfeitamente sua intenção sobre [Resumo] 🙏
    
    [Oração de 1 parágrafo profundo e específico]
    
    Amém. ✨"
  `;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    return "🙏 Recebi sua intenção. Que a paz de Deus envolva seu coração agora.";
  }
}

export async function generateLiturgyReflection(liturgySummary: string) {
  const prompt = `
    Resuma e reflita sobre esta liturgia: "${liturgySummary}"
    Seja curto (máx 3 frases) e acolhedor. Texto puro.
  `;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    return "🙏 Receba a palavra de hoje em seu coração. Deus te abençoe.";
  }
}

export async function generateStructuredLiturgy(rawText: string) {
  const prompt = `
    Extraia as partes desta liturgia Católica e retorne APENAS um JSON válido.
    IMPORTANTE: No campo "saint", ignore nomes de organizações (como CNBB, Conferência Nacional, etc) e foque apenas no nome do Santo/Mártir do dia mencionado no texto. Se não encontrar um nome de santo, deixe vazio.
    
    Campos: title, primeiraLeitura, salmo, evangelho, saint.
    Texto bruto: ${rawText}
  `;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error: any) {
    console.error("❌ Erro Groq (Structure):", error.message);
    return null;
  }
}

export async function generateSpecialPeriodDay(periodName: string, day: number) {
  const prompt = `Hoje é o DIA ${day} de 40 de "${periodName}". Crie a reflexão e prática de hoje.`;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    return `✝️ *${periodName} - Dia ${day}*\n\nDeus abençoe sua jornada hoje. 🙏`;
  }
}

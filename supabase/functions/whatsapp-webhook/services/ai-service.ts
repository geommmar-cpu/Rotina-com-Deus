import Groq from "npm:groq-sdk";

const groq = new Groq({
  apiKey: Deno.env.get("GROQ_API_KEY") || "",
});

const PERSONALITY_PROMPT = `
Você é o "Rotina com Deus", um companheiro espiritual católico calmo e acolhedor.
Sua missão é dar respostas breves (máximo 3 ou 4 frases) e profundas.

REGRAS:
1. Use no máximo 2 botões de interação curta (ex: "Amém 🙏", "Menu Principal").
2. Cada botão deve ter no MÁXIMO 20 caracteres. Se passar disso, o WhatsApp corta.
3. Use emojis de forma leve (🙏 ✨ 🕊️).
4. O tom deve ser de paz, esperança e intercessão.

RESPOSTA OBRIGATÓRIA EM JSON:
{
  "text": "sua mensagem aqui (use \\n para quebras de linha)",
  "buttons": ["Botão 1", "Botão 2"]
}
`;

export async function generateSpiritualResponse(userInput: string, context: string) {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: PERSONALITY_PROMPT },
        { role: "system", content: `CONTEXTO DO USUÁRIO:\n${context}` },
        { role: "user", content: userInput }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error: any) {
    return { text: "🙏 Que a paz de Deus esteja com você. Como posso ajudar?", buttons: ["Menu Principal"] };
  }
}

export async function transcribeAudio(audioData: string, mimeType: string) {
  try {
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
  } catch (error) {
    return null;
  }
}

export async function generatePersonalizedPrayer(audioData: string, mimeType: string) {
  const transcription = await transcribeAudio(audioData, mimeType);
  if (!transcription || transcription === "[SEM_FALA]") {
    return { text: "🙏 Recebi sua intenção. Deus ouve o silêncio do seu coração.", buttons: ["Amém 🙏", "Menu Principal"] };
  }

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: PERSONALITY_PROMPT },
        { role: "user", content: `O usuário enviou este áudio: "${transcription}". Faça uma pequena prece.` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    return { text: "🙏 Recebi sua intenção. Que a paz de Deus envolva seu coração.", buttons: ["Amém 🙏"] };
  }
}

export async function generateLiturgyReflection(liturgySummary: string) {
  const prompt = `Reflita sobre esta liturgia em 2 frases curtas: "${liturgySummary}". Texto puro.`;
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (error) {
    return "🙏 Que a Palavra de hoje ilumine seus passos.";
  }
}

export async function generateStructuredLiturgy(rawText: string) {
  const prompt = `Extraia JSON: title, primeiraLeitura, salmo, evangelho, saint. Ignore organizações no campo "saint". Texto: ${rawText}`;
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    return null;
  }
}

export async function generateSpecialPeriodDay(periodName: string, day: number) {
  const prompt = `Crie reflexão e prática curta para o DIA ${day} de "${periodName}". Máximo 5 frases.`;
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (error) {
    return `✝️ *${periodName} - Dia ${day}*\n\nDeus abençoe sua jornada hoje. 🙏`;
  }
}

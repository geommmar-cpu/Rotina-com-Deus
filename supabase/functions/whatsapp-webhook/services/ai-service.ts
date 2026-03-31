import OpenAI from "npm:openai";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import Groq from "npm:groq-sdk";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY") || "",
});

const groq = new Groq({
  apiKey: Deno.env.get("GROQ_API_KEY") || "",
});

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") || "");
const geminiModel = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  safetySettings: [
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
  ]
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
  const messages = [
    { role: "system", content: PERSONALITY_PROMPT },
    { role: "system", content: `CONTEXTO ATUAL:\n${context}` },
    { role: "user", content: userInput }
  ];

  try {
    // 1ª OPÇÃO: GROQ (Rápido e Grátis)
    console.log("🚀 Usando Groq (Llama-3-70b) para resposta espiritual...");
    const response = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: messages as any,
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (groqError: any) {
    console.warn("⚠️ Groq falhou, tentando OpenAI...", groqError.message);
    try {
      // 2ª OPÇÃO: OPENAI
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages as any,
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      return JSON.parse(response.choices[0].message.content || "{}");
    } catch (openAiError: any) {
      console.warn("⚠️ OpenAI falhou, tentando Gemini...", openAiError.message);
      try {
        // 3ª OPÇÃO: GEMINI
        const prompt = `${PERSONALITY_PROMPT}\n\nCONTEXTO:\n${context}\n\nUSER:\n${userInput}`;
        const result = await geminiModel.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(text);
      } catch (geminiError: any) {
        console.error("❌ Todas as IAs falharam:", geminiError.message);
        return { text: "🙏 Sinto muito, tive uma pequena dificuldade. Mas Deus está com você. Como posso ajudar?", buttons: ["Menu"] };
      }
    }
  }
}

export async function transcribeAudio(audioData: string, mimeType: string) {
  const prompt = "Transcreva exatamente o que foi dito neste áudio em Português do Brasil. Retorne apenas o texto.";
  
  // Converter Base64 para Blob/File
  const binary = atob(audioData);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  const blob = new Blob([array], { type: mimeType });
  const file = new File([blob], "audio.ogg", { type: mimeType });

  try {
    // 1ª OPÇÃO: GROQ (Whisper-v3)
    console.log("🎤 Transcrevendo com Groq (Whisper-v3)...");
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: "whisper-large-v3",
      language: "pt",
    });
    return transcription.text.trim() || "[SEM_FALA]";
  } catch (groqError: any) {
    console.warn("⚠️ Groq Whisper falhou, tentando Gemini...", groqError.message);
    try {
      // 2ª OPÇÃO: GEMINI (Nativo)
      const result = await geminiModel.generateContent([
        { inlineData: { data: audioData, mimeType: "audio/ogg" } },
        { text: prompt },
      ]);
      return result.response.text().trim();
    } catch (geminiError: any) {
      console.warn("⚠️ Gemini falhou, tentando OpenAI...", geminiError.message);
      try {
        // 3ª OPÇÃO: OPENAI
        const transcription = await openai.audio.transcriptions.create({
          file: file,
          model: "whisper-1",
          language: "pt",
        });
        return transcription.text.trim() || "[SEM_FALA]";
      } catch (e: any) {
        console.error("❌ Falha total na transcrição:", e.message);
        return null;
      }
    }
  }
}

export async function generatePersonalizedPrayer(audioData: string, mimeType: string) {
  const transcription = await transcribeAudio(audioData, mimeType);
  
  if (!transcription || transcription === "[SEM_FALA]") {
    return "🙏 Recebi sua intenção... mas tive uma pequena dificuldade para ouvir o áudio por completo. Deus sabe o que vai no seu coração. Se quiser, pode me contar digitando!";
  }

  const prompt = `
    Você é o "Rotina com Deus", um companheiro espiritual calmo e profundamente empático.
    O usuário enviou uma mensagem de voz que foi transcrita como:
    "${transcription}"

    Sua Tarefa EXCLUSIVA:
    1. Sinta a intenção, a dor, o agradecimento ou o pedido do usuário baseado nessa transcrição.
    2. Responda ESTRITAMENTE com um texto de oração espontânea e acolhedora neste formato exato (sem colchetes):

    "Entendi perfeitamente sua intenção sobre [Resumo curtíssimo do que foi dito] 🙏
    
    Feche seus olhos por um instante... Vamos levar isso ao Senhor juntos.
    
    Pai Querido, olha para este filho(a) que Te busca agora...
    Tu conheces as profundezas da sua alma e as lutas que enfrenta.
    
    [Escreva 1 parágrafo profundo, poético e super empático orando especificamente pelo que a pessoa compartilhou na transcrição. Peça especificamente por paz, luz e a intervenção da Tua graça na situação citada.]
    
    Que a Tua presença envolva este coração e traga a quietude que ele tanto busca.
    
    Fica conosco, Senhor. Amém. ✨"

    REGRAS:
    - NUNCA seja genérico. Use elementos da fala do usuário para mostrar que ele foi verdadeiramente ouvido.
    - O texto deve ser restaurador, como um "abraço espiritual".
    - NÃO retorne em formato JSON. Use apenas o texto puro da prece.
  `;

  try {
    const response = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    console.warn("⚠️ Groq falhou na prece, tentando OpenAI ou Gemini...");
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
      });
      return response.choices[0].message.content?.trim() || "";
    } catch (e: any) {
      const result = await geminiModel.generateContent(prompt);
      return result.response.text().trim();
    }
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

  try {
    const response = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });
      return response.choices[0].message.content?.trim() || "";
    } catch (e: any) {
      const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        ]
      });
      return result.response.text();
    }
  }
}

export async function generateStructuredLiturgy(rawText: string) {
  const prompt = `
    Extraia as partes principais desta liturgia Católica e retorne APENAS um JSON válido.
    
    Campos:
    - title: Título/Data
    - primeiraLeitura: Texto
    - salmo: Refrão/Versos
    - evangelho: Texto
    - saint: Santo do dia

    JSON:
    {
      "title": "",
      "primeiraLeitura": "",
      "salmo": "",
      "evangelho": "",
      "saint": ""
    }

    TEXTO:
    ${rawText}
  `;

  try {
    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error: any) {
    try {
      const result = await geminiModel.generateContent(prompt);
      const text = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(text);
    } catch (e: any) {
      return null;
    }
  }
}

export async function generateSpecialPeriodDay(periodName: string, day: number) {
  const prompt = `
    Hoje é o DIA ${day} de 40 da jornada de "${periodName}".
    Crie o conteúdo (Reflexão e Prática Espiritual). Use emojis.
  `;

  try {
    const response = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    const result = await geminiModel.generateContent(prompt);
    return result.response.text().trim();
  }
}

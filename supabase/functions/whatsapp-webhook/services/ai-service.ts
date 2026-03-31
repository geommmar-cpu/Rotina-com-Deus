import OpenAI from "npm:openai";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY") || "",
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
    console.error("❌ Erro OpenAI (SpiritualResponse):", error.message || error);
    return { 
      text: "🙏 Sinto muito, tive uma pequena dificuldade para processar sua mensagem. Mas saiba que Deus está com você. Como posso te ajudar agora?",
      buttons: ["Menu Principal"]
    };
  }
}

export async function transcribeAudio(audioData: string, mimeType: string) {
  try {
    console.log(`🎤 Transcrevendo áudio com Whisper-1 (${audioData.length} chars)...`);
    
    // Converter Base64 para Blob para o OpenAI Whisper
    const binary = atob(audioData);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    const blob = new Blob([array], { type: mimeType });
    const file = new File([blob], "audio.ogg", { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "pt",
    });

    return transcription.text.trim() || "[SEM_FALA]";
  } catch (error: any) {
    console.error("❌ Erro na transcrição (Whisper):", error.message || error);
    return null;
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
    console.log(`✨ Gerando prece baseada na transcrição: "${transcription.substring(0, 50)}..."`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    console.error("❌ ERRO OpenAI (Gerando prece):", error.message || error);
    return "🙏 Recebi sua intenção... mas tive uma pequena dificuldade para processar a oração agora. Deus sabe o que vai no seu coração. Se quiser, pode me contar digitando!";
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    console.error("❌ Erro OpenAI (LiturgyReflection):", error.message || error);
    return "🙏 Receba a palavra de hoje em seu coração. Que Deus te dê discernimento e paz para caminhar com sabedoria.";
  }
}

export async function generateStructuredLiturgy(rawText: string) {
  const prompt = `
    Abaixo está o texto bruto extraído de um site de liturgia Católica.
    Extraia as partes principais e retorne APENAS um JSON válido.
    
    Campos solicitados:
    - title: Título ou data (ex: "Terça-feira da Semana Santa")
    - primeiraLeitura: O texto da primeira leitura
    - salmo: O refrão e os versos do salmo
    - evangelho: O texto do evangelho
    - saint: Santo do dia (se houver, caso contrário use "Santo do Dia")

    JSON de saída:
    {
      "title": "",
      "primeiraLeitura": "",
      "salmo": "",
      "evangelho": "",
      "saint": ""
    }

    TEXTO BRUTO:
    ${rawText}
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });
    
    const output = response.choices[0].message.content || "{}";
    return JSON.parse(output);
  } catch (error: any) {
    console.warn("❌ Erro OpenAI (StructuredLiturgy):", error.message || error);
    return null;
  }
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    console.error(`❌ Erro OpenAI (Periodo Especial - ${periodName}):`, error.message || error);
    return `✝️ *${periodName} - Dia ${day}*\n\nDeus abençoe sua jornada. Reserve um momento hoje para fazer uma oração silenciosa e praticar um pequeno ato de caridade. 🙏`;
  }
}

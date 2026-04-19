export const MYSTERIES = {
  Gozosos: ["A Anunciação", "A Visitação", "O Nascimento de Jesus", "A Apresentação no Templo", "A Perda e o Encontro no Templo"],
  Dolorosos: ["A Agonia no Horto", "A Flagelação", "A Coroação de Espinhos", "O Carregamento da Cruz", "A Crucifixão e Morte"],
  Gloriosos: ["A Ressurreição", "A Ascensão", "A Vinda do Espírito Santo", "A Assunção de Maria", "A Coroação de Maria"],
  Luminosos: ["O Batismo de Jesus", "As Bodas de Caná", "O Anúncio do Reino", "A Transfiguração", "A Instituição da Eucaristia"]
};

export const AUDIO_BASE_URL = Deno.env.get("AUDIO_BASE_URL") || "https://rotina-com-deus.vercel.app/audios/";

export function getMysteryOfDay(date: Date = new Date()) {
  const day = date.getDay();
  // 0-Dom, 1-Seg, 2-Ter, 3-Qua, 4-Qui, 5-Sex, 6-Sab
  // Mapeamos o nome para o prefixo do arquivo nos novos audios
  if (day === 0 || day === 3) return { name: "Gloriosos", filePrefix: "gloriosos", mysteries: MYSTERIES.Gloriosos };
  if (day === 1 || day === 6) return { name: "Gozosos", filePrefix: "gozosos", mysteries: MYSTERIES.Gozosos };
  if (day === 2 || day === 5) return { name: "Dolorosos", filePrefix: "doloroso", mysteries: MYSTERIES.Dolorosos };
  return { name: "Luminosos", filePrefix: "luminosos", mysteries: MYSTERIES.Luminosos };
}

export function getNextRosaryStep(currentStep: number, date: Date = new Date()) {
  const mystery = getMysteryOfDay(date);
  
  const steps = [
    { 
      id: 0, 
      name: "Intenções", 
      text: `✝️ *Terço Guiado - Mistérios ${mystery.name}*\n\nAntes de iniciarmos, vamos colocar nossas intenções nas mãos de Deus e de Nossa Senhora...\n\nFeche os olhos por um momento. Entregue suas lutas, sua família, seus sonhos e sua gratidão.\n\n_Faça sua intenção em silêncio no coração..._`, 
      audioUrl: null,
      duration: 0
    },
    { 
      id: 1, 
      name: "Oferecimento", 
      text: `🙏 *Oferecimento do Terço*\n\nVamos rezar juntos este oferecimento, preparando nosso espírito para contemplar a vida de Jesus:`, 
      audioUrl: `${AUDIO_BASE_URL}oracao_intencoes.mp3`,
      duration: 30
    },
    {
      id: 2,
      name: "Ritos Iniciais",
      text: `✝️ *Ritos Iniciais e Introdução*\n\nVamos iniciar os ritos de introdução do Terço.`,
      audioUrl: `${AUDIO_BASE_URL}ritos-introducao-${mystery.filePrefix}.ogg`,
      duration: 180
    },
    // Os 5 mistérios divididos
    ...mystery.mysteries.map((m, i) => ({
      id: 3 + i,
      name: `${i + 1}º Mistério`,
      text: `✝️ *${i + 1}º Mistério - ${mystery.name}*\n\nContemplamos: *${m}*.\n\nOuça o áudio e acompanhe em oração.`,
      audioUrl: `${AUDIO_BASE_URL}terco-misterios-${mystery.filePrefix}-misterio-${i + 1}.ogg`,
      duration: i === 0 ? 300 : (i === 4 ? 240 : 180) // _1 (5 min), _2-4 (3 min), _5 (4 min) aproximadamente
    })),
    {
      id: 8,
      name: "Encerramento",
      text: "🙏 *Agradecimento e Salve Rainha*\n\nConcluímos este momento sagrado entregando nosso dia sob o manto de Maria. Que a paz de Deus te acompanhe sempre!",
      audioUrl: `${AUDIO_BASE_URL}ave_maria.mp3`,
      duration: 50
    }
  ];

  if (currentStep >= steps.length - 1) return null;
  return steps.find(s => s.id === currentStep + 1) || null;
}

export const PRAYERS = {
  Angelus: "O anjo do Senhor anunciou a Maria...",
  SaoJose: "A vós, S. José, recorremos na nossa tribulação...",
  ExameConsciencia: [
    "Como foi meu relacionamento com Deus hoje? Tirei um tempo para Ele?",
    "Fui paciente e amoroso com as pessoas ao meu redor?",
    "Houve algum momento em que falhei com a verdade ou com a caridade?",
    "O que posso fazer melhor amanhã com a graça de Deus?"
  ]
};

export function getOnboardingFlow(step: number) {
  if (step === 0) {
    return {
      text: "🙏 Bem-vindo ao Rotina com Deus\nAqui você vai receber sua rotina diária de oração de forma simples e guiada.\n\nAntes de começarmos, me conta:\n\nVocê já tem o hábito de rezar todos os dias?",
      options: ["Sim", "Não", "Quero melhorar"]
    };
  }
  if (step === 1) {
    return {
      text: "Perfeito 🙏\nVou te ajudar a criar uma rotina com Deus no seu dia a dia, mesmo com pouco tempo.\n\nVamos começar agora?",
      options: ["Começar agora", "Ver como funciona"]
    };
  }
  return null;
}

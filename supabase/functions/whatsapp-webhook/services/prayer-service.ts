export const MYSTERIES = {
  Gozosos: ["A Anunciação", "A Visitação", "O Nascimento de Jesus", "A Apresentação no Templo", "A Perda e o Encontro no Templo"],
  Dolorosos: ["A Agonia no Horto", "A Flagelação", "A Coroação de Espinhos", "O Carregamento da Cruz", "A Crucifixão e Morte"],
  Gloriosos: ["A Ressurreição", "A Ascensão", "A Vinda do Espírito Santo", "A Assunção de Maria", "A Coroação de Maria"],
  Luminosos: ["O Batismo de Jesus", "As Bodas de Caná", "O Anúncio do Reino", "A Transfiguração", "A Instituição da Eucaristia"]
};

export const AUDIO_BASE_URL = "http://localhost:5173/audios/";

export function getMysteryOfDay(date: Date) {
  const day = date.getDay();
  if (day === 1 || day === 6) return { name: "Gozosos", mysteries: MYSTERIES.Gozosos, audio: "terco_misterios_gozosos.mp3" };
  if (day === 2 || day === 5) return { name: "Dolorosos", mysteries: MYSTERIES.Dolorosos, audio: "terco_misterios_doloroso.mp3" };
  if (day === 4) return { name: "Luminosos", mysteries: MYSTERIES.Luminosos, audio: "terco_misterios_luminosos.mp3" };
  return { name: "Gloriosos", mysteries: MYSTERIES.Gloriosos, audio: "terco_misterios_gloriosos.mp3" };
}

export function getNextRosaryStep(currentStep: number, date: Date = new Date()) {
  const mystery = getMysteryOfDay(date);
  
  const steps = [
    { 
      id: 0, 
      name: "Intenções", 
      text: `📿 *Terço Guiado - Mistérios ${mystery.name}*\n\nAntes de iniciarmos, vamos fazer nosso oferecimento...\n\nFeche os olhos por um momento. Entregue a Deus suas causas, sua família e sua gratidão.\n\n_Faça sua intenção em silêncio no coração..._`, 
      audioUrl: null, 
      buttons: ["Fiz minha intenção 🙏"] 
    },
    { 
      id: 1, 
      name: "Oferecimento", 
      text: `🙏 *Oferecimento do Terço*\n\nAgora ouça esta oração de oferecimento antes de iniciarmos nas contas:`, 
      audioUrl: `${AUDIO_BASE_URL}oracao_intencoes.mp3`, 
      buttons: ["Iniciar o Terço"] 
    },
    { 
      id: 2, 
      name: "Mistérios", 
      text: `📿 *Iniciando os Mistérios ${mystery.name}*\n\nO áudio a seguir contém todo o Terço. Mantenha-se em espírito de oração.`, 
      audioUrl: `${AUDIO_BASE_URL}${mystery.audio}`, 
      buttons: ["Concluir Terço"] 
    },
    {
      id: 3,
      name: "Encerramento",
      text: "🙏 *Agradecimento e Salve Rainha*\n\nEncerre este momento sagrado em paz. Que Deus te abençoe poderosamente através da intercessão da Virgem Maria!",
      audioUrl: `${AUDIO_BASE_URL}ave_maria.mp3`,
      buttons: ["Menu Principal"]
    }
  ];

  if (currentStep >= steps.length - 1) return null;
  return steps[currentStep + 1];
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

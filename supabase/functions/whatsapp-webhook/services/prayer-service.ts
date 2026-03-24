export const MYSTERIES = {
  Gozosos: ["A Anunciação", "A Visitação", "O Nascimento de Jesus", "A Apresentação no Templo", "A Perda e o Encontro no Templo"],
  Dolorosos: ["A Agonia no Horto", "A Flagelação", "A Coroação de Espinhos", "O Carregamento da Cruz", "A Crucifixão e Morte"],
  Gloriosos: ["A Ressurreição", "A Ascensão", "A Vinda do Espírito Santo", "A Assunção de Maria", "A Coroação de Maria"],
  Luminosos: ["O Batismo de Jesus", "As Bodas de Caná", "O Anúncio do Reino", "A Transfiguração", "A Instituição da Eucaristia"]
};

export function getMysteryOfDay(date: Date) {
  const day = date.getDay();
  if (day === 1 || day === 6) return { name: "Gozosos", mysteries: MYSTERIES.Gozosos };
  if (day === 2 || day === 5) return { name: "Dolorosos", mysteries: MYSTERIES.Dolorosos };
  if (day === 4) return { name: "Luminosos", mysteries: MYSTERIES.Luminosos };
  return { name: "Gloriosos", mysteries: MYSTERIES.Gloriosos };
}

export function getNextRosaryStep(currentStep: number) {
  const steps = [
    { id: 0, name: "Início", text: "🙏 Vamos começar o Santo Terço. Pelo sinal da Santa Cruz...", buttons: ["Próximo"] },
    { id: 1, name: "1º Mistério", text: "📿 Primeiro Mistério: Contemplamos...", buttons: ["Próximo", "Pausar"] },
    { id: 2, name: "2º Mistério", text: "📿 Segundo Mistério: Contemplamos...", buttons: ["Próximo", "Pausar"] },
    { id: 3, name: "3º Mistério", text: "📿 Terceiro Mistério: Contemplamos...", buttons: ["Próximo", "Pausar"] },
    { id: 4, name: "4º Mistério", text: "📿 Quarto Mistério: Contemplamos...", buttons: ["Próximo", "Pausar"] },
    { id: 5, name: "5º Mistério", text: "📿 Quinto Mistério: Contemplamos...", buttons: ["Próximo", "Pausar"] },
    { id: 6, name: "Salve Rainha", text: "🙏 Salve Rainha, Mãe de misericórdia...", buttons: ["Finalizar"] }
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

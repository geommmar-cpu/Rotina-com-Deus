export async function getRoutineMessage(period: 'morning' | 'noon' | 'night') {
  switch (period) {
    case 'morning':
      return {
        text: "🌅 Bom dia 🙏\nVamos começar seu dia com Deus?\n\nDeseja receber a Liturgia do dia ou fazer uma oração matinal?",
        options: ["Liturgia Diária", "Oração da Manhã"]
      };
    case 'noon':
      return {
        text: "🕛 Meio-dia!\nVamos rezar o Ângelus? 🙏",
        options: ["Rezar Ângelus agora", "Lembrar mais tarde"]
      };
    case 'night':
      return {
        text: "🌙 Hora do seu exame de consciência\nVamos refletir sobre o seu dia?",
        options: ["Sim, vamos", "Agora não"]
      };
  }
}

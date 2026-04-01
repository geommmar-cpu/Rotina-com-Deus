const CLOUD_NAME = "demo";

const SACRED_ART = [
  "https://upload.wikimedia.org/wikipedia/commons/4/4a/Spas_vsederzhitel_sinay.jpg", // Cristo Pantocrator
  "https://upload.wikimedia.org/wikipedia/commons/d/d4/Raphael_-_Madonna_and_Child_-_Google_Art_Project.jpg", // Madonna Rafael
  "https://upload.wikimedia.org/wikipedia/commons/3/32/Jean_II_Restout_-_Pentec%C3%B4te.jpg", // Pentecostes
  "https://upload.wikimedia.org/wikipedia/commons/2/28/The_Entombment_of_Christ-Caravaggio_%28c.1602-3%29.jpg", // Caravaggio
  "https://upload.wikimedia.org/wikipedia/commons/0/0d/Fra_Angelico_015.jpg", // Anunciação
  "https://upload.wikimedia.org/wikipedia/commons/7/73/God_the_Father_Creation_of_the_World.jpg", // Criação
  "https://upload.wikimedia.org/wikipedia/commons/c/c5/Edvard_Stepanovich_Sorokin_Christ_In_A_House_Of_Martha_And_Mary.jpg" // Marta e Maria
];

export function generatePremiumImage(title: string, subtitle: string, readingContent: string = ""): string {
  // Seleção baseada no dia (estabilidade)
  const dayIndex = new Date().getDate() % SACRED_ART.length;
  const background = encodeURIComponent(SACRED_ART[dayIndex]);

  // Limpeza de textos para URL Cloudinary
  const cleanTitle = encodeURIComponent(title.toUpperCase().replace(/,/g, "%2C").replace(/\//g, "%2F"));
  const cleanSub = encodeURIComponent(subtitle.toUpperCase().replace(/,/g, "%2C").replace(/\//g, "%2F"));
  
  // Limita a leitura para não estourar a imagem (max 120 chars para URL curta)
  const cleanReading = encodeURIComponent(
    readingContent.substring(0, 120)
    .replace(/[%,.\/]/g, "") // Limpeza agressiva para encurtar URL
  );

  const transformations = [
    "w_1080,h_1350,c_fill,q_auto,f_jpg",
    "b_black,o_65",
    `l_text:Arial_70_bold:${cleanTitle},co_white,g_north,y_150,w_900,c_fit`,
    `l_text:Arial_45_bold:${cleanSub},co_rgb:ffd700,g_north,y_250`,
    `l_text:Georgia_45_center:${cleanReading}...,co_white,g_center,y_50,w_850,c_fit`
  ].join("/");

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transformations}/${background}`;
}

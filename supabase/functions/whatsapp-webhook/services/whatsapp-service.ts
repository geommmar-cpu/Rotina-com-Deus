import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

export interface SendTextOptions {
  number: string;
  text: string;
}

export interface SendButtonOptions {
  number: string;
  text: string;
  buttons: {
    displayText: string;
  }[];
  footer?: string;
  title?: string;
}

export interface SendAudioOptions {
  number: string;
  audioUrl: string;
}

export class WhatsAppService {
  private apiUrl: string;
  private accessToken: string;
  private phoneNumberId: string;

  public simulatorMessages: string[] = [];
  public isSimulator: boolean = false;

  constructor() {
    this.apiUrl = "https://graph.facebook.com/v22.0";
    this.accessToken = Deno.env.get("META_ACCESS_TOKEN") || "";
    this.phoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID") || "";
  }

  async sendText(options: SendTextOptions) {
    if (this.isSimulator) {
      this.simulatorMessages.push(options.text);
      return { success: true };
    }

    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.formatNumber(options.number),
      type: "text",
      text: { body: options.text }
    };

    return this.postRequest(body);
  }

  async sendAudio(options: SendAudioOptions) {
    if (this.isSimulator) {
      this.simulatorMessages.push(`🎧 [Áudio Enviado: ${options.audioUrl}]`);
      return { success: true };
    }

    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.formatNumber(options.number),
      type: "audio",
      audio: { link: options.audioUrl }
    };

    return this.postRequest(body);
  }

  async sendButtons(options: SendButtonOptions) {
    if (this.isSimulator) {
      this.simulatorMessages.push(`[Botões do Simulador]\n\n${options.text}\n\n${options.buttons.map(b => `- ${b.displayText}`).join('\n')}`);
      return { success: true };
    }

    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.formatNumber(options.number),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: options.text },
        footer: { text: options.footer || "Escolha uma opção" },
        action: {
          buttons: options.buttons.slice(0, 3).map((b, index) => ({
            type: "reply",
            reply: {
              id: `btn_${index}_${Date.now()}`.substring(0, 256),
              title: b.displayText.substring(0, 20)
            }
          }))
        }
      }
    };

    return this.postRequest(body);
  }

  async sendList(options: { number: string; title?: string; text: string; buttonText: string; sections: { title: string; rows: { title: string; description?: string }[] }[] }) {
    if (this.isSimulator) {
      const rowsText = options.sections.flatMap(s => s.rows).map(r => `  🔹 ${r.title}`).join('\n');
      this.simulatorMessages.push(`[Menu Interativo] ${options.text}\n\n[Botão: ${options.buttonText}]\nOpções:\n${rowsText}\n\n(Digite o nome da opção)`);
      return { success: true };
    }

    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.formatNumber(options.number),
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: options.title || "Rotina com Deus" },
        body: { text: options.text },
        footer: { text: "Toque abaixo para ver as opções" },
        action: {
          button: options.buttonText.substring(0, 20),
          sections: options.sections.map(s => ({
            title: s.title.substring(0, 24),
            rows: s.rows.map((r, idx) => ({
              id: `row_${idx}_${Date.now()}`.substring(0, 200),
              title: r.title.substring(0, 24),
              description: r.description?.substring(0, 72) || ""
            }))
          }))
        }
      }
    };

    return this.postRequest(body);
  }

  async downloadMedia(mediaId: string): Promise<string | null> {
    try {
      // 1. Obter a URL da mídia
      const urlInfo = `${this.apiUrl}/${mediaId}`;
      const resInfo = await fetch(urlInfo, {
        headers: { "Authorization": `Bearer ${this.accessToken}` }
      });

      if (!resInfo.ok) {
        console.error("Erro ao obter info da mídia:", await resInfo.text());
        return null;
      }

      const { url } = await resInfo.json();
      console.log(`📡 URL de mídia recebida: ${url.substring(0, 50)}...`);

      // 2. Baixar o arquivo binário (Com Header de Auth e User-Agent para evitar 401/Bloqueio)
      console.log("📥 Iniciando fetch do binário (com Auth)...");
      const resFile = await fetch(url, {
        headers: { 
          "Authorization": `Bearer ${this.accessToken}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      }); 

      console.log(`📡 Status do download binário: ${resFile.status} ${resFile.statusText}`);

      if (!resFile.ok) {
        console.error("❌ Erro ao baixar binário da mídia:", await resFile.text());
        return null;
      }

      console.log("📚 Lendo buffer do arquivo...");
      const arrayBuffer = await resFile.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      console.log(`✅ Buffer lido: ${uint8.byteLength} bytes.`);

      if (uint8.byteLength === 0) return null;

      // Conversão Base64 Segura e Moderna para Deno/Edge Functions
      const base64 = encode(uint8);
      return base64;
    } catch (err: any) {
      console.error("Falha crítica no downloadMedia (Log Final):", err.message || err);
      return null;
    }
  }

  private formatNumber(number: string) {
    let cleaned = number.replace(/\D/g, "");
    if (!cleaned.startsWith("55") && cleaned.length >= 10) {
      cleaned = "55" + cleaned;
    }
    
    // Tratamento especial para o 9 extra no Brasil (Somente se tiver 13 dígitos e começar com 55)
    // Exemplo: 55 61 9 8458-5912 -> 55 61 8458-5912 (Como o Meta geralmente usa internamente)
    if (cleaned.startsWith("55") && cleaned.length === 13) {
      // Remove o nono dígito (o quinto caractere: 55XX9...)
      cleaned = cleaned.slice(0, 4) + cleaned.slice(5);
    }
    
    return cleaned;
  }

  private async postRequest(body: any) {
    const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.accessToken}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erro Meta API (${url}):`, errorText);
        return { success: false, error: errorText };
      }

      return { success: true, data: await response.json() };
    } catch (err) {
      console.error(`Falha na requisição Meta WhatsApp (${url}):`, err);
      return { success: false, error: err.message };
    }
  }
}

export const whatsappService = new WhatsAppService();


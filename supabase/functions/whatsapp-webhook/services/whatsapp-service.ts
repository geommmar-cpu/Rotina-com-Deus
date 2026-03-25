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
  private apiKey: string;
  private instanceName: string;

  public simulatorMessages: string[] = [];
  public isSimulator: boolean = false;

  constructor() {
    this.apiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
    this.apiKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    this.instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "saldin";
  }

  async sendText(options: SendTextOptions) {
    if (this.isSimulator) {
      this.simulatorMessages.push(options.text);
      return { success: true };
    }
    const url = `${this.apiUrl}/message/sendText/${this.instanceName}`;
    return this.postRequest(url, options);
  }

  async sendAudio(options: SendAudioOptions) {
    if (this.isSimulator) {
      this.simulatorMessages.push(`🎧 [Áudio Enviado: ${options.audioUrl}]`);
      return { success: true };
    }
    const url = `${this.apiUrl}/message/sendWhatsAppAudio/${this.instanceName}`;
    const body = {
      number: options.number,
      audio: options.audioUrl
    };
    return this.postRequest(url, body);
  }

  async sendButtons(options: SendButtonOptions) {
    if (this.isSimulator) {
      this.simulatorMessages.push(`[Botões do Simulador]\n\n${options.text}\n\n${options.buttons.map(b => `- ${b.displayText}`).join('\n')}`);
      return { success: true };
    }

    const url = `${this.apiUrl}/message/sendButtons/${this.instanceName}`;
    
    // Formato específico para Evolution API v2/v1 conforme configurado
    const body = {
      number: options.number,
      title: options.title || "Rotina com Deus",
      description: options.text,
      footer: options.footer || "Escolha uma opção abaixo",
      buttons: options.buttons.map((b, index) => ({
        buttonId: `btn_${index}_${Date.now()}`,
        buttonText: { displayText: b.displayText },
        type: 1
      }))
    };

    return this.postRequest(url, body);
  }

  async sendList(options: { number: string; title?: string; text: string; buttonText: string; sections: { title: string; rows: { title: string; description?: string }[] }[] }) {
    if (this.isSimulator) {
      const rowsText = options.sections.flatMap(s => s.rows).map(r => `  🔹 ${r.title}`).join('\n');
      this.simulatorMessages.push(`[Menu Interativo] ${options.text}\n\n[Botão: ${options.buttonText}]\nOpções:\n${rowsText}\n\n(Digite o nome da opção)`);
      return { success: true };
    }
    const url = `${this.apiUrl}/message/sendList/${this.instanceName}`;
    const body = {
      number: options.number,
      title: options.title || "",
      description: options.text,
      buttonText: options.buttonText,
      sections: options.sections
    };
    return this.postRequest(url, body);
  }

  private async postRequest(url: string, body: any) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.apiKey
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erro WhatsApp API (${url}):`, errorText);
        return { success: false, error: errorText };
      }

      return { success: true, data: await response.json() };
    } catch (err) {
      console.error(`Falha na requisição WhatsApp (${url}):`, err);
      return { success: false, error: err.message };
    }
  }
}

export const whatsappService = new WhatsAppService();

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

export class WhatsAppService {
  private apiUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor() {
    this.apiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
    this.apiKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    this.instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "saldin";
  }

  async sendText(options: SendTextOptions) {
    const url = `${this.apiUrl}/message/sendText/${this.instanceName}`;
    return this.postRequest(url, options);
  }

  async sendButtons(options: SendButtonOptions) {
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

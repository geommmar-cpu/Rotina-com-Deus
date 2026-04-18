import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════
// EVOLUTION API - WhatsApp Service
// ═══════════════════════════════════════════════════

export interface SendTextOptions {
  number: string;
  text: string;
}

export interface SendButtonOptions {
  number: string;
  text: string;
  buttons: {
    displayText: string;
    id?: string;
  }[];
  footer?: string;
  title?: string;
}

export interface SendAudioOptions {
  number: string;
  audioUrl: string;
}

export interface SendImageOptions {
  number: string;
  imageUrl: string;
  caption?: string;
}

export interface SendPollOptions {
  number: string;
  name: string;
  values: string[];
  selectableCount?: number;
}

interface EvolutionInstance {
  instance_name: string;
  api_url: string;
  api_key: string;
}

export class WhatsAppService {
  private instanceName: string;
  private apiUrl: string;
  private apiKey: string;

  public simulatorMessages: string[] = [];
  public isSimulator: boolean = false;

  constructor() {
    this.apiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
    this.apiKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    this.instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "rotina-principal";
  }

  // Carrega a instância ativa do banco de dados (para failover)
  async loadActiveInstance(): Promise<boolean> {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
      );

      const { data: instance, error } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, api_url, api_key")
        .eq("is_primary", true)
        .eq("status", "active")
        .single();

      if (error) {
        console.error("❌ [EVO] Erro ao carregar instância do banco:", error.message);
        return false;
      }

      if (instance) {
        this.instanceName = instance.instance_name;
        this.apiUrl = instance.api_url;
        this.apiKey = instance.api_key;
        console.log(`✅ [EVO] Instância carregada do Banco: ${this.instanceName} | endpoint: ${this.apiUrl.substring(0, 15)}...`);
        return true;
      }

      console.warn("[EVO] Nenhuma instância 'active' e 'primary' encontrada no banco.");
      return false;
    } catch (err: any) {
      console.error("🔥 [EVO] Falha crítica no loadActiveInstance:", err.message);
      return false;
    }
  }

  async sendText(options: SendTextOptions) {
    if (this.isSimulator) {
      this.simulatorMessages.push(options.text);
      return { success: true };
    }

    const body = {
      number: this.formatNumber(options.number),
      text: options.text
    };

    return this.postRequest(`/message/sendText/${this.instanceName}`, body);
  }

  async sendAudio(options: SendAudioOptions) {
    if (this.isSimulator) {
      this.simulatorMessages.push(`🎧 [Áudio Enviado: ${options.audioUrl}]`);
      return { success: true };
    }

    // Para arquivos grandes, sendMedia com mimetype explícito costuma ser mais performático
    const body = {
      number: this.formatNumber(options.number),
      mediatype: "audio",
      mimetype: options.audioUrl.endsWith(".ogg") ? "audio/ogg" : "audio/mpeg",
      media: options.audioUrl,
      fileName: options.audioUrl.split('/').pop(),
      delay: 0
    };

    console.log(`📡 [EVO] Enviando Áudio (Otimizado): ${options.audioUrl}`);
    return this.postRequest(`/message/sendMedia/${this.instanceName}`, body);
  }

  async sendImage(options: SendImageOptions) {
    if (this.isSimulator) {
      this.simulatorMessages.push(`🖼️ [Imagem Enviada: ${options.imageUrl}] ${options.caption || ""}`);
      return { success: true };
    }

    const body = {
      number: this.formatNumber(options.number),
      mediatype: "image",
      media: options.imageUrl,
      caption: options.caption || ""
    };

    return this.postRequest(`/message/sendMedia/${this.instanceName}`, body);
  }

  async sendButtons(options: SendButtonOptions) {
    if (this.isSimulator) {
      this.simulatorMessages.push(`[Botões do Simulador]\n\n${options.text}\n\n${options.buttons.map(b => `- ${b.displayText}`).join('\n')}`);
      return { success: true };
    }

    const body = {
      number: this.formatNumber(options.number),
      title: options.title || "Rotina com Deus",
      description: options.text,
      footer: options.footer || "Escolha uma opção",
      buttons: options.buttons.slice(0, 3).map((b, index) => ({
        type: "reply",
        text: b.displayText.substring(0, 20),
        id: b.id || `btn_${index}_${Date.now()}`
      }))
    };

    return this.postRequest(`/message/sendButtons/${this.instanceName}`, body);
  }

  async sendList(options: { number: string; title?: string; text: string; buttonText: string; sections: { title: string; rows: { title: string; description?: string; id?: string }[] }[] }) {
    if (this.isSimulator) {
      const rowsText = options.sections.flatMap(s => s.rows).map(r => `  🔹 ${r.title}`).join('\n');
      this.simulatorMessages.push(`[Menu Interativo] ${options.text}\n\n[Botão: ${options.buttonText}]\nOpções:\n${rowsText}\n\n(Digite o nome da opção)`);
      return { success: true };
    }

    const body = {
      number: this.formatNumber(options.number),
      title: options.title || "Rotina com Deus",
      description: options.text,
      buttonText: options.buttonText.substring(0, 20),
      footerText: "Toque abaixo para ver as opções",
      sections: options.sections.map(s => ({
        title: s.title.substring(0, 24),
        rows: s.rows.map((r, idx) => ({
          title: r.title.substring(0, 24),
          description: r.description?.substring(0, 72) || "",
          rowId: r.id || `row_${idx}_${Date.now()}`
        }))
      }))
    };

    return this.postRequest(`/message/sendList/${this.instanceName}`, body);
  }

  async sendPoll(options: SendPollOptions) {
    if (this.isSimulator) {
      this.simulatorMessages.push(`📊 [Enquete: ${options.name}]\nOpções: ${options.values.join(", ")}`);
      return { success: true };
    }

    const body = {
      number: this.formatNumber(options.number),
      name: options.name,
      selectableCount: options.selectableCount || 1,
      values: options.values,
      delay: 0
    };

    return this.postRequest(`/message/sendPoll/${this.instanceName}`, body);
  }

  async downloadMedia(messageId: string): Promise<string | null> {
    try {
      const url = `${this.apiUrl}/chat/getBase64FromMediaMessage/${this.instanceName}`;
      console.log(`📥 [EVO] Baixando mídia: ${messageId}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.apiKey
        },
        body: JSON.stringify({
          message: { key: { id: messageId } },
          convertToMp4: false
        })
      });

      if (!response.ok) {
        console.error("❌ [EVO] Erro ao baixar mídia:", await response.text());
        return null;
      }

      const data = await response.json();
      const base64 = data.base64 || null;

      if (base64) {
        console.log(`✅ [EVO] Mídia baixada com sucesso (${base64.length} chars base64).`);
      }

      return base64;
    } catch (err: any) {
      console.error("🔥 [EVO] Falha crítica no downloadMedia:", err.message || err);
      return null;
    }
  }

  async checkConnection(): Promise<string> {
    try {
      const url = `${this.apiUrl}/instance/connectionState/${this.instanceName}`;
      const response = await fetch(url, {
        headers: { "apikey": this.apiKey }
      });

      if (!response.ok) return "error";

      const data = await response.json();
      return data.instance?.state || "unknown";
    } catch {
      return "error";
    }
  }

  private formatNumber(number: string) {
    let cleaned = number.replace(/\D/g, "");
    if (!cleaned.startsWith("55") && cleaned.length >= 10) {
      cleaned = "55" + cleaned;
    }
    return cleaned.includes("@") ? cleaned : `${cleaned}@s.whatsapp.net`;
  }

  private async postRequest(endpoint: string, body: any) {
    const url = `${this.apiUrl}${endpoint}`;
    console.log(`📡 [EVO] POST ${url}`);
    
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
        console.error(`❌ [EVO] Erro (${url}) Status: ${response.status}\nResponse:`, errorText);
        return { success: false, error: errorText, status: response.status };
      }

      const resJson = await response.json();
      console.log(`✅ [EVO] Sucesso em ${endpoint}`);
      return { success: true, data: resJson };
    } catch (err: any) {
      console.error(`🔥 [EVO] Falha crítica (${url}):`, err.message);
      return { success: false, error: err.message };
    }
  }
}

export const whatsappService = new WhatsAppService();

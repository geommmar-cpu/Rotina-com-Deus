export interface WhatsAppMessage {
    from: string;
    id: string;
    type: 'text' | 'audio' | 'button' | 'interactive';
    text?: string;
    audioUrl?: string;
    buttonId?: string;
}

export interface UserState {
    id: string;
    phone: string;
    name?: string;
    habit?: string;
    progress: {
        bibleDay: number;
        novena?: string;
        novenaDay: number;
        lastPrayer?: string;
        lastStep: number;
    };
    subscription: 'active' | 'trial' | 'expired' | 'cancelled';
}

export type Intent = 'onboarding' | 'liturgy' | 'prayer' | 'audio_intention' | 'routine' | 'general';

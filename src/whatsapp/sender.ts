import type {
  WhatsAppConfig, OutgoingTextMessage, OutgoingButtonMessage,
  OutgoingListMessage, Respuesta, Boton, SeccionLista,
} from './tipos.ts';

const BASE = 'https://graph.facebook.com';
const OFFLINE_ERROR = 'Red deshabilitada (ATLAS_SIN_RED=true)';
const SEND_ERROR = 'No fue posible enviar el mensaje de WhatsApp';

export interface ResultadoEnvio { ok: boolean; messageId?: string; error?: string }

function esOffline(): boolean {
  return process.env.ATLAS_SIN_RED === 'true';
}

export class WhatsAppSender {
  private readonly config: WhatsAppConfig;
  private readonly version: string;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.version = config.apiVersion ?? 'v21.0';
  }

  async enviar(to: string, respuesta: Respuesta): Promise<ResultadoEnvio> {
    if (respuesta.tipo === 'texto') return this.enviarTexto(to, respuesta.texto);
    if (respuesta.tipo === 'botones') return this.enviarBotones(to, respuesta);
    if (respuesta.tipo === 'lista') return this.enviarLista(to, respuesta);
    return { ok: false, error: 'Tipo de respuesta desconocido' };
  }

  async enviarTexto(to: string, texto: string): Promise<ResultadoEnvio> {
    const mensaje: OutgoingTextMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: texto },
    };
    return this.post(mensaje);
  }

  async enviarBotones(to: string, r: { cuerpo: string; header?: string; footer?: string; botones: Array<{ id: string; titulo: string }> }): Promise<ResultadoEnvio> {
    if (r.botones.length < 1 || r.botones.length > 3) {
      return { ok: false, error: 'WhatsApp permite entre 1 y 3 botones' };
    }
    const botones: Boton[] = r.botones.map(b => ({
      type: 'reply',
      reply: { id: b.id, title: b.titulo.slice(0, 20) },
    }));
    const mensaje: OutgoingButtonMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(r.header ? { header: { type: 'text', text: r.header } } : {}),
        body: { text: r.cuerpo },
        ...(r.footer ? { footer: { text: r.footer } } : {}),
        action: { buttons: botones },
      },
    };
    return this.post(mensaje);
  }

  async enviarLista(to: string, r: { cuerpo: string; header?: string; footer?: string; botonTexto: string; secciones: Array<{ titulo: string; filas: Array<{ id: string; titulo: string; descripcion?: string }> }> }): Promise<ResultadoEnvio> {
    const secciones: SeccionLista[] = r.secciones.map(s => ({
      title: s.titulo,
      rows: s.filas.map(f => ({
        id: f.id,
        title: f.titulo.slice(0, 24),
        ...(f.descripcion ? { description: f.descripcion.slice(0, 72) } : {}),
      })),
    }));
    const mensaje: OutgoingListMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        ...(r.header ? { header: { type: 'text', text: r.header } } : {}),
        body: { text: r.cuerpo },
        ...(r.footer ? { footer: { text: r.footer } } : {}),
        action: { button: r.botonTexto.slice(0, 20), sections: secciones },
      },
    };
    return this.post(mensaje);
  }

  private async post(mensaje: Record<string, unknown>): Promise<ResultadoEnvio> {
    if (esOffline()) {
      return { ok: false, error: OFFLINE_ERROR };
    }

    const url = `${BASE}/${this.version}/${this.config.phoneNumberId}/messages`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mensaje),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) return { ok: false, error: SEND_ERROR };
      const messages = data.messages as Array<{ id: string }> | undefined;
      return { ok: true, messageId: messages?.[0]?.id };
    } catch {
      return { ok: false, error: SEND_ERROR };
    }
  }
}

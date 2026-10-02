import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WhatsAppConfig, WebhookPayload, WebhookContact, Respuesta } from './tipos.ts';
import { WhatsAppSender } from './sender.ts';

const MAX_BODY_BYTES = 64 * 1024;
const REPLAY_MAX_ENTRIES = 10_000;
const REPLAY_TTL_MS = 10 * 60 * 1000;

export interface MensajeRecibido {
  from: string;
  nombre: string;
  texto: string;
  messageId: string;
  timestamp: number;
  interactivo?: { tipo: 'boton' | 'lista'; id: string; titulo: string };
}

export type HandlerMensaje = (msg: MensajeRecibido) => Promise<Respuesta | string | null>;

export class ReplayGuard {
  private seen = new Map<string, number>();

  check(messageId: string): boolean {
    this.evict();
    if (this.seen.has(messageId)) return false;
    this.seen.set(messageId, Date.now());
    return true;
  }

  private evict(): void {
    if (this.seen.size < REPLAY_MAX_ENTRIES) return;
    const cutoff = Date.now() - REPLAY_TTL_MS;
    for (const [id, ts] of this.seen) {
      if (ts < cutoff) this.seen.delete(id);
    }
    if (this.seen.size >= REPLAY_MAX_ENTRIES) {
      const oldest = [...this.seen.entries()].sort((a, b) => a[1] - b[1]);
      const toRemove = oldest.slice(0, Math.floor(REPLAY_MAX_ENTRIES / 4));
      for (const [id] of toRemove) this.seen.delete(id);
    }
  }

  get size(): number { return this.seen.size; }
}

export class WhatsAppWebhook {
  private readonly config: WhatsAppConfig;
  private readonly sender: WhatsAppSender;
  private readonly replay = new ReplayGuard();
  private handler: HandlerMensaje = async () => null;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.sender = new WhatsAppSender(config);
  }

  onMensaje(handler: HandlerMensaje): void {
    this.handler = handler;
  }

  async manejar(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const path = url.pathname;
    if (!path.startsWith('/webhook/whatsapp')) return false;

    if (req.method === 'GET') {
      this.verificar(url, res);
      return true;
    }

    if (req.method === 'POST') {
      await this.recibir(req, res);
      return true;
    }

    res.writeHead(405).end();
    return true;
  }

  private verificar(url: URL, res: ServerResponse): void {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === this.config.verifyToken && challenge) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(challenge);
    } else {
      res.writeHead(403).end('Forbidden');
    }
  }

  private async recibir(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rawBuf = await this.leerBody(req);
    if (!rawBuf) {
      res.writeHead(413).end('Payload Too Large');
      return;
    }

    if (!this.verificarFirma(req, rawBuf)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    res.writeHead(200).end('OK');

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBuf.toString('utf-8'));
    } catch {
      return;
    }

    if (payload.object !== 'whatsapp_business_account') return;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const messages = change.value.messages ?? [];
        const contacts = change.value.contacts ?? [];

        for (const msg of messages) {
          if (!this.replay.check(msg.id)) continue;

          const contacto = contacts.find((c: WebhookContact) => c.wa_id === msg.from);
          const recibido = this.extraerMensaje(msg, contacto);
          if (!recibido) continue;

          try {
            const respuesta = await this.handler(recibido);
            if (!respuesta) continue;

            if (typeof respuesta === 'string') {
              await this.sender.enviarTexto(msg.from, respuesta);
            } else {
              await this.sender.enviar(msg.from, respuesta);
            }
          } catch (e) {
            console.error('[WhatsApp] Error procesando mensaje:', e instanceof Error ? e.message : e);
          }
        }
      }
    }
  }

  private async leerBody(req: IncomingMessage): Promise<Buffer | null> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk as Buffer;
      size += buf.length;
      if (size > MAX_BODY_BYTES) return null;
      chunks.push(buf);
    }
    return Buffer.concat(chunks);
  }

  private verificarFirma(req: IncomingMessage, rawBody: Buffer): boolean {
    const header = req.headers['x-hub-signature-256'];
    if (typeof header !== 'string') return false;
    if (!header.startsWith('sha256=')) return false;

    const expectedHex = header.slice(7);
    if (!/^[0-9a-f]{64}$/i.test(expectedHex)) return false;

    const computed = createHmac('sha256', this.config.appSecret)
      .update(rawBody)
      .digest('hex');

    try {
      return timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(expectedHex, 'hex'),
      );
    } catch {
      return false;
    }
  }

  private extraerMensaje(msg: WebhookPayload['entry'][0]['changes'][0]['value']['messages'] extends (infer M)[] | undefined ? M : never, contacto?: WebhookContact): MensajeRecibido | null {
    const base = {
      from: msg.from,
      nombre: contacto?.profile.name ?? 'Desconocido',
      messageId: msg.id,
      timestamp: parseInt(msg.timestamp, 10),
    };

    if (msg.type === 'text' && msg.text?.body) {
      return { ...base, texto: msg.text.body };
    }

    if (msg.type === 'interactive' && msg.interactive) {
      const br = msg.interactive.button_reply;
      const lr = msg.interactive.list_reply;
      if (br) {
        return { ...base, texto: br.title, interactivo: { tipo: 'boton', id: br.id, titulo: br.title } };
      }
      if (lr) {
        return { ...base, texto: lr.title, interactivo: { tipo: 'lista', id: lr.id, titulo: lr.title } };
      }
    }

    return null;
  }
}

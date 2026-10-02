import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import type { WhatsAppConfig, WebhookPayload, WebhookContact, Respuesta } from './tipos.ts';
import { WhatsAppSender } from './sender.ts';

const MAX_BODY_BYTES = 64 * 1024;
const REPLAY_MAX_ENTRIES = 10_000;
const MESSAGE_FRESHNESS_WINDOW_SECONDS = 30 * 60;

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
  private readonly db: DatabaseSync;
  private readonly maxEntries: number;
  private capacityWarningShown = false;

  constructor(dbPath = ':memory:', maxEntries = REPLAY_MAX_ENTRIES) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
      throw new Error('El límite de replay debe ser un entero positivo.');
    }
    this.maxEntries = maxEntries;
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_replay (
        message_id TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
      )
    `);
  }

  check(messageId: string, timestampSeconds = Math.floor(Date.now() / 1000)): boolean {
    const now = Math.floor(Date.now() / 1000);
    if (!messageId || !Number.isSafeInteger(timestampSeconds)
      || timestampSeconds < now - MESSAGE_FRESHNESS_WINDOW_SECONDS
      || timestampSeconds > now + MESSAGE_FRESHNESS_WINDOW_SECONDS) return false;

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM whatsapp_replay WHERE expires_at <= ?').run(now);
      if (this.db.prepare('SELECT 1 FROM whatsapp_replay WHERE message_id = ?').get(messageId)) {
        this.db.exec('COMMIT');
        return false;
      }

      const count = this.db.prepare('SELECT COUNT(*) AS count FROM whatsapp_replay')
        .get() as { count: number };
      if (count.count >= this.maxEntries) {
        if (!this.capacityWarningShown) {
          console.error('[WhatsApp] Replay storage is full; rejecting new message IDs.');
          this.capacityWarningShown = true;
        }
        this.db.exec('COMMIT');
        return false;
      }

      this.capacityWarningShown = false;
      const expiresAt = timestampSeconds + MESSAGE_FRESHNESS_WINDOW_SECONDS;
      const result = this.db.prepare(
        'INSERT OR IGNORE INTO whatsapp_replay (message_id, expires_at) VALUES (?, ?)',
      ).run(messageId, expiresAt);
      this.db.exec('COMMIT');
      return result.changes === 1;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  get size(): number {
    return (this.db.prepare('SELECT COUNT(*) AS count FROM whatsapp_replay')
      .get() as { count: number }).count;
  }

  close(): void {
    this.db.close();
  }
}

export class WhatsAppWebhook {
  private readonly config: WhatsAppConfig;
  private readonly sender: WhatsAppSender;
  private readonly replay: ReplayGuard;
  private handler: HandlerMensaje = async () => null;

  constructor(config: WhatsAppConfig, replay = new ReplayGuard()) {
    this.config = config;
    this.sender = new WhatsAppSender(config);
    this.replay = replay;
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
          if (!this.replay.check(msg.id, Number(msg.timestamp))) continue;

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
          } catch {
            console.error('[WhatsApp] Handler failed');
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

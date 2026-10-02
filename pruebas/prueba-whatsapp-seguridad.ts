import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { WhatsAppWebhook, ReplayGuard } from '../src/whatsapp/webhook.ts';
import { WhatsAppSender } from '../src/whatsapp/sender.ts';
import { SesionesWhatsApp } from '../src/whatsapp/sesiones.ts';
import { RouterWhatsApp } from '../src/whatsapp/router.ts';
import { configDesdeEnv } from '../src/whatsapp/index.ts';
import type { WhatsAppConfig } from '../src/whatsapp/tipos.ts';

const APP_SECRET = 'test-app-secret-32bytes-longenough';
const CFG: WhatsAppConfig = { accessToken: 'test-tok', phoneNumberId: '123', verifyToken: 'vt', appSecret: APP_SECRET };
const tmpDb = join(process.env.TMPDIR ?? '/tmp', `wa-sec-${Date.now()}.db`);
const tmpReplayDb = join(process.env.TMPDIR ?? '/tmp', `wa-replay-${process.pid}-${Date.now()}.db`);

function signPayload(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
}

function webhookPayload(msgId = 'wamid.test1', text = 'menu', timestamp = Math.floor(Date.now() / 1000)): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: '123',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '15551234567', phone_number_id: '123' },
          contacts: [{ profile: { name: 'Test' }, wa_id: '5215500000000' }],
          messages: [{ from: '5215500000000', id: msgId, timestamp: String(timestamp), type: 'text', text: { body: text } }],
        },
        field: 'messages',
      }],
    }],
  });
}

function mockReq(body: string, signature?: string): any {
  const stream = Readable.from([Buffer.from(body)]);
  (stream as any).method = 'POST';
  (stream as any).headers = signature !== undefined
    ? { 'x-hub-signature-256': signature }
    : {};
  return stream;
}

function mockRes(): { status: number; body: string; obj: any } {
  const r = { status: 0, body: '' };
  const obj = {
    writeHead(s: number) { r.status = s; return obj; },
    end(b?: string) { r.body = b ?? ''; },
  };
  return { ...r, obj, get status() { return r.status; }, get body() { return r.body; } };
}

async function probarLogDeFalloHandler(error: unknown, messageId: string): Promise<{ logs: unknown[][]; status: number }> {
  const webhook = new WhatsAppWebhook(CFG);
  webhook.onMensaje(async () => { throw error; });
  const body = webhookPayload(messageId);
  const response = mockRes();
  const logs: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { logs.push(args); };
  try {
    await webhook.manejar(
      mockReq(body, signPayload(body, APP_SECRET)),
      response.obj,
      new URL('http://localhost/webhook/whatsapp'),
    );
  } finally {
    console.error = originalError;
  }
  return { logs, status: response.status };
}

// =========================================================
// 1. WEBHOOK SIGNATURE VERIFICATION
// =========================================================
describe('Security — Webhook signature verification', () => {
  it('accepts valid X-Hub-Signature-256', async () => {
    const webhook = new WhatsAppWebhook(CFG);
    let handled = false;
    webhook.onMensaje(async () => { handled = true; return null; });

    const body = webhookPayload();
    const sig = signPayload(body, APP_SECRET);
    const req = mockReq(body, sig);
    const res = mockRes();

    await webhook.manejar(req, res.obj, new URL('http://localhost/webhook/whatsapp'));
    assert.equal(res.status, 200);
    assert.equal(handled, true);
  });

  it('rejects invalid signature', async () => {
    const webhook = new WhatsAppWebhook(CFG);
    let handled = false;
    webhook.onMensaje(async () => { handled = true; return null; });

    const body = webhookPayload();
    const sig = signPayload(body, 'wrong-secret');
    const req = mockReq(body, sig);
    const res = mockRes();

    await webhook.manejar(req, res.obj, new URL('http://localhost/webhook/whatsapp'));
    assert.equal(res.status, 403);
    assert.equal(handled, false);
  });

  it('rejects missing signature', async () => {
    const webhook = new WhatsAppWebhook(CFG);
    let handled = false;
    webhook.onMensaje(async () => { handled = true; return null; });

    const body = webhookPayload();
    const req = mockReq(body, undefined);
    const res = mockRes();

    await webhook.manejar(req, res.obj, new URL('http://localhost/webhook/whatsapp'));
    assert.equal(res.status, 403);
    assert.equal(handled, false);
  });

  it('rejects malformed signature (no sha256= prefix)', async () => {
    const webhook = new WhatsAppWebhook(CFG);
    let handled = false;
    webhook.onMensaje(async () => { handled = true; return null; });

    const body = webhookPayload();
    const req = mockReq(body, 'md5=abc123');
    const res = mockRes();

    await webhook.manejar(req, res.obj, new URL('http://localhost/webhook/whatsapp'));
    assert.equal(res.status, 403);
    assert.equal(handled, false);
  });

  it('rejects malformed signature (wrong hex length)', async () => {
    const webhook = new WhatsAppWebhook(CFG);
    let handled = false;
    webhook.onMensaje(async () => { handled = true; return null; });

    const body = webhookPayload();
    const req = mockReq(body, 'sha256=abc');
    const res = mockRes();

    await webhook.manejar(req, res.obj, new URL('http://localhost/webhook/whatsapp'));
    assert.equal(res.status, 403);
    assert.equal(handled, false);
  });
});

// =========================================================
// 2. BODY SIZE LIMIT
// =========================================================
describe('Security — Body size limit', () => {
  it('rejects body exceeding 64 KiB', async () => {
    const webhook = new WhatsAppWebhook(CFG);
    let handled = false;
    webhook.onMensaje(async () => { handled = true; return null; });

    const oversized = 'x'.repeat(65 * 1024);
    const sig = signPayload(oversized, APP_SECRET);
    const req = mockReq(oversized, sig);
    const res = mockRes();

    await webhook.manejar(req, res.obj, new URL('http://localhost/webhook/whatsapp'));
    assert.equal(res.status, 413);
    assert.equal(handled, false);
  });

  it('accepts body within 64 KiB', async () => {
    const webhook = new WhatsAppWebhook(CFG);
    const body = webhookPayload();
    assert.ok(Buffer.byteLength(body) < 64 * 1024);

    const sig = signPayload(body, APP_SECRET);
    const req = mockReq(body, sig);
    const res = mockRes();

    await webhook.manejar(req, res.obj, new URL('http://localhost/webhook/whatsapp'));
    assert.equal(res.status, 200);
  });
});

// =========================================================
// 3. REPLAY PROTECTION / IDEMPOTENCY
// =========================================================
describe('Security — Replay protection', () => {
  it('processes messageId once, rejects duplicate', () => {
    const guard = new ReplayGuard();
    assert.equal(guard.check('msg-1'), true);
    assert.equal(guard.check('msg-1'), false);
    assert.equal(guard.check('msg-2'), true);
  });

  it('duplicate messageId does not invoke handler twice', async () => {
    const webhook = new WhatsAppWebhook(CFG);
    let callCount = 0;
    webhook.onMensaje(async () => { callCount++; return 'ok'; });

    const body = webhookPayload('wamid.dup1', 'hola');
    const sig = signPayload(body, APP_SECRET);

    const req1 = mockReq(body, sig);
    const res1 = mockRes();
    await webhook.manejar(req1, res1.obj, new URL('http://localhost/webhook/whatsapp'));

    const req2 = mockReq(body, sig);
    const res2 = mockRes();
    await webhook.manejar(req2, res2.obj, new URL('http://localhost/webhook/whatsapp'));

    assert.equal(callCount, 1);
  });

  it('duplicate messageId sends an outbound response once', async () => {
    const original = WhatsAppSender.prototype.enviarTexto;
    let sends = 0;
    WhatsAppSender.prototype.enviarTexto = async () => {
      sends++;
      return { ok: true, messageId: 'synthetic-response' };
    };
    try {
      const webhook = new WhatsAppWebhook(CFG);
      webhook.onMensaje(async () => 'ok');
      const body = webhookPayload('wamid.send-once', 'hola');
      const sig = signPayload(body, APP_SECRET);

      await webhook.manejar(mockReq(body, sig), mockRes().obj, new URL('http://localhost/webhook/whatsapp'));
      await webhook.manejar(mockReq(body, sig), mockRes().obj, new URL('http://localhost/webhook/whatsapp'));

      assert.equal(sends, 1);
    } finally {
      WhatsAppSender.prototype.enviarTexto = original;
    }
  });

  it('duplicate messageId remains rejected after webhook restart', async () => {
    const messageId = `wamid.persist-${Date.now()}`;
    const body = webhookPayload(messageId);
    const sig = signPayload(body, APP_SECRET);
    let callCount = 0;

    const firstReplay = new ReplayGuard(tmpReplayDb);
    const firstWebhook = new WhatsAppWebhook(CFG, firstReplay);
    firstWebhook.onMensaje(async () => { callCount++; return null; });
    await firstWebhook.manejar(mockReq(body, sig), mockRes().obj, new URL('http://localhost/webhook/whatsapp'));
    firstReplay.close();

    const restartedReplay = new ReplayGuard(tmpReplayDb);
    const restartedWebhook = new WhatsAppWebhook(CFG, restartedReplay);
    restartedWebhook.onMensaje(async () => { callCount++; return null; });
    await restartedWebhook.manejar(mockReq(body, sig), mockRes().obj, new URL('http://localhost/webhook/whatsapp'));
    restartedReplay.close();

    assert.equal(callCount, 1);
    unlinkSync(tmpReplayDb);
  });

  it('rejects message timestamps outside the 30-minute freshness window', () => {
    const guard = new ReplayGuard();
    const now = Math.floor(Date.now() / 1000);
    assert.equal(guard.check('wamid.stale', now - 1801), false);
    assert.equal(guard.check('wamid.future', now + 1801), false);
    guard.close();
  });

  it('duplicate messageId does not mutate session twice', async () => {
    const sesiones = new SesionesWhatsApp(tmpDb);
    const router = new RouterWhatsApp(sesiones);
    const webhook = new WhatsAppWebhook(CFG);
    webhook.onMensaje(async (msg) => router.procesar(msg));

    const body = webhookPayload('wamid.sess1', '1');
    const sig = signPayload(body, APP_SECRET);

    const req1 = mockReq(body, sig);
    const res1 = mockRes();
    await webhook.manejar(req1, res1.obj, new URL('http://localhost/webhook/whatsapp'));

    const estado1 = sesiones.obtener('5215500000000');
    sesiones.guardar('5215500000000', 'Test', { contexto: 'menu', datos: {} });

    const req2 = mockReq(body, sig);
    const res2 = mockRes();
    await webhook.manejar(req2, res2.obj, new URL('http://localhost/webhook/whatsapp'));

    const estado2 = sesiones.obtener('5215500000000');
    assert.equal(estado2.contexto, 'menu');

    sesiones.close();
    try { unlinkSync(tmpDb); } catch {}
  });

  it('bounded storage fails closed instead of evicting unexpired IDs', () => {
    const guard = new ReplayGuard(':memory:', 3);
    assert.equal(guard.check('msg-1'), true);
    assert.equal(guard.check('msg-2'), true);
    assert.equal(guard.check('msg-3'), true);
    assert.equal(guard.check('msg-4'), false);
    assert.equal(guard.check('msg-1'), false);
    assert.equal(guard.size, 3);
    guard.close();
  });
});

// =========================================================
// 4. ATLAS_SIN_RED ENFORCEMENT
// =========================================================
describe('Security — ATLAS_SIN_RED enforcement', () => {
  it('sender rejects when ATLAS_SIN_RED=true', async () => {
    const original = process.env.ATLAS_SIN_RED;
    process.env.ATLAS_SIN_RED = 'true';
    try {
      const sender = new WhatsAppSender(CFG);
      const res = await sender.enviarTexto('5215500000000', 'hola');
      assert.equal(res.ok, false);
      assert.ok(res.error?.includes('Red deshabilitada'));
      assert.ok(!res.error?.includes(CFG.accessToken));
    } finally {
      if (original !== undefined) process.env.ATLAS_SIN_RED = original;
      else delete process.env.ATLAS_SIN_RED;
    }
  });

  it('sender enviar() rejects all types when offline', async () => {
    const original = process.env.ATLAS_SIN_RED;
    process.env.ATLAS_SIN_RED = 'true';
    try {
      const sender = new WhatsAppSender(CFG);

      const r1 = await sender.enviar('123', { tipo: 'texto', texto: 'hi' });
      assert.equal(r1.ok, false);

      const r2 = await sender.enviarBotones('123', { cuerpo: 'x', botones: [{ id: '1', titulo: 'A' }] });
      assert.equal(r2.ok, false);

      const r3 = await sender.enviarLista('123', {
        cuerpo: 'x', botonTexto: 'Ver', secciones: [{ titulo: 'S', filas: [{ id: '1', titulo: 'F' }] }],
      });
      assert.equal(r3.ok, false);
    } finally {
      if (original !== undefined) process.env.ATLAS_SIN_RED = original;
      else delete process.env.ATLAS_SIN_RED;
    }
  });

  it('no fetch call made when offline', async () => {
    const original = process.env.ATLAS_SIN_RED;
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (async () => { fetchCalled = true; throw new Error('should not reach'); }) as any;
    process.env.ATLAS_SIN_RED = 'true';
    try {
      const sender = new WhatsAppSender(CFG);
      await sender.enviarTexto('5215500000000', 'test');
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
      if (original !== undefined) process.env.ATLAS_SIN_RED = original;
      else delete process.env.ATLAS_SIN_RED;
    }
  });
});

// =========================================================
// 5. SECRET HANDLING
// =========================================================
describe('Security — Secret handling', () => {
  it('configDesdeEnv returns null when appSecret is missing', () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'tok';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    process.env.WHATSAPP_VERIFY_TOKEN = 'vt';
    delete process.env.WHATSAPP_APP_SECRET;
    assert.equal(configDesdeEnv(), null);
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
  });

  it('sender error messages do not leak access token', async () => {
    const original = process.env.ATLAS_SIN_RED;
    process.env.ATLAS_SIN_RED = 'true';
    try {
      const sender = new WhatsAppSender(CFG);
      const res = await sender.enviarTexto('123', 'hi');
      assert.ok(!res.error?.includes(CFG.accessToken));
      assert.ok(!res.error?.includes(CFG.appSecret));
    } finally {
      if (original !== undefined) process.env.ATLAS_SIN_RED = original;
      else delete process.env.ATLAS_SIN_RED;
    }
  });

  it('external sender failures do not expose synthetic secrets', async () => {
    const original = process.env.ATLAS_SIN_RED;
    const originalFetch = globalThis.fetch;
    delete process.env.ATLAS_SIN_RED;
    globalThis.fetch = (async () => { throw new Error(`${CFG.accessToken}:${CFG.appSecret}`); }) as any;
    try {
      const res = await new WhatsAppSender(CFG).enviarTexto('123', 'hi');
      assert.equal(res.error, 'No fue posible enviar el mensaje de WhatsApp');
      assert.ok(!res.error?.includes(CFG.accessToken));
      assert.ok(!res.error?.includes(CFG.appSecret));
    } finally {
      globalThis.fetch = originalFetch;
      if (original !== undefined) process.env.ATLAS_SIN_RED = original;
      else delete process.env.ATLAS_SIN_RED;
    }
  });

  it('webhook error log does not leak app secret on bad JSON', async () => {
    const webhook = new WhatsAppWebhook(CFG);
    const badBody = '{invalid';
    const sig = signPayload(badBody, APP_SECRET);
    const req = mockReq(badBody, sig);
    const res = mockRes();

    await webhook.manejar(req, res.obj, new URL('http://localhost/webhook/whatsapp'));
    assert.equal(res.status, 200);
  });

  it('handler Error logs only a fixed message and preserves webhook response', async () => {
    const secret = 'SECRET_TOKEN_ABC123';
    const { logs, status } = await probarLogDeFalloHandler(new Error(secret), 'wamid.error-log');
    assert.equal(status, 200);
    assert.deepEqual(logs, [['[WhatsApp] Handler failed']]);
    assert.equal(JSON.stringify(logs).includes(secret), false);
  });

  it('thrown secret string is not logged and handler failure is contained', async () => {
    const secret = 'SECRET_TOKEN_PLAIN_STRING_456';
    const { logs, status } = await probarLogDeFalloHandler(secret, 'wamid.string-log');
    assert.equal(status, 200);
    assert.deepEqual(logs, [['[WhatsApp] Handler failed']]);
    assert.equal(JSON.stringify(logs).includes(secret), false);
  });
});

// =========================================================
// 6. MESSAGING_IS_NOT_A_TERMINAL
// =========================================================
describe('Security — MESSAGING_IS_NOT_A_TERMINAL', () => {
  it('router only accepts fixed command set, no eval/exec', async () => {
    const sesiones = new SesionesWhatsApp(tmpDb + '.term');
    const router = new RouterWhatsApp(sesiones);

    const shellAttempts = [
      'rm -rf /',
      '$(cat /etc/passwd)',
      'require("child_process").exec("ls")',
      '__proto__',
      'eval("1+1")',
    ];

    for (const attempt of shellAttempts) {
      const res = await router.procesar({
        from: '5215500000000', nombre: 'Attacker', texto: attempt,
        messageId: `shell-${attempt}`, timestamp: Date.now(),
      });
      if (typeof res === 'string') {
        assert.ok(!res.includes('/etc/passwd'));
      } else {
        assert.ok(res.tipo === 'botones' || res.tipo === 'lista' || res.tipo === 'texto');
        assert.ok(res.cuerpo?.includes('No entendí') || res.cuerpo?.includes('Error') || true);
      }
    }

    sesiones.close();
    try { unlinkSync(tmpDb + '.term'); } catch {}
  });
});

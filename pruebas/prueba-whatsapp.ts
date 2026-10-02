import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppWebhook, WhatsAppSender, configDesdeEnv, crearWhatsApp } from '../src/whatsapp/index.ts';

const TEST_CONFIG = { accessToken: 'tok', phoneNumberId: '123', verifyToken: 'vt', appSecret: 'test-secret' };

describe('WhatsApp — Fase 1', () => {
  it('configDesdeEnv retorna null sin variables de entorno', () => {
    const original = { ...process.env };
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    delete process.env.WHATSAPP_APP_SECRET;
    const config = configDesdeEnv();
    assert.equal(config, null);
    Object.assign(process.env, original);
  });

  it('configDesdeEnv retorna config con variables presentes', () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
    process.env.WHATSAPP_VERIFY_TOKEN = 'mi-verify';
    process.env.WHATSAPP_APP_SECRET = 'mi-secret';
    const config = configDesdeEnv();
    assert.ok(config);
    assert.equal(config.accessToken, 'test-token');
    assert.equal(config.phoneNumberId, '123456');
    assert.equal(config.verifyToken, 'mi-verify');
    assert.equal(config.appSecret, 'mi-secret');
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    delete process.env.WHATSAPP_APP_SECRET;
  });

  it('configDesdeEnv retorna null sin appSecret', () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
    process.env.WHATSAPP_VERIFY_TOKEN = 'mi-verify';
    delete process.env.WHATSAPP_APP_SECRET;
    const config = configDesdeEnv();
    assert.equal(config, null);
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
  });

  it('crearWhatsApp retorna webhook y sender', () => {
    const { webhook, sender } = crearWhatsApp(TEST_CONFIG);
    assert.ok(webhook instanceof WhatsAppWebhook);
    assert.ok(sender instanceof WhatsAppSender);
  });

  it('webhook verificación acepta token correcto', async () => {
    const webhook = new WhatsAppWebhook({ ...TEST_CONFIG, verifyToken: 'secreto' });

    const url = new URL('http://localhost/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=secreto&hub.challenge=challenge123');
    let statusCode = 0;
    let body = '';
    const res = {
      writeHead(s: number, h?: Record<string, string>) { statusCode = s; return this; },
      end(b?: string) { body = b ?? ''; },
    } as any;

    const handled = await webhook.manejar({ method: 'GET' } as any, res, url);
    assert.equal(handled, true);
    assert.equal(statusCode, 200);
    assert.equal(body, 'challenge123');
  });

  it('webhook verificación rechaza token incorrecto', async () => {
    const webhook = new WhatsAppWebhook({ ...TEST_CONFIG, verifyToken: 'secreto' });

    const url = new URL('http://localhost/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=malo&hub.challenge=x');
    let statusCode = 0;
    const res = {
      writeHead(s: number) { statusCode = s; return this; },
      end() {},
    } as any;

    await webhook.manejar({ method: 'GET' } as any, res, url);
    assert.equal(statusCode, 403);
  });

  it('webhook ignora rutas que no son /webhook/whatsapp', async () => {
    const webhook = new WhatsAppWebhook(TEST_CONFIG);
    const url = new URL('http://localhost/api/status');
    const res = {} as any;
    const handled = await webhook.manejar({ method: 'GET' } as any, res, url);
    assert.equal(handled, false);
  });
});

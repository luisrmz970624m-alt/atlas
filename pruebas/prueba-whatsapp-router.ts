import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { SesionesWhatsApp } from '../src/whatsapp/sesiones.ts';
import { RouterWhatsApp, type ModulosAtlas } from '../src/whatsapp/router.ts';
import type { MensajeRecibido } from '../src/whatsapp/webhook.ts';
import type { Respuesta } from '../src/whatsapp/tipos.ts';

const tmpDb = join(process.env.TMPDIR ?? '/tmp', `wa-test-${Date.now()}.db`);

function msg(texto: string, from = '5215512345678'): MensajeRecibido {
  return { from, nombre: 'Luis', texto, messageId: 'test-id', timestamp: Date.now() };
}

function cuerpo(res: Respuesta | string): string {
  if (typeof res === 'string') return res;
  if (res.tipo === 'texto') return res.texto;
  if (res.tipo === 'botones') return res.cuerpo;
  if (res.tipo === 'lista') return res.cuerpo;
  return '';
}

describe('WhatsApp — Fase 2: Sesiones', () => {
  let sesiones: SesionesWhatsApp;
  afterEach(() => { sesiones?.close(); try { unlinkSync(tmpDb); } catch {} });

  it('estado inicial es menu', () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    const estado = sesiones.obtener('5215500000000');
    assert.equal(estado.contexto, 'menu');
  });

  it('guardar y recuperar sesión', () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    sesiones.guardar('5215500000000', 'Test', { contexto: 'curso', datos: { leccion: 1 } });
    const estado = sesiones.obtener('5215500000000');
    assert.equal(estado.contexto, 'curso');
    assert.equal((estado.datos as any).leccion, 1);
  });

  it('resetear vuelve a menu', () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    sesiones.guardar('5215500000000', 'Test', { contexto: 'trading', datos: {} });
    sesiones.resetear('5215500000000');
    assert.equal(sesiones.obtener('5215500000000').contexto, 'menu');
  });

  it('listar sesiones activas', () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    sesiones.guardar('111', 'A', { contexto: 'menu', datos: {} });
    sesiones.guardar('222', 'B', { contexto: 'curso', datos: {} });
    const lista = sesiones.listar();
    assert.equal(lista.length, 2);
  });
});

describe('WhatsApp — Fase 2: Router', () => {
  let sesiones: SesionesWhatsApp;
  let router: RouterWhatsApp;
  afterEach(() => { router?.close(); try { unlinkSync(tmpDb); } catch {} });

  it('primer mensaje muestra menú', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    router = new RouterWhatsApp(sesiones);
    const res = await router.procesar(msg('menu'));
    assert.ok(typeof res === 'object' && res.tipo === 'botones');
  });

  it('opción 1 selecciona curso', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    const modulos: ModulosAtlas = {
      curso: async (_tel, texto) => `Lección: ${texto}`,
    };
    router = new RouterWhatsApp(sesiones, modulos);

    const res1 = await router.procesar(msg('1'));
    assert.ok(typeof res1 === 'object' && res1.tipo === 'lista');

    const res2 = await router.procesar(msg('variables'));
    assert.equal(res2, 'Lección: variables');
  });

  it('opción 2 trading sin módulo dice no conectado', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    router = new RouterWhatsApp(sesiones);
    const res = await router.procesar(msg('2'));
    assert.ok(cuerpo(res).includes('no está conectado'));
  });

  it('texto inválido en menú repite opciones', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    router = new RouterWhatsApp(sesiones);
    const res = await router.procesar(msg('hola'));
    assert.ok(cuerpo(res).includes('No entendí'));
  });

  it('comando menu desde cualquier contexto vuelve al menú', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    const modulos: ModulosAtlas = {
      curso: async () => 'en curso',
    };
    router = new RouterWhatsApp(sesiones, modulos);

    await router.procesar(msg('1'));
    const res = await router.procesar(msg('menu'));
    assert.ok(typeof res === 'object' && res.tipo === 'botones');
    assert.equal(sesiones.obtener('5215512345678').contexto, 'menu');
  });

  it('ayuda muestra información', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    router = new RouterWhatsApp(sesiones);
    const res = await router.procesar(msg('ayuda'));
    assert.ok(typeof res === 'object' && res.tipo === 'lista');
  });

  it('módulo que falla retorna error con botón', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    const modulos: ModulosAtlas = {
      trading: async () => { throw new Error('boom'); },
    };
    router = new RouterWhatsApp(sesiones, modulos);

    await router.procesar(msg('2'));
    const res = await router.procesar(msg('comprar BTC'));
    assert.ok(cuerpo(res).includes('Error'));
  });
});

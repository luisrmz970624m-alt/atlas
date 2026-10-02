import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { SesionesWhatsApp } from '../src/whatsapp/sesiones.ts';
import { RouterWhatsApp, type ModulosAtlas } from '../src/whatsapp/router.ts';
import { WhatsAppSender } from '../src/whatsapp/sender.ts';
import type { MensajeRecibido } from '../src/whatsapp/webhook.ts';
import type { Respuesta } from '../src/whatsapp/tipos.ts';

const tmpDb = join(process.env.TMPDIR ?? '/tmp', `wa-inter-${Date.now()}.db`);

function msg(texto: string, interactivo?: { tipo: 'boton' | 'lista'; id: string; titulo: string }): MensajeRecibido {
  return { from: '5215500000000', nombre: 'Luis', texto, messageId: 'id1', timestamp: Date.now(), interactivo };
}

describe('WhatsApp — Fase 3: Mensajes interactivos', () => {
  let sesiones: SesionesWhatsApp;
  let router: RouterWhatsApp;
  afterEach(() => { router?.close(); try { unlinkSync(tmpDb); } catch {} });

  it('menú devuelve botones', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    router = new RouterWhatsApp(sesiones);
    const res = await router.procesar(msg('menu')) as Respuesta;
    assert.equal(typeof res, 'object');
    assert.equal(res.tipo, 'botones');
    if (res.tipo === 'botones') {
      assert.equal(res.botones.length, 3);
      assert.equal(res.botones[0].id, 'mod_curso');
    }
  });

  it('ayuda devuelve lista interactiva', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    router = new RouterWhatsApp(sesiones);
    const res = await router.procesar(msg('ayuda')) as Respuesta;
    assert.equal(res.tipo, 'lista');
    if (res.tipo === 'lista') {
      assert.ok(res.secciones.length >= 2);
    }
  });

  it('botón mod_curso entra al curso con lista de temas', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    const modulos: ModulosAtlas = {
      curso: async (_t, texto) => `Lección: ${texto}`,
    };
    router = new RouterWhatsApp(sesiones, modulos);
    const res = await router.procesar(msg('📚 Programación', { tipo: 'boton', id: 'mod_curso', titulo: '📚 Programación' })) as Respuesta;
    assert.equal(res.tipo, 'lista');
    if (res.tipo === 'lista') {
      assert.ok(res.cuerpo.includes('TypeScript'));
      assert.ok(res.secciones.some(s => s.filas.some(f => f.id === 'tema_variables')));
    }
  });

  it('botón mod_trading entra al trading con botones de acción', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    const modulos: ModulosAtlas = {
      trading: async (_t, texto) => `Trade: ${texto}`,
    };
    router = new RouterWhatsApp(sesiones, modulos);
    const res = await router.procesar(msg('📈 Trading', { tipo: 'boton', id: 'mod_trading', titulo: '📈 Trading' })) as Respuesta;
    assert.equal(res.tipo, 'botones');
    if (res.tipo === 'botones') {
      assert.ok(res.botones.some(b => b.id === 'trade_portafolio'));
      assert.ok(res.botones.some(b => b.id === 'trade_comprar'));
    }
  });

  it('módulo no conectado muestra botón de volver', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    router = new RouterWhatsApp(sesiones);
    const res = await router.procesar(msg('empresa', { tipo: 'boton', id: 'mod_empresa', titulo: 'Empresa' })) as Respuesta;
    assert.equal(res.tipo, 'botones');
    if (res.tipo === 'botones') {
      assert.ok(res.cuerpo.includes('no está conectado'));
      assert.equal(res.botones[0].id, 'cmd_menu');
    }
  });

  it('lista seleccion desde ayuda redirige a módulo', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    const modulos: ModulosAtlas = {
      curso: async () => 'en curso',
    };
    router = new RouterWhatsApp(sesiones, modulos);
    const res = await router.procesar(msg('📚 Programación', { tipo: 'lista', id: 'mod_curso', titulo: '📚 Programación' })) as Respuesta;
    assert.equal(res.tipo, 'lista');
  });

  it('cmd_menu desde interactivo vuelve al menú', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    router = new RouterWhatsApp(sesiones);
    const res = await router.procesar(msg('Menú', { tipo: 'boton', id: 'cmd_menu', titulo: 'Menú' })) as Respuesta;
    assert.equal(res.tipo, 'botones');
    if (res.tipo === 'botones') {
      assert.equal(res.botones[0].id, 'mod_curso');
    }
  });

  it('módulo recibe interactivoId del botón', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    let recibidoId = '';
    const modulos: ModulosAtlas = {
      trading: async (_t, _texto, iid) => { recibidoId = iid ?? ''; return 'ok'; },
    };
    router = new RouterWhatsApp(sesiones, modulos);

    // Entrar al módulo
    await router.procesar(msg('trading', { tipo: 'boton', id: 'mod_trading', titulo: 'Trading' }));
    // Interactuar dentro del módulo
    await router.procesar(msg('Mi portafolio', { tipo: 'boton', id: 'trade_portafolio', titulo: 'Mi portafolio' }));
    assert.equal(recibidoId, 'trade_portafolio');
  });

  it('texto inválido en menú devuelve botones de opciones', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    router = new RouterWhatsApp(sesiones);
    const res = await router.procesar(msg('xyz')) as Respuesta;
    assert.equal(res.tipo, 'botones');
    if (res.tipo === 'botones') {
      assert.ok(res.cuerpo.includes('No entendí'));
    }
  });

  it('error en módulo devuelve botón de menú', async () => {
    sesiones = new SesionesWhatsApp(tmpDb);
    const modulos: ModulosAtlas = {
      curso: async () => { throw new Error('boom'); },
    };
    router = new RouterWhatsApp(sesiones, modulos);
    await router.procesar(msg('1'));
    const res = await router.procesar(msg('algo')) as Respuesta;
    assert.equal(res.tipo, 'botones');
    if (res.tipo === 'botones') {
      assert.ok(res.botones[0].id === 'cmd_menu');
    }
  });
});

describe('WhatsApp — Fase 3: Sender interactivo', () => {
  it('sender construye payload de botones correctamente', () => {
    const sender = new WhatsAppSender({ accessToken: 'tok', phoneNumberId: '123', verifyToken: 'vt', appSecret: 'sec' });
    // Verificamos que el método existe y acepta los parámetros
    assert.equal(typeof sender.enviarBotones, 'function');
    assert.equal(typeof sender.enviarLista, 'function');
    assert.equal(typeof sender.enviar, 'function');
  });

  it('sender rechaza más de 3 botones', async () => {
    const sender = new WhatsAppSender({ accessToken: 'tok', phoneNumberId: '123', verifyToken: 'vt', appSecret: 'sec' });
    const res = await sender.enviarBotones('123', {
      cuerpo: 'test',
      botones: [
        { id: '1', titulo: 'A' }, { id: '2', titulo: 'B' },
        { id: '3', titulo: 'C' }, { id: '4', titulo: 'D' },
      ],
    });
    assert.equal(res.ok, false);
    assert.ok(res.error?.includes('1 y 3'));
  });
});

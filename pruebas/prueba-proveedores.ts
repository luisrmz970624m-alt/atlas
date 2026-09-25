import { test } from 'node:test';
import * as assert from 'node:assert';
import { ordenConfigurado, proveedoresDisponibles, generarCon, PROVEEDORES } from '../src/proveedores/seleccion.ts';
import { ModeloNoDisponible, RespuestaIncompleta, type Proveedor } from '../src/proveedores/tipos.ts';
import { crearVortice, POLITICA_VORTICE_DEFECTO } from '../src/vortice/router.ts';
import type { Generador, PoliticaVortice, RegistroRuta, SolicitudIA } from '../src/vortice/tipos.ts';

/** Proveedor de mentira para probar la lógica de selección sin red ni claves. */
function falso(nombre: string, opciones: {
  disponible?: boolean;
  falla?: Error;
  respuesta?: string;
  local?: boolean;
} = {}): Proveedor {
  return {
    nombre: nombre as Proveedor['nombre'],
    modelo: `modelo-${nombre}`,
    local: opciones.local ?? nombre === 'ollama',
    disponible: () => opciones.disponible ?? true,
    generar: async () => {
      if (opciones.falla) throw opciones.falla;
      return opciones.respuesta ?? `respuesta de ${nombre}`;
    },
  };
}

/**
 * Ejecuta la cascada REAL de seleccion.ts sobre proveedores de mentira.
 * Probar una copia de la lógica no serviría: al cambiar el código de verdad,
 * la copia seguiría pasando.
 */
const cascada = (candidatos: Proveedor[]) =>
  generarCon(candidatos.filter((p) => p.disponible()), 'sistema', 'usuario');

test('proveedores: los tres agentes están registrados', () => {
  assert.equal(PROVEEDORES.ollama.nombre, 'ollama');
  assert.equal(PROVEEDORES.claude.nombre, 'claude');
  assert.equal(PROVEEDORES.chatgpt.nombre, 'chatgpt');

  // Ollama corre en tu máquina; los otros dos cobran por uso.
  assert.equal(PROVEEDORES.ollama.local, true);
  assert.equal(PROVEEDORES.claude.local, false);
  assert.equal(PROVEEDORES.chatgpt.local, false);
});

test('proveedores: sin configuración, lo local va primero', () => {
  assert.deepEqual(ordenConfigurado(undefined), ['ollama', 'claude', 'chatgpt']);
});

test('proveedores: ATLAS_PROVEEDOR pone el elegido al frente y deja el resto de respaldo', () => {
  assert.deepEqual(ordenConfigurado('claude'), ['claude', 'ollama', 'chatgpt']);
});

test('proveedores: se puede definir una cadena de respaldo explícita', () => {
  assert.deepEqual(ordenConfigurado('chatgpt,claude'), ['chatgpt', 'claude', 'ollama']);
});

test('proveedores: un nombre mal escrito no deja mudo a Atlas', () => {
  // Un dedazo en la variable de entorno debe caer al orden por defecto,
  // no dejar a Atlas sin ningún proveedor.
  assert.deepEqual(ordenConfigurado('cloude'), ['ollama', 'claude', 'chatgpt']);
  assert.deepEqual(ordenConfigurado(''), ['ollama', 'claude', 'chatgpt']);
});

test('proveedores: mayúsculas y espacios no importan', () => {
  assert.deepEqual(ordenConfigurado('  CLAUDE , chatgpt '), ['claude', 'chatgpt', 'ollama']);
});

test('proveedores: los que no están configurados se descartan', () => {
  const disponibles = proveedoresDisponibles(['claude', 'ollama']);

  // Claude solo aparece si hay ANTHROPIC_API_KEY en el entorno.
  const esperado = process.env.ANTHROPIC_API_KEY ? ['claude', 'ollama'] : ['ollama'];
  assert.deepEqual(disponibles.map((p) => p.nombre), esperado);
});

test('proveedores: una clave no habilita API pagada sin permiso explícito', () => {
  const claveAnterior = process.env.ANTHROPIC_API_KEY;
  const permisoAnterior = process.env.ATLAS_PERMITIR_API_PAGADA;
  process.env.ANTHROPIC_API_KEY = 'prueba';
  delete process.env.ATLAS_PERMITIR_API_PAGADA;
  assert.deepEqual(proveedoresDisponibles(['claude']).map((p) => p.nombre), []);
  process.env.ATLAS_PERMITIR_API_PAGADA = 'true';
  assert.deepEqual(proveedoresDisponibles(['claude']).map((p) => p.nombre), ['claude']);
  if (claveAnterior === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = claveAnterior;
  if (permisoAnterior === undefined) delete process.env.ATLAS_PERMITIR_API_PAGADA;
  else process.env.ATLAS_PERMITIR_API_PAGADA = permisoAnterior;
});

test('selección: si el primero no está disponible, responde el siguiente', async () => {
  const texto = await cascada([
    falso('claude', { falla: new ModeloNoDisponible('sin crédito') }),
    falso('ollama', { respuesta: 'lo resolvió el local' }),
  ]);

  assert.equal(texto, 'lo resolvió el local');
});

test('selección: una respuesta cortada NO salta a otro proveedor', async () => {
  // Reintentar en otro proveedor costaría dinero para fallar igual: el
  // problema es el contenido pedido, no el proveedor.
  await assert.rejects(
    () => cascada([
      falso('claude', { falla: new RespuestaIncompleta('se cortó') }),
      falso('ollama', { respuesta: 'no debería llegar aquí' }),
    ]),
    RespuestaIncompleta,
  );
});

test('selección: si ninguno responde, el error dice qué falló en cada uno', async () => {
  await assert.rejects(
    () => cascada([
      falso('claude', { falla: new ModeloNoDisponible('sin clave') }),
      falso('chatgpt', { falla: new ModeloNoDisponible('rate limit') }),
    ]),
    (e: Error) => {
      assert.ok(e instanceof ModeloNoDisponible);
      assert.ok(e.message.includes('sin clave'), 'debe nombrar el fallo de claude');
      assert.ok(e.message.includes('rate limit'), 'debe nombrar el fallo de chatgpt');
      return true;
    },
  );
});

test('selección: sin ningún proveedor configurado, el error explica qué hacer', async () => {
  await assert.rejects(
    () => cascada([falso('claude', { disponible: false })]),
    /Ningún proveedor de IA disponible/,
  );
});

test('CLI agentes probar: un proveedor sin clave se salta sin llamar a la red', async () => {
  const { ejecutarCLIv08 } = await import('../src/cli-v08.ts');

  // claude no tiene ANTHROPIC_API_KEY en este entorno de pruebas: debe
  // saltarse limpiamente, sin intentar una petición real ni marcar error.
  const codigoPrevio = process.exitCode;
  process.exitCode = undefined;

  await assert.doesNotReject(() => ejecutarCLIv08('agentes', ['probar', 'claude']));
  assert.notEqual(process.exitCode, 1);

  process.exitCode = codigoPrevio;
});

test('CLI agentes: mostrar estado no lanza aunque no haya proveedores de pago configurados', async () => {
  const { ejecutarCLIv08 } = await import('../src/cli-v08.ts');

  await assert.doesNotReject(() => ejecutarCLIv08('agentes', []));
});

const solicitudBaja: SolicitudIA = { tipo: 'programacion', complejidad: 'baja', riesgo: 'bajo' };
const solicitudAlta: SolicitudIA = { tipo: 'programacion', complejidad: 'alta', riesgo: 'medio' };

function politica(parcial: Partial<PoliticaVortice> = {}): PoliticaVortice {
  return { ...POLITICA_VORTICE_DEFECTO, ...parcial };
}

test('vórtice: tarea sencilla decide Ollama local de manera determinista', () => {
  const proveedores = { ollama: falso('ollama'), claude: falso('claude'), chatgpt: falso('chatgpt') };
  const vortice = crearVortice(proveedores, politica());
  const esperado = { proveedor: 'ollama', razon: 'local_disponible', coste: 'local', api_pagada: false };
  assert.deepEqual(vortice.decidir(solicitudBaja), esperado);
  assert.deepEqual(vortice.decidir(solicitudBaja), esperado);
});

test('vórtice: proveedor sin clave se salta hacia el siguiente permitido', () => {
  const proveedores = { ollama: falso('ollama'), claude: falso('claude', { disponible: false }), chatgpt: falso('chatgpt') };
  const vortice = crearVortice(proveedores, politica({ apiPagadaPermitida: true }));
  assert.equal(vortice.decidir(solicitudAlta).proveedor, 'chatgpt');
});

test('vórtice: rate limit y error recuperable usan fallback una vez', async () => {
  let llamadasClaude = 0;
  const proveedores = {
    ollama: falso('ollama', { respuesta: 'local' }),
    claude: { ...falso('claude'), generar: async () => { llamadasClaude += 1; throw new ModeloNoDisponible('rate limit'); } },
    chatgpt: falso('chatgpt', { respuesta: 'nube' }),
  };
  const eventos: RegistroRuta[] = [];
  const vortice = crearVortice(proveedores, politica({ apiPagadaPermitida: true }), (evento) => eventos.push(evento));
  assert.equal(await vortice.ejecutar(solicitudAlta, 'sistema', 'usuario'), 'nube');
  assert.equal(llamadasClaude, 1);
  assert.deepEqual(eventos.map((e) => e.resultado), ['no_disponible', 'exito']);
  assert.equal(eventos[1].fallback_utilizado, true);
});

test('vórtice: error no recuperable no hace fallback ni duplica petición pagada', async () => {
  let llamadasClaude = 0; let llamadasChatGPT = 0;
  const proveedores = {
    ollama: falso('ollama'),
    claude: { ...falso('claude'), generar: async () => { llamadasClaude += 1; throw new Error('fallo interno'); } },
    chatgpt: { ...falso('chatgpt'), generar: async () => { llamadasChatGPT += 1; return 'no debe llegar'; } },
  };
  const vortice = crearVortice(proveedores, politica({ apiPagadaPermitida: true }));
  await assert.rejects(() => vortice.ejecutar(solicitudAlta, 'sistema', 'usuario'), /fallo interno/);
  assert.equal(llamadasClaude, 1); assert.equal(llamadasChatGPT, 0);
});

test('vórtice: respuesta truncada no salta ni duplica una petición pagada', async () => {
  let llamadasClaude = 0; let llamadasChatGPT = 0;
  const proveedores = {
    ollama: falso('ollama'),
    claude: { ...falso('claude'), generar: async () => { llamadasClaude += 1; throw new RespuestaIncompleta('cortada'); } },
    chatgpt: { ...falso('chatgpt'), generar: async () => { llamadasChatGPT += 1; return 'no debe llegar'; } },
  };
  const eventos: RegistroRuta[] = [];
  const vortice = crearVortice(proveedores, politica({ apiPagadaPermitida: true }), (evento) => eventos.push(evento));
  await assert.rejects(() => vortice.ejecutar(solicitudAlta, 'sistema', 'usuario'), RespuestaIncompleta);
  assert.equal(llamadasClaude, 1); assert.equal(llamadasChatGPT, 0);
  assert.equal(eventos[0].resultado, 'truncada');
});

test('vórtice: API queda bloqueada sin permiso aunque el proveedor esté disponible', async () => {
  let llamadasClaude = 0;
  const proveedores = {
    ollama: falso('ollama', { disponible: false }),
    claude: { ...falso('claude'), generar: async () => { llamadasClaude += 1; return 'no debe llegar'; } },
    chatgpt: falso('chatgpt', { disponible: false }),
  };
  const vortice = crearVortice(proveedores, politica({ apiPagadaPermitida: false }));
  assert.deepEqual(vortice.decidir(solicitudAlta), { proveedor: null, razon: 'sin_proveedor_permitido', coste: null, api_pagada: false });
  await assert.rejects(() => vortice.ejecutar(solicitudAlta, 'sistema', 'usuario'), ModeloNoDisponible);
  assert.equal(llamadasClaude, 0);
});

test('vórtice: adaptador cumple Generador y sus registros no incluyen secretos ni prompts', async () => {
  const eventos: RegistroRuta[] = [];
  const vortice = crearVortice(
    { ollama: falso('ollama', { respuesta: 'ok' }), claude: falso('claude'), chatgpt: falso('chatgpt') },
    politica(), (evento) => eventos.push(evento),
  );
  const generar: Generador = vortice.generador(solicitudBaja);
  assert.equal(await generar('sistema con sk-secreto', 'usuario con prompt sensible'), 'ok');
  assert.equal(JSON.stringify(eventos).includes('sk-secreto'), false);
  assert.equal(JSON.stringify(eventos).includes('prompt sensible'), false);
  assert.deepEqual(Object.keys(eventos[0]).sort(), ['api_pagada', 'coste', 'duracion_ms', 'fallback_utilizado', 'proveedor', 'razon', 'resultado']);
});

import { test } from 'node:test';
import * as assert from 'node:assert';
import { ordenConfigurado, proveedoresDisponibles, generarCon, PROVEEDORES } from '../src/proveedores/seleccion.ts';
import { ModeloNoDisponible, RespuestaIncompleta, type Proveedor } from '../src/proveedores/tipos.ts';

/** Proveedor de mentira para probar la lógica de selección sin red ni claves. */
function falso(nombre: string, opciones: {
  disponible?: boolean;
  falla?: Error;
  respuesta?: string;
} = {}): Proveedor {
  return {
    nombre: nombre as Proveedor['nombre'],
    modelo: `modelo-${nombre}`,
    local: false,
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

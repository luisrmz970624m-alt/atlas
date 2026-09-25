import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepararContexto, ContextoNoReducible } from '../src/vortice/contexto.ts';
import { crearVortice, POLITICA_VORTICE_DEFECTO } from '../src/vortice/router.ts';
import type { Proveedor } from '../src/proveedores/tipos.ts';
import { Memoria } from '../src/memoria.ts';
import { guardarExperiencia, recuperarEvidencia } from '../src/vortice/experiencia.ts';
import { agregar, leerEventos } from '../src/registro.ts';
import { DatabaseSync } from 'node:sqlite';
import { GeneradorPreciosRealtime } from '../src/precios-realtime.ts';
import { generarCon } from '../src/proveedores/seleccion.ts';

const presupuesto = { maxCaracteres: 30, maxTokensAproximados: 8 };
const fuentes = [
  { id: 'b', origen: 'local', texto: 'segunda evidencia breve' },
  { id: 'a', origen: 'local', texto: 'primera evidencia breve' },
];
function proveedor(nombre: 'ollama' | 'claude', local: boolean, llamadas: { n: number }): Proveedor {
  return { nombre, modelo: nombre, local, disponible: () => true, generar: async () => { llamadas.n += 1; return 'ok'; } };
}
const solicitud = { tipo: 'general' as const, complejidad: 'alta' as const, riesgo: 'bajo' as const };

test('B: presupuesto respetado y recorte estable con fuentes trazables', () => {
  const uno = prepararContexto(fuentes, presupuesto);
  const dos = prepararContexto([...fuentes].reverse(), presupuesto);
  assert.ok(uno.caracteres <= presupuesto.maxCaracteres);
  assert.ok(uno.tokens_aproximados <= presupuesto.maxTokensAproximados);
  assert.deepEqual(uno, dos);
  assert.deepEqual(uno.fuentes, ['a']);
  assert.equal(uno.reducido, true);
});

test('B: rechaza antes de proveedor si ninguna fuente se puede reducir con seguridad', async () => {
  const llamadas = { n: 0 };
  const vortice = crearVortice({ ollama: proveedor('ollama', true, llamadas), claude: proveedor('claude', false, llamadas), chatgpt: proveedor('claude', false, llamadas) }, POLITICA_VORTICE_DEFECTO);
  await assert.rejects(() => vortice.ejecutarConContexto(solicitud, 's', [{ id: 'larga', origen: 'x', texto: 'x'.repeat(100) }], { maxCaracteres: 10, maxTokensAproximados: 2 }), ContextoNoReducible);
  assert.equal(llamadas.n, 0);
});

test('B: un resumen versionado conserva origen, fuentes y se reutiliza', () => {
  const m = new Memoria(':memory:');
  m.guardarResumenContexto({ id: 'curso:arrays', version: 1, origen: 'documentos-locales', texto: 'Resumen estable', fuentes: ['doc-1'] });
  assert.deepEqual(m.obtenerResumenContexto('curso:arrays'), {
    id: 'curso:arrays', version: 1, origen: 'documentos-locales', texto: 'Resumen estable', fuentes: ['doc-1'], fecha: m.obtenerResumenContexto('curso:arrays')!.fecha,
  });
});

test('B: telemetría encadenada omite prompt, respuesta, secreto y error crudo', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'atlas-b-')); const ruta = join(carpeta, 'registro.jsonl');
  agregar(ruta, { tipo: 'resultado', nivel: 'verde', descripcion: 'Vórtice: ollama exito', tarea: null, plan: null,
    entrada: { proveedor: 'ollama', coste: 'local', contexto_caracteres: 12 }, salida: { resultado: 'exito', contexto_reducido: true }, duracion_ms: 2, veredicto: 'exito', razon: 'local_disponible' });
  const texto = readFileSync(ruta, 'utf8');
  for (const prohibido of ['prompt secreto', 'respuesta completa', 'sk-super-secreto', 'stack trace']) assert.equal(texto.includes(prohibido), false);
  assert.equal(leerEventos(ruta).length, 1); rmSync(carpeta, { recursive: true, force: true });
});

test('B: API pagada continúa bloqueada después del recorte de contexto', async () => {
  const local = { n: 0 }; const pago = { n: 0 };
  const vortice = crearVortice({ ollama: { ...proveedor('ollama', true, local), disponible: () => false }, claude: proveedor('claude', false, pago), chatgpt: proveedor('claude', false, pago) }, { ...POLITICA_VORTICE_DEFECTO, ordenCompleja: ['claude', 'ollama', 'chatgpt'] });
  await assert.rejects(() => vortice.ejecutarConContexto(solicitud, 's', fuentes, presupuesto));
  assert.equal(pago.n, 0);
});

test('B: serializa y persiste una Experiencia', () => {
  const m = new Memoria(':memory:');
  const e = guardarExperiencia(m, { dominio: 'programacion', hipotesis: 'prueba', evidencia: 'test unitario', resultado: 'pasa', reglas_cumplidas: ['sin red'], reglas_rotas: [], confianza: 0.8, fuente: 'prueba', estado: 'validada' });
  assert.deepEqual(m.experienciaPorId(e.id), e);
});

test('B: recupera solo evidencia relevante y acotada', () => {
  const m = new Memoria(':memory:');
  guardarExperiencia(m, { dominio: 'programacion', hipotesis: 'router', evidencia: 'presupuesto', resultado: 'ok', reglas_cumplidas: [], reglas_rotas: [], confianza: 0.6, fuente: 'test' });
  guardarExperiencia(m, { dominio: 'trading', hipotesis: 'otra', evidencia: 'presupuesto', resultado: 'ok', reglas_cumplidas: [], reglas_rotas: [], confianza: 0.6, fuente: 'test' });
  assert.equal(recuperarEvidencia(m, 'programacion', 'presupuesto', 1).length, 1);
});

test('B: una ganancia aislada nunca se convierte en validada', () => {
  const m = new Memoria(':memory:');
  const e = guardarExperiencia(m, { dominio: 'trading', hipotesis: 'estrategia', evidencia: 'ganancia aislada', resultado: 'ganó', reglas_cumplidas: [], reglas_rotas: [], confianza: 0.5, fuente: 'simulacion', estado: 'validada' });
  assert.equal(e.estado, 'provisional');
});

test('B.1: Memoria.guardarExperiencia directamente degrada una ganancia aislada', () => {
  const m = new Memoria(':memory:');
  const e = m.guardarExperiencia({ dominio: 'trading', hipotesis: 'atajo', evidencia: 'ganancia aislada', resultado: 'ganó', reglas_cumplidas: [], reglas_rotas: [], confianza: 0.5, fuente: 'test', estado: 'validada' });
  assert.equal(e.estado, 'provisional');
});

test('B.1: prioridad desplaza una fuente menor con id anterior', () => {
  const r = prepararContexto([
    { id: 'a-menor', origen: 'x', texto: 'baja', prioridad: 0 },
    { id: 'z-alta', origen: 'x', texto: 'alta', prioridad: 10 },
  ], { maxCaracteres: 20, maxTokensAproximados: 5 });
  assert.deepEqual(r.fuentes, ['z-alta']);
});

test('B.1: presupuesto descuenta sistema y margen antes de invocar proveedor', async () => {
  const llamadas = { n: 0 };
  const v = crearVortice({ ollama: proveedor('ollama', true, llamadas), claude: proveedor('claude', false, llamadas), chatgpt: proveedor('claude', false, llamadas) });
  await assert.rejects(() => v.ejecutarConContexto(solicitud, 's'.repeat(20), [{ id: 'x', origen: 'x', texto: 'dato' }], { maxCaracteres: 25, maxTokensAproximados: 10, margenSeguridadCaracteres: 3 }), ContextoNoReducible);
  assert.equal(llamadas.n, 0);
});

test('B.1: resúmenes conservan historial y rechazan regresión', () => {
  const m = new Memoria(':memory:');
  m.guardarResumenContexto({ id: 'x', version: 1, origen: 'o', texto: 'uno', fuentes: [] });
  m.guardarResumenContexto({ id: 'x', version: 2, origen: 'o', texto: 'dos', fuentes: [] });
  assert.equal(m.obtenerResumenContexto('x')!.texto, 'dos');
  assert.equal(m.obtenerResumenContexto('x', 1)!.texto, 'uno');
  assert.throws(() => m.guardarResumenContexto({ id: 'x', version: 1, origen: 'o', texto: 'regresión', fuentes: [] }));
});

test('B.1: migra una base previa de resumenes sin perder datos', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'atlas-migracion-')); const ruta = join(carpeta, 'vieja.db');
  const vieja = new DatabaseSync(ruta);
  vieja.exec("CREATE TABLE resumenes_contexto (id TEXT PRIMARY KEY, version INTEGER NOT NULL, origen TEXT NOT NULL, texto TEXT NOT NULL, fuentes TEXT NOT NULL, fecha TEXT NOT NULL); INSERT INTO resumenes_contexto VALUES ('legacy', 1, 'o', 'texto', '[]', '2020-01-01');"); vieja.close();
  const m = new Memoria(ruta);
  assert.equal(m.obtenerResumenContexto('legacy')!.texto, 'texto');
  m.guardarResumenContexto({ id: 'legacy', version: 2, origen: 'o', texto: 'nuevo', fuentes: [] });
  assert.equal(m.obtenerResumenContexto('legacy', 1)!.texto, 'texto'); m.cerrar(); rmSync(carpeta, { recursive: true, force: true });
});

test('B.1: registro genérico redacta secretos y errores crudos', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'atlas-registro-')); const ruta = join(carpeta, 'r.jsonl');
  agregar(ruta, { tipo: 'error', nivel: 'rojo', descripcion: 'x', tarea: null, plan: null, entrada: { token: 'abc', anidado: { authorization: 'Bearer secreto' } }, salida: { error: 'TypeError: secreto interno' }, duracion_ms: 0, veredicto: 'fallo', razon: 'x' });
  const texto = readFileSync(ruta, 'utf8'); assert.equal(texto.includes('abc'), false); assert.equal(texto.includes('Bearer secreto'), false); assert.equal(texto.includes('secreto interno'), false); rmSync(carpeta, { recursive: true, force: true });
});

test('B.1: modo de pruebas de precios no toca fetch/red', async () => {
  const previo = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('RED REAL PROHIBIDA'); }) as typeof fetch;
  const carpeta = mkdtempSync(join(tmpdir(), 'atlas-precios-')); const p = new GeneradorPreciosRealtime(join(carpeta, 'p.db'));
  try { assert.equal((await p.obtener_precio('BTC')).fuente, 'simulado'); } finally { p.cerrar(); globalThis.fetch = previo; rmSync(carpeta, { recursive: true, force: true }); }
});

test('B.1: generarCon no invoca proveedor pagado sin permiso', async () => {
  const previo = process.env.ATLAS_PERMITIR_API_PAGADA; delete process.env.ATLAS_PERMITIR_API_PAGADA;
  let llamadas = 0;
  try {
    await assert.rejects(() => generarCon([{ nombre: 'claude', modelo: 'x', local: false, disponible: () => true, generar: async () => { llamadas++; return 'nunca'; } }], 's', 'u'));
    assert.equal(llamadas, 0);
  } finally { if (previo === undefined) delete process.env.ATLAS_PERMITIR_API_PAGADA; else process.env.ATLAS_PERMITIR_API_PAGADA = previo; }
});

test('B: Generador sigue compatible y fallback local no cambia', async () => {
  const llamadas = { n: 0 }; const p = proveedor('ollama', true, llamadas);
  const vortice = crearVortice({ ollama: p, claude: proveedor('claude', false, { n: 0 }), chatgpt: proveedor('claude', false, { n: 0 }) });
  const generador: (s: string, u: string) => Promise<string> = vortice.generador();
  assert.equal(await generador('s', 'u'), 'ok'); assert.equal(llamadas.n, 1);
});

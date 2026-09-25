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

test('B: Generador sigue compatible y fallback local no cambia', async () => {
  const llamadas = { n: 0 }; const p = proveedor('ollama', true, llamadas);
  const vortice = crearVortice({ ollama: p, claude: proveedor('claude', false, { n: 0 }), chatgpt: proveedor('claude', false, { n: 0 }) });
  const generador: (s: string, u: string) => Promise<string> = vortice.generador();
  assert.equal(await generador('s', 'u'), 'ok'); assert.equal(llamadas.n, 1);
});

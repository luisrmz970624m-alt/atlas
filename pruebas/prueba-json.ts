// Pruebas del extractor de JSON.
// Los casos vienen de fallos reales de qwen2.5-coder:14b.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerJSON, RespuestaIncompleta } from '../src/modelo.ts';

test('JSON limpio', () => {
  assert.deepEqual(extraerJSON('{"a":1}'), { a: 1 });
});

test('JSON envuelto en explicaciones', () => {
  assert.deepEqual(extraerJSON('Claro:\n```json\n{"a":1}\n```\nlisto'), { a: 1 });
});

test('CONTENIDO CON LLAVES DENTRO no confunde al extractor', () => {
  // El fallo real: una lección con código trae { } dentro de una cadena.
  const dentro = '{"pasos":[{"contenido":"function f() { return {a:1}; }"}]}';
  const datos = extraerJSON(dentro) as { pasos: { contenido: string }[] };
  assert.match(datos.pasos[0]!.contenido, /return \{a:1\}/);
});

test('texto después del JSON no estorba', () => {
  assert.deepEqual(extraerJSON('{"a":1}\n\nEspero que te sirva.'), { a: 1 });
});

test('saltos de línea crudos dentro de una cadena se reparan', () => {
  const roto = '{"contenido":"linea uno\nlinea dos"}';
  const datos = extraerJSON(roto) as { contenido: string };
  assert.equal(datos.contenido, 'linea uno\nlinea dos');
});

test('comillas escapadas no rompen el conteo', () => {
  const datos = extraerJSON('{"t":"dijo \\"hola\\" y {salió}"}') as { t: string };
  assert.match(datos.t, /dijo "hola"/);
});

test('un JSON sin cerrar se reporta como respuesta cortada', () => {
  assert.throws(() => extraerJSON('{"pasos":[{"a":1}'), RespuestaIncompleta);
});

test('sin JSON, error claro', () => {
  assert.throws(() => extraerJSON('Lo siento, no puedo ayudarte con eso.'), /no contiene JSON/);
});

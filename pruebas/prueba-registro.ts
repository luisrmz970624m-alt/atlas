// Pruebas del registro. La más importante es la última:
// comprobar que una alteración del historial SIEMPRE se detecta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { agregar, auditar, leerEventos } from '../src/registro.ts';
import { evaluar, pedirPermiso } from '../src/supervisor.ts';

function rutaTemporal(): string {
  return join(mkdtempSync(join(tmpdir(), 'atlas-')), 'registro.jsonl');
}

const base = {
  tipo: 'sistema' as const,
  nivel: 'verde' as const,
  descripcion: 'evento de prueba',
  tarea: null,
  plan: null,
  entrada: null,
  salida: null,
  duracion_ms: null,
  veredicto: null,
  razon: null,
};

test('el primer evento encadena con genesis', () => {
  const ruta = rutaTemporal();
  const e = agregar(ruta, base);
  assert.equal(e.id, 1);
  assert.equal(e.hash_anterior, 'genesis');
  assert.match(e.hash, /^[0-9a-f]{64}$/);
});

test('cada evento apunta al anterior', () => {
  const ruta = rutaTemporal();
  const a = agregar(ruta, base);
  const b = agregar(ruta, base);
  assert.equal(b.id, 2);
  assert.equal(b.hash_anterior, a.hash);
});

test('una cadena intacta se audita como íntegra', () => {
  const ruta = rutaTemporal();
  for (let i = 0; i < 5; i++) agregar(ruta, base);
  const r = auditar(ruta);
  assert.equal(r.estado, 'integra');
  assert.equal(r.eventos, 5);
});

test('un registro inexistente se reporta como ausente', () => {
  assert.equal(auditar(rutaTemporal()).estado, 'ausente');
});

test('ALTERAR UN EVENTO PASADO SE DETECTA', () => {
  const ruta = rutaTemporal();
  for (let i = 0; i < 4; i++) agregar(ruta, { ...base, descripcion: `evento ${i + 1}` });

  // Simulamos a alguien editando el historial a mano.
  const lineas = readFileSync(ruta, 'utf8').trim().split('\n');
  const alterado = JSON.parse(lineas[1]!);
  alterado.descripcion = 'esto nunca pasó';
  lineas[1] = JSON.stringify(alterado);
  writeFileSync(ruta, lineas.join('\n') + '\n');

  const r = auditar(ruta);
  assert.equal(r.estado, 'rota');
  assert.equal(r.rota_en, 2);
});

test('BORRAR UN EVENTO DEL MEDIO SE DETECTA', () => {
  const ruta = rutaTemporal();
  for (let i = 0; i < 4; i++) agregar(ruta, base);

  const lineas = readFileSync(ruta, 'utf8').trim().split('\n');
  lineas.splice(1, 1); // desaparece el evento 2
  writeFileSync(ruta, lineas.join('\n') + '\n');

  const r = auditar(ruta);
  assert.equal(r.estado, 'rota');
  assert.equal(r.rota_en, 3);
});

test('el supervisor clasifica los tres niveles', () => {
  assert.equal(evaluar('leer una lección del laboratorio').nivel, 'verde');
  assert.equal(evaluar('instalar ffmpeg').nivel, 'amarillo');
  assert.equal(evaluar('sudo rm -rf /').nivel, 'rojo');
});

test('un permiso negado también queda registrado', () => {
  const ruta = rutaTemporal();
  const d = pedirPermiso(ruta, 'sudo apagar el equipo');
  assert.equal(d.permitido, false);

  const eventos = leerEventos(ruta);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0]!.tipo, 'aprobacion');
  assert.equal(eventos[0]!.nivel, 'rojo');
  assert.equal(auditar(ruta).estado, 'integra');
});

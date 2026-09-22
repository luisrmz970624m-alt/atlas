// Pruebas del ciclo central.
// No necesitan Ollama: se le inyecta un generador falso.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { planear, ejecutar } from '../src/ciclo.ts';
import { extraerJSON } from '../src/modelo.ts';
import { auditar, leerEventos } from '../src/registro.ts';

const ruta = () => join(mkdtempSync(join(tmpdir(), 'atlas-')), 'registro.jsonl');

const falso = (json: string) => async () => json;

const PLAN_SANO = JSON.stringify({
  criterio_final: 'la lección quedó registrada',
  pasos: [
    { descripcion: 'abrir la lección 1', verificacion: 'el archivo existe' },
    { descripcion: 'resolver el ejercicio', verificacion: 'la respuesta compila' },
  ],
});

test('extraerJSON tolera bloques de código y texto alrededor', () => {
  const sucio = 'Claro, aquí tienes:\n```json\n{"a":1}\n```\nEspero que sirva.';
  assert.deepEqual(extraerJSON(sucio), { a: 1 });
});

test('planear convierte la respuesta del modelo en pasos con nivel', async () => {
  const plan = await planear('estudiar 30 minutos', falso(PLAN_SANO));
  assert.equal(plan.pasos.length, 2);
  assert.equal(plan.version, 1);
  assert.equal(plan.pasos[0]!.nivel, 'verde');
});

test('un plan verde se simula completo y cumple el objetivo', async () => {
  const r0 = ruta();
  const plan = await planear('estudiar 30 minutos', falso(PLAN_SANO));
  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'objetivo cumplido');
  assert.equal(r.ejecutados, 2);
  assert.equal(auditar(r0).estado, 'integra');
});

test('un paso amarillo detiene el ciclo y no se ejecuta', async () => {
  const r0 = ruta();
  const plan = await planear('preparar el entorno', falso(JSON.stringify({
    criterio_final: 'entorno listo',
    pasos: [
      { descripcion: 'leer la configuración', verificacion: 'se imprime' },
      { descripcion: 'instalar ffmpeg', verificacion: 'ffmpeg responde' },
      { descripcion: 'continuar', verificacion: 'no debería llegar aquí' },
    ],
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'requiere aprobación');
  assert.equal(r.ejecutados, 1);              // solo el primero
  assert.match(r.detalle, /instalar ffmpeg/);
});

test('un paso rojo nunca se ejecuta', async () => {
  const r0 = ruta();
  const plan = await planear('limpiar', falso(JSON.stringify({
    criterio_final: 'limpio',
    pasos: [{ descripcion: 'sudo rm -rf /tmp', verificacion: 'la carpeta ya no existe' }],
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'requiere aprobación');
  assert.equal(r.ejecutados, 0);
  assert.equal(plan.pasos[0]!.nivel, 'rojo');
});

test('un paso sin criterio de verificación cuenta como fallo', async () => {
  const r0 = ruta();
  const plan = await planear('algo', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [{ descripcion: 'hacer algo', verificacion: '' }],
  })));

  ejecutar(r0, plan);
  const eventos = leerEventos(r0);
  const paso = eventos.find((e) => e.tipo === 'error');
  assert.ok(paso, 'debería haber un evento de error');
  assert.equal(paso!.veredicto, 'fallo');
});

test('tres fallos seguidos detienen el ciclo', async () => {
  const r0 = ruta();
  const plan = await planear('algo', falso(JSON.stringify({
    criterio_final: 'x',
    pasos: [
      { descripcion: 'uno', verificacion: '' },
      { descripcion: 'dos', verificacion: '' },
      { descripcion: 'tres', verificacion: '' },
      { descripcion: 'cuatro', verificacion: 'no debería llegar' },
    ],
  })));

  const r = ejecutar(r0, plan);
  assert.equal(r.parada, 'tres errores consecutivos');
  assert.equal(r.ejecutados, 0);
});

test('todo el ciclo queda auditable', async () => {
  const r0 = ruta();
  const plan = await planear('estudiar', falso(PLAN_SANO));
  ejecutar(r0, plan);

  const eventos = leerEventos(r0);
  assert.equal(eventos[0]!.tipo, 'decision');                    // el plan
  assert.equal(eventos[eventos.length - 1]!.tipo, 'detencion');  // el cierre
  assert.equal(auditar(r0).estado, 'integra');
});
